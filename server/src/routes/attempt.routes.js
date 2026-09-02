import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { verifyAdmin } from '../middlewares/admin.middleware.js';
import {
  startAttempt,
  endAttempt,
  deleteAttempt,
  getAttemptReview,
  myAttempts,
  allAttempts,
} from '../controllers/attempt.controller.js';

const router = Router();

router.use(verifyJWT);
router.post('/start', startAttempt);
router.put('/:id/end', endAttempt);
router.delete('/:id', deleteAttempt);
router.get('/my', myAttempts);
router.get('/all', verifyAdmin, allAttempts);
router.get('/:id', getAttemptReview);

export default router;
