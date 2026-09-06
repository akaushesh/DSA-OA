import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { verifyAdmin } from '../middlewares/admin.middleware.js';
import {
  createQuestionSet,
  importQuestionSet,
  listQuestionSets,
  getQuestionSet,
  updateQuestionSet,
  deleteQuestionSet,
  reevaluateQuestionSet,
} from '../controllers/questionset.controller.js';

const router = Router();

// User & Admin: Create and JSON import question sets
router.post('/', verifyJWT, createQuestionSet);
router.post('/import', verifyJWT, importQuestionSet);
router.post('/admin', verifyJWT, createQuestionSet);
router.post('/admin/import', verifyJWT, importQuestionSet);

// Reevaluate question set scores for all candidates (Admin only)
router.post('/:id/reevaluate', verifyJWT, verifyAdmin, reevaluateQuestionSet);
router.post('/admin/:id/reevaluate', verifyJWT, verifyAdmin, reevaluateQuestionSet);

// Edit and Delete (creator or admin check inside controller)
router.put('/:id', verifyJWT, updateQuestionSet);
router.delete('/:id', verifyJWT, deleteQuestionSet);
router.put('/admin/:id', verifyJWT, updateQuestionSet);
router.delete('/admin/:id', verifyJWT, deleteQuestionSet);

// Both roles — admin sees all (with ?adminView=true), user sees published
router.get('/', verifyJWT, listQuestionSets);
router.get('/:id', verifyJWT, getQuestionSet);

export default router;
