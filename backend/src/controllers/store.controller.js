import { Op } from 'sequelize';
import db from '../models/index.js';
import { toDetailJson, querySiteProducts } from './product.controller.js';
import { activePlanWhere, getEffectivePlanStatus } from '../utils/plan.util.js';
import { withPlanUsage } from '../utils/planTier.util.js';

const FEATURED_COUNT = 4;

const PUBLIC_STORE_FIELDS = [
  'id',
  'name',
  'slug',
  'description',
  'whatsappNumber',
  'businessHours',
  'shippingInfo',
  'warrantyInfo',
  'paymentMethods',
];

const PRODUCT_FIELDS = ['id', 'name', 'slug', 'price', 'original_price', 'stock', 'image_url'];

function toProductJson(item) {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    price: Number(item.price),
    originalPrice: item.originalPrice == null ? null : Number(item.originalPrice),
    stock: item.stock,
    imageUrl: item.imageUrl ?? item.image_url,
  };
}

function toStoreJson(store) {
  const json = store.get({ plain: true });
  if (Array.isArray(json.products)) {
    return {
      ...json,
      productCount: json.products.length,
      products: json.products.map(toProductJson),
    };
  }
  return json;
}

export async function getMyStore(req, res, next) {
  try {
    const store = await db.Store.findByPk(req.store.id, {
      include: [
        {
          model: db.User,
          as: 'owner',
          attributes: ['id', 'name', 'email'],
        },
        {
          model: db.Product,
          as: 'products',
          attributes: PRODUCT_FIELDS,
          required: false,
        },
      ],
    });

    if (!store) {
      return res.status(404).json({ error: 'Tienda no encontrada.' });
    }

    return res.json({ store: toStoreJson(store) });
  } catch (error) {
    return next(error);
  }
}

export async function getPublicStore(req, res, next) {
  try {
    const store = await db.Store.findOne({
      where: { slug: req.params.slug, status: 'approved', ...activePlanWhere() },
      attributes: [...PUBLIC_STORE_FIELDS, 'createdAt'],
      include: [
        {
          model: db.Product,
          as: 'products',
          attributes: ['id'],
          required: false,
          where: { isActive: true },
        },
      ],
    });

    if (!store) {
      return res.status(404).json({ error: 'Tienda no encontrada o no está aprobada.' });
    }

    const json = store.get({ plain: true });
    return res.json({
      store: {
        id: json.id,
        name: json.name,
        slug: json.slug,
        description: json.description,
        whatsappNumber: json.whatsappNumber,
        businessHours: json.businessHours,
        shippingInfo: json.shippingInfo,
        warrantyInfo: json.warrantyInfo,
        paymentMethods: json.paymentMethods,
        productCount: json.products.length,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function listPublicStores(req, res, next) {
  try {
    const stores = await db.Store.findAll({
      where: { status: 'approved', ...activePlanWhere() },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: db.Product,
          as: 'products',
          attributes: ['id'],
          required: false,
          where: { isActive: true },
        },
      ],
    });

    return res.json({
      stores: stores.map((store) => {
        const json = store.get({ plain: true });
        return {
          id: json.id,
          name: json.name,
          slug: json.slug,
          productCount: json.products.length,
        };
      }),
    });
  } catch (error) {
    return next(error);
  }
}

export async function storeProducts(req, res, next) {
  try {
    const store = await db.Store.findOne({
      where: { slug: req.params.slug, status: 'approved', ...activePlanWhere() },
      attributes: ['id', 'name', 'slug'],
    });

    if (!store) {
      return res.status(404).json({ error: 'Tienda no encontrada o no está aprobada.' });
    }

    if (req.query.featured === 'true') {
      const products = await db.Product.findAll({
        where: { storeId: store.id, isActive: true, stock: { [Op.gt]: 0 } },
        order: [
          ['createdAt', 'DESC'],
          ['id', 'DESC'],
        ],
        limit: FEATURED_COUNT,
        include: [
          { model: db.Category, as: 'category', attributes: ['id', 'name', 'slug'] },
          { model: db.Store, as: 'store', attributes: ['id', 'name', 'slug'] },
        ],
      });

      return res.json({
        store: { id: store.id, name: store.name, slug: store.slug },
        products: products.map(toDetailJson),
      });
    }

    const { category, search, sort, page, limit, onSale } = req.query;
    const { rows, count, pageNum, limitNum } = await querySiteProducts({
      category,
      search,
      sort,
      page,
      limit,
      onSale,
      storeSlug: store.slug,
    });

    return res.json({
      store: { id: store.id, name: store.name, slug: store.slug },
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

export async function storeCategories(req, res, next) {
  try {
    const store = await db.Store.findOne({
      where: { slug: req.params.slug, status: 'approved', ...activePlanWhere() },
      attributes: ['id', 'name', 'slug'],
    });

    if (!store) {
      return res.status(404).json({ error: 'Tienda no encontrada o no está aprobada.' });
    }

    const categories = await db.sequelize.query(
      `SELECT c.id, c.name, c.slug, COUNT(p.id)::int AS "productCount"
       FROM categories c
       JOIN products p ON p.category_id = c.id AND p.store_id = :storeId AND p.stock > 0 AND p.is_active = TRUE
       WHERE c.store_id = :storeId
       GROUP BY c.id, c.name, c.slug
       ORDER BY "productCount" DESC, c.name ASC`,
      {
        replacements: { storeId: store.id },
        type: db.Sequelize.QueryTypes.SELECT,
      },
    );

    return res.json({
      store: { id: store.id, name: store.name, slug: store.slug },
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        productCount: Number(category.productCount),
      })),
    });
  } catch (error) {
    return next(error);
  }
}

export async function getStoreAdminPlan(req, res, next) {
  try {
    const plan = getEffectivePlanStatus(req.store);
    const usage = await withPlanUsage(req.store);

    return res.json({
      planStatus: plan.status,
      expiringSoon: plan.expiringSoon,
      planExpiresAt: req.store.planExpiresAt ?? null,
      planStartedAt: req.store.planStartedAt ?? null,
      ...usage,
    });
  } catch (error) {
    return next(error);
  }
}
