import { Router } from 'express';
import { storeApplicationAssistantChat } from '../controllers/storeApplicationAssistant.controller.js';

const router = Router();

router.post('/chat', storeApplicationAssistantChat);

export default router;