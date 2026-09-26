import { Router } from 'express';
import { shoppingAssistantChat } from '../controllers/shoppingAssistant.controller.js';

const router = Router();

router.post('/chat', shoppingAssistantChat);

export default router;