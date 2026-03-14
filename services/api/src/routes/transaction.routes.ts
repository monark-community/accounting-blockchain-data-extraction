import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth';
import {
  listTransactions,
  updateTransaction,
  bulkClassify
} from '../controllers/transaction.controller';
import { validate } from '../middlewares/validator';
import Joi from 'joi';
import { TRANSACTION_CATEGORIES } from '../types';

const router = Router();
router.use(authenticateJWT);

const updateTransactionSchema = Joi.object({
  category: Joi.string().valid(...TRANSACTION_CATEGORIES),
  isInternal: Joi.boolean().optional(),
  notes: Joi.string().optional().allow(''),
  tags: Joi.array().items(Joi.string()).optional()
});

const bulkClassifySchema = Joi.object({
  transactionIds: Joi.array().items(Joi.string()).min(1).required(),
  category: Joi.string().valid(...TRANSACTION_CATEGORIES).required()
});

router.get('/', listTransactions);
router.put('/:id', validate(updateTransactionSchema), updateTransaction);
router.post('/bulk-classify', validate(bulkClassifySchema), bulkClassify);

export default router;