import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from '../utils/errors';

/**
 * Validation middleware factory
 * Creates a middleware that validates request body against a Joi schema
 * 
 * @param schema - Joi validation schema
 * @returns Express middleware function
 * 
 * @example
 * const createWalletSchema = Joi.object({
 *   address: Joi.string().required(),
 *   chain: Joi.string().required()
 * });
 * 
 * router.post('/wallets', validate(createWalletSchema), createWallet);
 */
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { 
      abortEarly: false  // Return all errors, not just the first
    });

    if (error) {
      // Combine all error messages into one string
      const message = error.details.map((d) => d.message).join(', ');
      return next(new ValidationError(message));
    }

    next();
  };
};
