import { Router } from 'express';
import { createOrder, listMyOrders, getOrder } from '../controllers/order.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/', requireAuth, createOrder);
router.get('/', requireAuth, listMyOrders);
router.get('/:id', requireAuth, getOrder);

export default router;
