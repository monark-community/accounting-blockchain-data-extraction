/**
 * Report Controller
 */
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import reportService from '../services/report.service';

export const getSummary = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { startDate, endDate } = req.query;

    const summary = await reportService.calculateSummary(
      req.userId!,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json(summary);
  } catch (error) {
    next(error);
  }
};

export const getByCategory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await reportService.getByCategory(req.userId!);
    res.json(data);
  } catch (error) {
    next(error);
  }
};