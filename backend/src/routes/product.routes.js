import { Router } from 'express';
import {
  listProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller.js';
import { listProductReviews, createReview } from '../controllers/review.controller.js';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', listProducts);
router.get('/:slug', getProductBySlug);
router.get('/:id/reviews', listProductReviews);
router.post('/:id/reviews', requireAuth, createReview);
router.post('/', requireAdmin, createProduct);
router.put('/:id', requireAdmin, updateProduct);
router.delete('/:id', requireAdmin, deleteProduct);

export default router;
