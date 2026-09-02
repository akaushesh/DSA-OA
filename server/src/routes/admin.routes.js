import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { verifyAdmin } from '../middlewares/admin.middleware.js';
import { getStats, listUsers, updateUserRole } from '../controllers/admin.controller.js';

const router = Router();

router.use(verifyJWT, verifyAdmin);
router.get('/stats', getStats);
router.get('/users', listUsers);
router.patch('/users/:id/role', updateUserRole);

export default router;
