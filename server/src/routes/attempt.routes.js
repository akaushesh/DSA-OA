import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { verifyAdmin } from '../middlewares/admin.middleware.js';
import {
  startAttempt,
  endAttempt,
  deleteAttempt,
  getAttemptReview,
  myAttempts,
  getMyAttemptedTopics,
  allAttempts,
  saveTimers,
  adjustAttemptTime,
  resetAttempt,
  stopAttempt,
  reevaluateAttempt,
} from '../controllers/attempt.controller.js';

const router = Router();

router.use(verifyJWT);
router.post('/start', startAttempt);
router.put('/:id/end', endAttempt);
router.delete('/:id', deleteAttempt);
router.get('/my', myAttempts);
router.get('/my-topics', getMyAttemptedTopics);
router.get('/all', verifyAdmin, allAttempts);
router.post('/:id/adjust-time', verifyAdmin, adjustAttemptTime);
router.post('/:id/reset', verifyAdmin, resetAttempt);
router.post('/:id/stop', verifyAdmin, stopAttempt);
router.post('/:id/reevaluate', verifyAdmin, reevaluateAttempt);
router.patch('/:id/timers', saveTimers);
router.get('/:id', getAttemptReview);

export default router;
