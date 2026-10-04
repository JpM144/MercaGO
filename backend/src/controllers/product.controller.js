import { Op, Sequelize } from 'sequelize';
import db from '../models/index.js';
import { slugify, uniqueSlug } from '../utils/slug.util.js';
import { activePlanWhere } from '../utils/plan.util.js';
import { checkProductLimit } from '../utils/planTier.util.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const NEW_DAYS = 14;

const ORDER_BY = {
  price_asc: [['price', 'ASC']],
  price_desc: [['price', 'DESC']],
  newest: [['createdAt', 'DESC']],
};

export function toProductJson(product, { includeCost = false } = {}) {
  const json = product.get ? product.get({ plain: true }) : { ...product };
  const result = {
    ...json,
    price: Number(json.price),
    originalPrice: json.originalPrice == null ? null : Number(json.originalPrice),
  };
  if (includeCost) {
    result.cost = Number(json.cost ?? 0);
  } else {
    delete result.cost;
  }
  return result;
}

export function toDetailJson(product) {
  const base = toProductJson(product);
  const createdAt = product.createdAt ?? product.created_at;
  const ageMs = createdAt ? Date.now() - new Date(createdAt).getTime() : Infinity;
  base.isNew = ageMs <= NEW_DAYS * 24 * 60 * 60 * 1000;
  base.discountPercent =
    base.originalPrice != null && base.originalPrice > base.price
      ? Math.round(((base.originalPrice - base.price) / base.originalPrice) * 100)
      : null;
  return base;
}

export async function querySiteProducts({
  category,
  search,
  sort,
  page,
  limit,
  onSale,
  storeSlug,
  maxPrice,
}) {
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(limit, 10) || DEFAULT_LIMIT));

  const where = { isActive: true };
  const storeWhere = { status: 'approved', ...activePlanWhere() };

  if (onSale === 'true') {
    where[Op.and] = Sequelize.where(Sequelize.col('original_price'), Op.gt, Sequelize.col('price'));
  }

  if (storeSlug) {
    storeWhere.slug = storeSlug;
  }

  if (category) {
    if (storeSlug) {
      // Catálogo de una tienda: el slug se resuelve dentro de esa tienda.
      const store = await db.Store.findOne({ where: { slug: storeSlug }, attributes: ['id'] });
      const cat = store
        ? await db.Category.findOne({ where: { slug: category, storeId: store.id } })
        : null;
      if (!cat) {
        return { rows: [], count: 0, pageNum, limitNum };
      }
      where.categoryId = cat.id;
    } else {
      // Catálogo global: al ser categorías privadas, el filtro matchea por NOMBRE
      // y trae los productos de todas las tiendas que usan ese nombre.
      const cats = await db.Category.findAll({
        where: { name: { [Op.iLike]: String(category).trim() } },
        attributes: ['id'],
      });
      if (cats.length === 0) {
        return { rows: [], count: 0, pageNum, limitNum };
      }
      where.categoryId = { [Op.in]: cats.map((cat) => cat.id) };
    }
  }

  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
    ];
  }

  if (maxPrice !== undefined && maxPrice !== null) {
    const priceNum = Number(maxPrice);
    if (Number.isFinite(priceNum) && priceNum >= 0) {
      where.price = { [Op.lte]: priceNum };
    }
  }

  const order = ORDER_BY[sort] ?? ORDER_BY.newest;

  const { rows, count } = await db.Product.findAndCountAll({
    where,
    order,
    offset: (pageNum - 1) * limitNum,
    limit: limitNum,
    distinct: true,
    include: [
      {
        model: db.Category,
        as: 'category',
        attributes: ['id', 'name', 'slug'],
      },
      {
        model: db.Store,
        as: 'store',
        attributes: ['id', 'name', 'slug'],
        where: storeWhere,
      },
    ],
  });

  return { rows, count, pageNum, limitNum };
}

export async function listProducts(req, res, next) {
  try {
    const { category, search, sort, page, limit, onSale, store } = req.query;

    const { rows, count, pageNum, limitNum } = await querySiteProducts({
      category,
      search,
      sort,
      page,
      limit,
      onSale,
      storeSlug: store,
    });

    return res.json({
      products: rows.map(toProductJson),
      total: count,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(count / limitNum),
    });
  } catch (error) {
    return next(error);
  }
}

export async function getProductBySlug(req, res, next) {
  try {
    const product = await db.Product.findOne({
      where: { slug: req.params.slug, isActive: true },
      include: [
        {
          model: db.Category,
          as: 'category',
          attributes: ['id', 'name', 'slug'],
        },
        {
          model: db.Store,
          as: 'store',
          attributes: ['id', 'name', 'slug', 'whatsappNumber'],
          where: { status: 'approved', ...activePlanWhere() },
        },
      ],
    });

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    const reviews = await db.Review.findAll({
      where: { productId: product.id },
      attributes: ['id', 'rating', 'comment', 'photoUrl', 'created_at'],
      include: [{ model: db.User, as: 'user', attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']],
    });

    const ratingCount = reviews.length;
    const ratingAverage = ratingCount
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / ratingCount) * 10) / 10
      : null;

    const priceHistory = await db.PriceHistory.findAll({
      where: { productId: product.id },
      attributes: ['id', 'price', 'changed_at'],
      order: [['changed_at', 'DESC']],
    });

    return res.json({
      product: {
        ...toDetailJson(product),
        priceHistory: priceHistory.map((entry) => ({
          id: entry.id,
          price: Number(entry.price),
          changedAt: entry.getDataValue('changed_at'),
        })),
      },
      ratingAverage,
      ratingCount,
      reviews,
    });
  } catch (error) {
    return next(error);
  }
}

export async function createProduct(req, res, next) {
  try {
    const {
      name,
      slug,
      description,
      price,
      stock = 0,
      image_url,
      imageUrl,
      category_id,
      categoryId,
      original_price,
      originalPrice,
      cost,
    } = req.body ?? {};

    const catId = category_id ?? categoryId;
    const priceNum = price === undefined ? NaN : Number(price);
    const stockNum = Number(stock);

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name es obligatorio.' });
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      return res.status(400).json({ error: 'price debe ser un número mayor o igual a 0.' });
    }
    if (!Number.isInteger(stockNum) || stockNum < 0) {
      return res.status(400).json({ error: 'stock debe ser un entero mayor o igual a 0.' });
    }
    if (catId === undefined) {
      return res.status(400).json({ error: 'categoryId es obligatorio.' });
    }
    const costProvided = cost !== undefined && cost !== null && cost !== '';
    const costNum = costProvided ? Number(cost) : 0;
    if (costProvided && (!Number.isFinite(costNum) || costNum < 0)) {
      return res.status(400).json({ error: 'cost debe ser un número mayor o igual a 0.' });
    }

    const originalRaw = original_price ?? originalPrice;
    let originalPriceNum = null;
    if (originalRaw !== undefined && originalRaw !== null) {
      originalPriceNum = Number(originalRaw);
      if (!Number.isFinite(originalPriceNum) || originalPriceNum < 0) {
        return res
          .status(400)
          .json({ error: 'original_price debe ser un número mayor o igual a 0.' });
      }
      if (originalPriceNum <= priceNum) {
        return res
          .status(400)
          .json({ error: 'original_price debe ser mayor que price para marcar una oferta.' });
      }
    }

    const category = await db.Category.findOne({ where: { id: catId, storeId: req.store.id } });
    if (!category) {
      return res.status(400).json({ error: 'La categoría indicada no pertenece a tu tienda.' });
    }

    const limitError = await checkProductLimit(req.store);
    if (limitError) {
      return res.status(403).json({ error: limitError });
    }

    const finalSlug = slug
      ? await uniqueSlug(db.Product, slugify(slug))
      : await uniqueSlug(db.Product, slugify(name));

    const product = await db.Product.create({
      name,
      slug: finalSlug,
      description: description ?? null,
      price: priceNum,
      cost: costNum,
      stock: stockNum,
      imageUrl: imageUrl ?? image_url ?? null,
      categoryId: catId,
      storeId: req.store.id,
      originalPrice: originalPriceNum,
    });

    const created = await db.Product.findByPk(product.id, {
      include: [
        { model: db.Category, as: 'category', attributes: ['id', 'name', 'slug'] },
        { model: db.Store, as: 'store', attributes: ['id', 'name', 'slug'] },
      ],
    });

    return res.status(201).json({ product: toProductJson(created, { includeCost: true }) });
  } catch (error) {
    return next(error);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const product = req.product;

    const {
      name,
      slug,
      description,
      price,
      stock,
      image_url,
      imageUrl,
      category_id,
      categoryId,
      original_price,
      originalPrice,
      is_active,
      isActive,
      cost,
    } = req.body ?? {};

    const fields = {};

    if (name !== undefined) {
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'name debe ser un texto no vacío.' });
      }
      fields.name = name;
    }
    if (slug !== undefined) {
      fields.slug = await uniqueSlug(db.Product, slugify(slug), { excludeId: product.id });
    } else if (name !== undefined) {
      fields.slug = await uniqueSlug(db.Product, slugify(name), { excludeId: product.id });
    }
    if (description !== undefined) fields.description = description;
    if (price !== undefined) {
      const priceNum = Number(price);
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        return res.status(400).json({ error: 'price debe ser un número mayor o igual a 0.' });
      }
      fields.price = priceNum;
    }
    if (original_price !== undefined || originalPrice !== undefined) {
      const originalRaw = original_price ?? originalPrice;
      const originalPriceNum =
        originalRaw === null || originalRaw === '' ? null : Number(originalRaw);
      if (originalPriceNum !== null) {
        if (!Number.isFinite(originalPriceNum) || originalPriceNum < 0) {
          return res
            .status(400)
            .json({ error: 'original_price debe ser un número mayor o igual a 0.' });
        }
        const priceNum = Number(price ?? product.price);
        if (originalPriceNum <= priceNum) {
          return res
            .status(400)
            .json({ error: 'original_price debe ser mayor que price para marcar una oferta.' });
        }
      }
      fields.originalPrice = originalPriceNum;
    }
    if (stock !== undefined) {
      const stockNum = Number(stock);
      if (!Number.isInteger(stockNum) || stockNum < 0) {
        return res.status(400).json({ error: 'stock debe ser un entero mayor o igual a 0.' });
      }
      fields.stock = stockNum;
    }
    if (cost !== undefined) {
      const costNum = cost === null || cost === '' ? 0 : Number(cost);
      if (!Number.isFinite(costNum) || costNum < 0) {
        return res.status(400).json({ error: 'cost debe ser un número mayor o igual a 0.' });
      }
      fields.cost = costNum;
    }
    if (image_url !== undefined || imageUrl !== undefined) {
      fields.imageUrl = imageUrl ?? image_url;
    }
    if (category_id !== undefined || categoryId !== undefined) {
      const catId = category_id ?? categoryId;
      const category = await db.Category.findOne({
        where: { id: catId, storeId: req.store.id },
      });
      if (!category) {
        return res.status(400).json({ error: 'La categoría indicada no pertenece a tu tienda.' });
      }
      fields.categoryId = catId;
    }
    if (is_active !== undefined || isActive !== undefined) {
      const isActiveValue = is_active ?? isActive;
      if (typeof isActiveValue !== 'boolean') {
        return res.status(400).json({ error: 'is_active debe ser un booleano.' });
      }
      fields.isActive = isActiveValue;
    }

    await product.update(fields);

    const updated = await db.Product.findByPk(product.id, {
      include: [
        { model: db.Category, as: 'category', attributes: ['id', 'name', 'slug'] },
        { model: db.Store, as: 'store', attributes: ['id', 'name', 'slug'] },
      ],
    });

    return res.json({ product: toProductJson(updated, { includeCost: true }) });
  } catch (error) {
    return next(error);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    await req.product.update({ isActive: false });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

export async function listStoreAdminProducts(req, res, next) {
  try {
    const { search, category } = req.query;
    const where = { storeId: req.store.id };

    if (category) {
      const cat = await db.Category.findOne({
        where: { slug: category, storeId: req.store.id },
      });
      if (cat) where.categoryId = cat.id;
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const products = await db.Product.findAll({
      where,
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
      include: [
        { model: db.Category, as: 'category', attributes: ['id', 'name', 'slug'] },
        { model: db.Store, as: 'store', attributes: ['id', 'name', 'slug'] },
      ],
    });

    return res.json({
      products: products.map((product) => toProductJson(product, { includeCost: true })),
    });
  } catch (error) {
    return next(error);
  }
}
