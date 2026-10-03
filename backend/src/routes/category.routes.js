import { Router } from 'express';
import { listCategories } from '../controllers/category.controller.js';

const router = Router();

// Sólo lectura pública: los nombres de categoría del marketplace.
// La gestión de categorías es privada y vive en /api/store-admin/categories.
router.get('/', listCategories);

export default router;
