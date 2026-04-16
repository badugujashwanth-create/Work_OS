import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { listMyTeams, listTeamChannels } from '../controllers/teamController.js';

const router = Router();

router.use(protect);
router.get('/me', listMyTeams);
router.get('/:id/channels', listTeamChannels);

export default router;
