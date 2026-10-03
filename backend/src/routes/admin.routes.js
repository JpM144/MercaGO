import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';
import { listAllOrders, updateOrderStatus } from '../controllers/order.controller.js';
import {
  listStoreApplications,
  approveApplication,
  rejectApplication,
} from '../controllers/storeApplication.controller.js';

const router = Router();

// Ruta de ejemplo protegida con requireAuth + requireAdmin.
router.get('/stats', requireAuth, requireAdmin, (_req, res) => {
  res.json({ message: 'Acceso de administrador concedido.', user: _req.user });
});

router.get('/orders', requireAuth, requireAdmin, listAllOrders);
router.put('/orders/:id/status', requireAuth, requireAdmin, updateOrderStatus);

// Gestión de solicitudes de tienda: admin/super_admin revisa y aprueba o rechaza.
router.get('/store-applications', requireAuth, requireAdmin, listStoreApplications);
router.put('/store-applications/:id/approve', requireAuth, requireAdmin, approveApplication);
router.put('/store-applications/:id/reject', requireAuth, requireAdmin, rejectApplication);

export default router;
