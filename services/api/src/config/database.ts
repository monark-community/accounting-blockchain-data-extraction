import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

/**
 * Prisma Client instance
 * Singleton pattern to avoid multiple instances
 */
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn']  // Verbose logging in development
    : ['error'],                   // Only errors in production
});

/**
 * Connect to database on startup
 */
prisma.$connect()
  .then(() => {
    logger.info('✅ Database connected successfully');
  })
  .catch((error) => {
    logger.error('❌ Database connection failed:', error);
    process.exit(1);  // Exit if database connection fails
  });

/**
 * Graceful shutdown handler
 * Disconnect from database when process terminates
 */
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  logger.info('Database disconnected');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  logger.info('Database disconnected');
  process.exit(0);
});

export default prisma;
