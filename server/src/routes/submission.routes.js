import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { submitCode, runCustom, getSubmission, mySubmissions } from '../controllers/submission.controller.js';

const router = Router();

router.use(verifyJWT);
router.post('/custom', runCustom);
router.post('/', submitCode);
router.get('/my', mySubmissions);
router.get('/:id', getSubmission);

export default router;
