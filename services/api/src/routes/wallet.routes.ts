import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware'; // ✅ corrigé
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

/**
 * Middleware d'authentification (appliqué à toutes les routes)
 */
router.use(authenticate);

/**
 * Validation schema
 */
const createWalletSchema = Joi.object({
  address: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .required(),
  chain: Joi.string()
    .valid(...SUPPORTED_CHAINS)
    .required(),
  label: Joi.string().optional()
});

/**
 * Routes
 */
router.get('/', listWallets);

router.post(
  '/',
  validate(createWalletSchema),
  createWallet
);

router.delete('/:id', deleteWallet);

router.post('/:id/sync', syncWallet);

export default router;