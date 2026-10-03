import { Router } from 'express';
import { listPlanTiers } from '../controllers/planTier.controller.js';

const router = Router();

// Público: los niveles de plan se muestran en el registro y en el panel.
router.get('/', listPlanTiers);

export default router;
