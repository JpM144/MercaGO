import { Router } from 'express';
import {
  applyForStore,
  getMyStore,
  getPublicStore,
  listPublicStores,
  storeProducts,
  storeCategories,
} from '../controllers/store.controller.js';
import { requireStoreAdmin } from '../middleware/auth.middleware.js';

const router = Router();

// Solicitud pública para abrir una tienda (queda 'pending' hasta la revisión de un super admin).
router.post('/apply', applyForStore);
router.get('/me', requireStoreAdmin, getMyStore);

// Endpoints públicos para la vitrina de cada tienda y el home del marketplace.
router.get('/', listPublicStores);
router.get('/:slug/products', storeProducts);
router.get('/:slug/categories', storeCategories);
router.get('/:slug', getPublicStore);

export default router;
