import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth';
import { exportData } from '../controllers/export.controller';

const router = Router();
router.use(authenticateJWT);

router.get('/', exportData);

export default router;