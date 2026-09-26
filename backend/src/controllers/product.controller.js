import { Op } from 'sequelize';
import db from '../models/index.js';
import { slugify, uniqueSlug } from '../utils/slug.util.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const ORDER_BY = {
  price_asc: [['price', 'ASC']],
  price_desc: [['price', 'DESC']],
  newest: [['createdAt', 'DESC']],
};

function toProductJson(product) {
  const json = product.get ? product.get({ plain: true }) : { ...product };
  return { ...json, price: Number(json.price) };
}

export async function listProducts(req, res, next) {
  try {
    const { category, search, sort, page, limit } = req.query;

    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNum = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(limit, 10) || DEFAULT_LIMIT));

    const where = {};

    if (category) {
      const cat = await db.Category.findOne({ where: { slug: category } });
      if (!cat) {
        return res.json({ products: [], total: 0, page: pageNum, limit: limitNum, totalPages: 0 });
      }
      where.categoryId = cat.id;
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
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
      ],
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
      where: { slug: req.params.slug },
      include: [
        {
          model: db.Category,
          as: 'category',
          attributes: ['id', 'name', 'slug'],
        },
      ],
    });

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    const reviews = await db.Review.findAll({
      where: { productId: product.id },
      attributes: ['id', 'rating', 'comment', 'created_at'],
      include: [{ model: db.User, as: 'user', attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']],
    });

    const ratingCount = reviews.length;
    const ratingAverage = ratingCount
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / ratingCount) * 10) / 10
      : null;

    return res.json({
      product: toProductJson(product),
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

    const category = await db.Category.findByPk(catId);
    if (!category) {
      return res.status(400).json({ error: 'La categoría indicada no existe.' });
    }

    const finalSlug = slug
      ? await uniqueSlug(db.Product, slugify(slug))
      : await uniqueSlug(db.Product, slugify(name));

    const product = await db.Product.create({
      name,
      slug: finalSlug,
      description: description ?? null,
      price: priceNum,
      stock: stockNum,
      imageUrl: imageUrl ?? image_url ?? null,
      categoryId: catId,
    });

    return res.status(201).json({ product: toProductJson(product) });
  } catch (error) {
    return next(error);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const product = await db.Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    const { name, slug, description, price, stock, image_url, imageUrl, category_id, categoryId } =
      req.body ?? {};

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
    if (stock !== undefined) {
      const stockNum = Number(stock);
      if (!Number.isInteger(stockNum) || stockNum < 0) {
        return res.status(400).json({ error: 'stock debe ser un entero mayor o igual a 0.' });
      }
      fields.stock = stockNum;
    }
    if (image_url !== undefined || imageUrl !== undefined) {
      fields.imageUrl = imageUrl ?? image_url;
    }
    if (category_id !== undefined || categoryId !== undefined) {
      const catId = category_id ?? categoryId;
      const category = await db.Category.findByPk(catId);
      if (!category) {
        return res.status(400).json({ error: 'La categoría indicada no existe.' });
      }
      fields.categoryId = catId;
    }

    await product.update(fields);
    return res.json({ product: toProductJson(product) });
  } catch (error) {
    return next(error);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const product = await db.Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    try {
      await product.destroy();
    } catch (error) {
      if (error.original?.code === '23503') {
        return res.status(409).json({
          error: 'No se puede eliminar el producto porque está referenciado en pedidos.',
        });
      }
      throw error;
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}
