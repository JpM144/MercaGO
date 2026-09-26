import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import db from '../models/index.js';
import { slugify, uniqueSlug } from '../utils/slug.util.js';
import { toDetailJson, querySiteProducts } from './product.controller.js';

const SALT_ROUNDS = 10;
const PASSWORD_MIN = 6;
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

export async function applyForStore(req, res, next) {
  try {
    const payload = req.body ?? {};
    const name = payload.name;
    const whatsapp = payload.whatsapp_number ?? payload.whatsappNumber;
    const description = payload.description ?? null;
    const ownerName = payload.owner?.name ?? payload.owner_name;
    const email = payload.owner?.email ?? payload.owner_email;
    const password = payload.owner?.password ?? payload.owner_password;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name (nombre del negocio) es obligatorio.' });
    }
    if (!whatsapp || typeof whatsapp !== 'string') {
      return res.status(400).json({ error: 'whatsapp_number (del negocio) es obligatorio.' });
    }
    if (!ownerName || typeof ownerName !== 'string') {
      return res.status(400).json({ error: 'owner.name es obligatorio.' });
    }
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'owner.email es obligatorio.' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'owner.password es obligatorio.' });
    }
    if (password.length < PASSWORD_MIN) {
      return res
        .status(400)
        .json({ error: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.` });
    }

    const existing = await db.User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email.' });
    }

    const storeSlug = await uniqueSlug(db.Store, slugify(name));
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await db.sequelize.transaction(async (t) => {
      const user = await db.User.create(
        { name: ownerName, email, passwordHash, role: 'store_admin' },
        { transaction: t },
      );
      const store = await db.Store.create(
        {
          name,
          slug: storeSlug,
          whatsappNumber: whatsapp,
          description,
          ownerUserId: user.id,
          status: 'pending',
        },
        { transaction: t },
      );
      return { user, store };
    });

    return res.status(201).json({
      message:
        'Tu solicitud quedó pendiente de revisión. Te avisaremos cuando tu tienda sea aprobada.',
      store: {
        id: result.store.id,
        name: result.store.name,
        slug: result.store.slug,
        status: result.store.status,
      },
      owner: { name: result.user.name, email: result.user.email, role: result.user.role },
    });
  } catch (error) {
    return next(error);
  }
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

export async function listStores(req, res, next) {
  try {
    const stores = await db.Store.findAll({
      order: [['createdAt', 'DESC']],
      include: [
        { model: db.User, as: 'owner', attributes: ['id', 'name', 'email'] },
        { model: db.Product, as: 'products', attributes: ['id'], required: false },
      ],
    });

    return res.json({
      stores: stores.map((store) => {
        const json = store.get({ plain: true });
        const { products, ...rest } = json;
        delete rest.ownerUserId;
        return { ...rest, productCount: products.length };
      }),
    });
  } catch (error) {
    return next(error);
  }
}

export async function getPublicStore(req, res, next) {
  try {
    const store = await db.Store.findOne({
      where: { slug: req.params.slug, status: 'approved' },
      attributes: [...PUBLIC_STORE_FIELDS, 'createdAt'],
      include: [{ model: db.Product, as: 'products', attributes: ['id'], required: false }],
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
      where: { status: 'approved' },
      order: [['createdAt', 'DESC']],
      include: [{ model: db.Product, as: 'products', attributes: ['id'], required: false }],
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
      where: { slug: req.params.slug, status: 'approved' },
      attributes: ['id', 'name', 'slug'],
    });

    if (!store) {
      return res.status(404).json({ error: 'Tienda no encontrada o no está aprobada.' });
    }

    if (req.query.featured === 'true') {
      const products = await db.Product.findAll({
        where: { storeId: store.id, stock: { [Op.gt]: 0 } },
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
      where: { slug: req.params.slug, status: 'approved' },
      attributes: ['id', 'name', 'slug'],
    });

    if (!store) {
      return res.status(404).json({ error: 'Tienda no encontrada o no está aprobada.' });
    }

    const categories = await db.sequelize.query(
      `SELECT c.id, c.name, c.slug, COUNT(p.id)::int AS "productCount"
       FROM categories c
       JOIN products p ON p.category_id = c.id AND p.store_id = :storeId AND p.stock > 0
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

export async function updateStoreStatus(req, res, next) {
  try {
    const { status: nextStatus } = req.body ?? {};
    const rejectedReason = req.body?.rejected_reason ?? req.body?.rejectedReason ?? null;

    if (!['approved', 'rejected'].includes(nextStatus)) {
      return res.status(400).json({
        error: 'status inválido. Valores permitidos: approved, rejected.',
      });
    }

    const store = await db.Store.findByPk(req.params.id);
    if (!store) {
      return res.status(404).json({ error: 'Tienda no encontrada.' });
    }
    if (store.status !== 'pending') {
      return res
        .status(400)
        .json({ error: 'Solo se pueden aprobar o rechazar tiendas en estado pending.' });
    }
    if (nextStatus === 'rejected' && !rejectedReason) {
      return res.status(400).json({ error: 'rejected_reason es obligatorio al rechazar.' });
    }

    await store.update({
      status: nextStatus,
      rejectedReason: nextStatus === 'rejected' ? rejectedReason : null,
    });

    return res.json({ store });
  } catch (error) {
    return next(error);
  }
}
