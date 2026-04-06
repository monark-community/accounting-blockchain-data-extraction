import { Request, Response, NextFunction } from "express";
import { ObjectSchema } from "joi";

/**
 * Joi validation middleware
 */
export const validate = (schema: ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);

    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((d) => d.message),
      });
    }

    next();
  };
};