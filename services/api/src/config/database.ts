/**
 * Database Configuration
 * Prisma Client singleton instance
 */

import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prisma =
  global.prisma ||
  new PrismaClient({
    log: ['error', 'warn'] // ✅ Prisma v5 compatible
  });

// Prevent multiple instances in development (hot reload)
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Test connection
prisma.$connect()
  .then(() => {
    logger.info('Database connected successfully');
  })
  .catch((error) => {
    logger.error('Database connection failed:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  logger.info('Database disconnected');
});

export default prisma;