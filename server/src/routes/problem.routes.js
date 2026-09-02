import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { verifyAdmin } from '../middlewares/admin.middleware.js';
import {
  createProblem,
  listProblems,
  getProblemAdmin,
  updateProblem,
  deleteProblem,
  getProblemUser,
} from '../controllers/problem.controller.js';

const router = Router();

// Problem creation & listing for all authenticated users
router.get('/', verifyJWT, listProblems);
router.post('/', verifyJWT, createProblem);

// Admin-specific routes
router.get('/admin', verifyJWT, listProblems);
router.post('/admin', verifyJWT, createProblem);
router.get('/admin/:id', verifyJWT, verifyAdmin, getProblemAdmin);
router.put('/admin/:id', verifyJWT, verifyAdmin, updateProblem);
router.delete('/admin/:id', verifyJWT, verifyAdmin, deleteProblem);

// User route (no hidden TC content)
router.get('/:id', verifyJWT, getProblemUser);

export default router;
