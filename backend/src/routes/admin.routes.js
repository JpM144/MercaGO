import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';
import { listAllOrders, updateOrderStatus } from '../controllers/order.controller.js';

const router = Router();

// Ruta de ejemplo protegida con requireAuth + requireAdmin.
router.get('/stats', requireAuth, requireAdmin, (_req, res) => {
  res.json({ message: 'Acceso de administrador concedido.', user: _req.user });
});

router.get('/orders', requireAuth, requireAdmin, listAllOrders);
router.put('/orders/:id/status', requireAuth, requireAdmin, updateOrderStatus);

export default router;
