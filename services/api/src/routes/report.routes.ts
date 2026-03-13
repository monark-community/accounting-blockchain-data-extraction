import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth';
import { getSummary, getByCategory } from '../controllers/report.controller';

const router = Router();
router.use(authenticateJWT);

router.get('/summary', getSummary);
router.get('/by-category', getByCategory);

export default router;