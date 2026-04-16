import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getUsageSummary, recordUsageTick } from '../controllers/usageController.js';

const router = Router();

router.use(protect);
router.post('/tick', recordUsageTick);
router.get('/summary', getUsageSummary);

export default router;
