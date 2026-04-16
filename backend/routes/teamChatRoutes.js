import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  listChannelMessages,
  listUnreadSummary,
  postChannelMessage
} from '../controllers/teamChatController.js';

const router = Router();

router.use(protect);
router.get('/messages', listChannelMessages);
router.post('/messages', postChannelMessage);
router.get('/unread', listUnreadSummary);

export default router;
