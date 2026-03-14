import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth';
import {
  listWallets,
  createWallet,
  deleteWallet,
  syncWallet
} from '../controllers/wallet.controller';
import { validate } from '../middlewares/validator';
import Joi from 'joi';
import { SUPPORTED_CHAINS } from '../types';

const router = Router();
router.use(authenticateJWT);

const createWalletSchema = Joi.object({
  address: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .required(),
  chain: Joi.string()
    .valid(...SUPPORTED_CHAINS)
    .required(),
  label: Joi.string().optional()
});

router.get('/', listWallets);
router.post('/', validate(createWalletSchema), createWallet);
router.delete('/:id', deleteWallet);
router.post('/:id/sync', syncWallet);

export default router;