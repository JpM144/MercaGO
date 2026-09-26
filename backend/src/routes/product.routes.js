import { Router } from 'express';
import {
  listProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller.js';
import { listProductReviews, createReview } from '../controllers/review.controller.js';
import {
  requireApprovedStore,
  requireAuth,
  requireOwnedProduct,
  requireStoreAdmin,
} from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', listProducts);
router.get('/:slug', getProductBySlug);
router.get('/:id/reviews', listProductReviews);
router.post('/:id/reviews', requireAuth, createReview);
router.post('/', requireStoreAdmin, requireApprovedStore, createProduct);
router.put('/:id', requireStoreAdmin, requireApprovedStore, requireOwnedProduct, updateProduct);
router.delete('/:id', requireStoreAdmin, requireApprovedStore, requireOwnedProduct, deleteProduct);

export default router;
