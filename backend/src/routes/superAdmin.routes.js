import { Router } from 'express';
import { requireSuperAdmin } from '../middleware/auth.middleware.js';
import {
  listStores,
  pauseStore,
  reactivateStore,
  cancelStore,
  listAuditLogs,
} from '../controllers/superAdmin.controller.js';
import {
  listPlanChangeRequests,
  approvePlanChangeRequest,
  getPlanChangeRequestReceipt,
  rejectPlanChangeRequest,
} from '../controllers/planChangeRequest.controller.js';

const router = Router();

router.use(requireSuperAdmin);

router.get('/plan-change-requests', listPlanChangeRequests);
router.get('/plan-change-requests/:id/receipt', getPlanChangeRequestReceipt);
router.put('/plan-change-requests/:id/approve', approvePlanChangeRequest);
router.put('/plan-change-requests/:id/reject', rejectPlanChangeRequest);

router.get('/stores', listStores);
router.put('/stores/:id/pause', pauseStore);
router.put('/stores/:id/reactivate', reactivateStore);
router.put('/stores/:id/cancel', cancelStore);
router.get('/audit-log', listAuditLogs);

export default router;
