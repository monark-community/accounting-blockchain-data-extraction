/**
 * Classification Service
 */
import prisma from '../config/database';
import { TransactionCategory } from '../types';
import logger from '../utils/logger';

export class ClassificationService {
  async classifyTransaction(
    transactionId: string,
    category: TransactionCategory,
    isInternal: boolean,
    notes?: string,
    tags?: string[]
  ): Promise<void> {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { category, isInternal, notes }
    });

    if (tags && tags.length > 0) {
      await prisma.transactionTag.deleteMany({ where: { transactionId } });
      await prisma.transactionTag.createMany({
        data: tags.map(tag => ({ transactionId, tag }))
      });
    }

    logger.info('Transaction classified', { transactionId, category });
  }

  async bulkClassify(transactionIds: string[], category: TransactionCategory): Promise<number> {
    const result = await prisma.transaction.updateMany({
      where: { id: { in: transactionIds } },
      data: { category }
    });
    return result.count;
  }
}

export default new ClassificationService();