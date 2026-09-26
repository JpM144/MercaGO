import { Router } from 'express';
import { requireAuth, requireAdmin, requireSuperAdmin } from '../middleware/auth.middleware.js';
import { listAllOrders, updateOrderStatus } from '../controllers/order.controller.js';
import { listStores, updateStoreStatus } from '../controllers/store.controller.js';

const router = Router();

// Ruta de ejemplo protegida con requireAuth + requireAdmin.
router.get('/stats', requireAuth, requireAdmin, (_req, res) => {
  res.json({ message: 'Acceso de administrador concedido.', user: _req.user });
});

router.get('/orders', requireAuth, requireAdmin, listAllOrders);
router.put('/orders/:id/status', requireAuth, requireAdmin, updateOrderStatus);

// Gestión de tiendas: solo super_admin aprueba/rechaza.
router.get('/stores', requireSuperAdmin, listStores);
router.put('/stores/:id/status', requireSuperAdmin, updateStoreStatus);

export default router;
