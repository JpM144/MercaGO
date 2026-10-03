import db from '../models/index.js';

const REVIEW_FIELDS = ['id', 'rating', 'comment', 'photoUrl', 'created_at'];

function reviewAverage(reviews) {
  return reviews.length
    ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
    : null;
}

export async function listProductReviews(req, res, next) {
  try {
    const productId = Number(req.params.id);
    const product = await db.Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    const reviews = await db.Review.findAll({
      where: { productId },
      attributes: REVIEW_FIELDS,
      include: [{ model: db.User, as: 'user', attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']],
    });

    return res.json({
      productId,
      ratingAverage: reviewAverage(reviews),
      ratingCount: reviews.length,
      reviews,
    });
  } catch (error) {
    return next(error);
  }
}

export async function createReview(req, res, next) {
  try {
    const productId = Number(req.params.id);
    const product = await db.Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    const { rating, comment } = req.body ?? {};
    const ratingNum = Number(rating);

    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'rating debe ser un entero entre 1 y 5.' });
    }
    if (comment !== undefined && (typeof comment !== 'string' || comment.length > 2000)) {
      return res.status(400).json({ error: 'comment debe ser un texto de hasta 2000 caracteres.' });
    }

    const existing = await db.Review.findOne({
      where: { productId, userId: req.user.id },
    });
    if (existing) {
      return res.status(409).json({ error: 'Ya reseñaste este producto.' });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'La foto del producto es obligatoria (JPG, PNG o WebP, máx. 5 MB).',
      });
    }

    const review = await db.Review.create({
      productId,
      userId: req.user.id,
      rating: ratingNum,
      comment: comment ?? null,
      photoUrl: `/uploads/reviews/${req.file.filename}`,
    });

    const created = await db.Review.findByPk(review.id, {
      attributes: REVIEW_FIELDS,
      include: [{ model: db.User, as: 'user', attributes: ['id', 'name'] }],
    });

    return res.status(201).json({ review: created });
  } catch (error) {
    return next(error);
  }
}
