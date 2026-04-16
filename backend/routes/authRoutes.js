import { Router } from 'express';
import {
  login,
  register,
  profile,
  refreshSession,
  logout
} from '../controllers/authController.js';
import { acceptInvite } from '../controllers/inviteController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();
router.post('/register', register);
router.post('/accept-invite', acceptInvite);
router.post('/login', login);
router.post('/refresh', refreshSession);
router.post('/logout', logout);
router.get('/me', protect, profile);

export default router;
