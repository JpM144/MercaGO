import { Router } from 'express';
import { salesAssistantChat } from '../controllers/salesAssistant.controller.js';
import { requireApprovedStore, requireStoreAdmin } from '../middleware/auth.middleware.js';

const router = Router();

router.post(
  '/sales-assistant/chat',
  requireStoreAdmin,
  requireApprovedStore,
  salesAssistantChat,
);

export default router;