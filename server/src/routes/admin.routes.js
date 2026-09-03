import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { verifyAdmin } from '../middlewares/admin.middleware.js';
import { getStats, listUsers, updateUserRole, getUserDetails } from '../controllers/admin.controller.js';

const router = Router();

router.use(verifyJWT, verifyAdmin);
router.get('/stats', getStats);
router.get('/users', listUsers);
router.get('/users/:id/details', getUserDetails);
router.patch('/users/:id/role', updateUserRole);

export default router;
