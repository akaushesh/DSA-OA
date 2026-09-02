import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { submitCode, getSubmission, mySubmissions } from '../controllers/submission.controller.js';

const router = Router();

router.use(verifyJWT);
router.post('/', submitCode);
router.get('/my', mySubmissions);
router.get('/:id', getSubmission);

export default router;
