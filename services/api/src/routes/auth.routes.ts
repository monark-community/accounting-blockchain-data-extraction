import { Router } from 'express';
import { connectWallet, logout } from '../controllers/auth.controller';
import { validate } from '../middlewares/validator';
import Joi from 'joi';

const router = Router();

const connectWalletSchema = Joi.object({
  address: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .required(),
  signature: Joi.string().required(),
  message: Joi.string().required()
});

router.post('/connect', validate(connectWalletSchema), connectWallet);
router.post('/logout', logout);

export default router;