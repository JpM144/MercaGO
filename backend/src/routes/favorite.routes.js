import { Router } from 'express';
import { listFavorites, addFavorite, removeFavorite } from '../controllers/favorite.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', requireAuth, listFavorites);
router.post('/:productId', requireAuth, addFavorite);
router.delete('/:productId', requireAuth, removeFavorite);

export default router;
