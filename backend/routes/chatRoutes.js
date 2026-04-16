import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
const disabledResponse = (_req, res) =>
  res.status(410).json({ message: 'Direct messages are disabled' });

const router = Router();
router.use(protect);

router.get('/', disabledResponse);
router.post('/', disabledResponse);
router.get('/:id', disabledResponse);
router.get('/:id/messages', disabledResponse);
router.post('/:id/messages', disabledResponse);

export default router;
