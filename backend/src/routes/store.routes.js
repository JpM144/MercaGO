import { Router } from 'express';
import {
  getMyStore,
  getPublicStore,
  listPublicStores,
  storeProducts,
  storeCategories,
} from '../controllers/store.controller.js';
import { applyForStore } from '../controllers/storeApplication.controller.js';
import { requireStoreAdmin } from '../middleware/auth.middleware.js';

const router = Router();

// Solicitud pública para abrir una tienda (crea una store_application hasta su revisión).
router.post('/apply', applyForStore);
router.get('/me', requireStoreAdmin, getMyStore);

// Endpoints públicos para la vitrina de cada tienda y el home del marketplace.
router.get('/', listPublicStores);
router.get('/:slug/products', storeProducts);
router.get('/:slug/categories', storeCategories);
router.get('/:slug', getPublicStore);

export default router;
