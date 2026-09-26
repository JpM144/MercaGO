import db from '../models/index.js';
import { toDetailJson } from './product.controller.js';

const PRODUCT_ATTRIBUTES = [
  'id',
  'name',
  'slug',
  'description',
  'price',
  'originalPrice',
  'stock',
  'imageUrl',
  'createdAt',
];

export async function listFavorites(req, res, next) {
  try {
    const favorites = await db.Favorite.findAll({
      where: { userId: req.user.id },
      order: [['created_at', 'DESC']],
      attributes: ['id', 'created_at'],
      include: [
        {
          model: db.Product,
          as: 'product',
          attributes: PRODUCT_ATTRIBUTES,
          required: true,
          include: [
            {
              model: db.Store,
              as: 'store',
              attributes: ['id', 'name', 'slug'],
              where: { status: 'approved' },
              required: true,
            },
            { model: db.Category, as: 'category', attributes: ['id', 'name', 'slug'] },
          ],
        },
      ],
    });

    return res.json({
      favorites: favorites.map((favorite) => ({
        id: favorite.id,
        favoritedAt: favorite.getDataValue('created_at'),
        product: toDetailJson(favorite.product),
      })),
    });
  } catch (error) {
    return next(error);
  }
}

export async function addFavorite(req, res, next) {
  try {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: 'productId debe ser un número válido.' });
    }

    const product = await db.Product.findByPk(productId, {
      attributes: ['id'],
    });
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    const [favorite, created] = await db.Favorite.findOrCreate({
      where: { userId: req.user.id, productId },
    });

    return res.status(created ? 201 : 200).json({
      favorite: {
        id: favorite.id,
        productId,
        favoritedAt: favorite.created_at,
      },
      message: created
        ? 'Producto agregado a favoritos.'
        : 'El producto ya estaba en tus favoritos.',
    });
  } catch (error) {
    return next(error);
  }
}

export async function removeFavorite(req, res, next) {
  try {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: 'productId debe ser un número válido.' });
    }

    const product = await db.Product.findByPk(productId, { attributes: ['id'] });
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    const favorite = await db.Favorite.findOne({
      where: { userId: req.user.id, productId },
    });
    if (!favorite) {
      return res.status(404).json({ error: 'El producto no estaba en tus favoritos.' });
    }

    await favorite.destroy();
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}
