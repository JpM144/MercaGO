import { Router } from 'express';
import { salesAssistantChat } from '../controllers/salesAssistant.controller.js';
import { listStoreAdminProducts } from '../controllers/product.controller.js';
import {
  listStoreOrders,
  getStoreOrder,
  updateStoreOrderStatus,
} from '../controllers/order.controller.js';
import { getStoreAdminPlan } from '../controllers/store.controller.js';
import {
  listStoreCategories,
  createStoreCategory,
  updateStoreCategory,
  deleteStoreCategory,
} from '../controllers/category.controller.js';
import {
  createPlanChangeRequest,
  getMyPlanChangeRequestReceipt,
  listMyPlanChangeRequests,
} from '../controllers/planChangeRequest.controller.js';
import {
  getStoreReport,
  getReportTimeseries,
  getTopProducts,
} from '../controllers/reports.controller.js';
import { requireApprovedStore, requireStoreAdmin } from '../middleware/auth.middleware.js';
import { handlePlanReceiptUpload } from '../middleware/upload.middleware.js';

const router = Router();

router.get('/plan', requireStoreAdmin, getStoreAdminPlan);
router.get(
  '/plan-change-requests',
  requireStoreAdmin,
  requireApprovedStore,
  listMyPlanChangeRequests,
);
router.post(
  '/plan-change-requests',
  requireStoreAdmin,
  requireApprovedStore,
  handlePlanReceiptUpload,
  createPlanChangeRequest,
);
router.get('/plan-change-requests/:id/receipt', requireStoreAdmin, getMyPlanChangeRequestReceipt);
router.get('/products', requireStoreAdmin, requireApprovedStore, listStoreAdminProducts);
router.post('/sales-assistant/chat', requireStoreAdmin, requireApprovedStore, salesAssistantChat);

router.get('/categories', requireStoreAdmin, requireApprovedStore, listStoreCategories);
router.post('/categories', requireStoreAdmin, requireApprovedStore, createStoreCategory);
router.put('/categories/:id', requireStoreAdmin, requireApprovedStore, updateStoreCategory);
router.delete('/categories/:id', requireStoreAdmin, requireApprovedStore, deleteStoreCategory);

router.get('/reports', requireStoreAdmin, requireApprovedStore, getStoreReport);
router.get('/reports/timeseries', requireStoreAdmin, requireApprovedStore, getReportTimeseries);
router.get('/reports/top-products', requireStoreAdmin, requireApprovedStore, getTopProducts);

router.get('/orders', requireStoreAdmin, requireApprovedStore, listStoreOrders);
router.get('/orders/:id', requireStoreAdmin, requireApprovedStore, getStoreOrder);
router.put('/orders/:id/status', requireStoreAdmin, requireApprovedStore, updateStoreOrderStatus);

export default router;
