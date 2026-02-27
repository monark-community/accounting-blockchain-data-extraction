import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import logger from './utils/logger';
import { errorHandler } from './middlewares/errorHandler';

// Load environment variables
dotenv.config();

// Create Express application
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Helmet - Secure HTTP headers
app.use(helmet());

// CORS - Allow requests from frontend
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting - Prevent abuse
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),      // 100 requests per window
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// ============================================
// BODY PARSING MIDDLEWARE
// ============================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ============================================
// ROOT ENDPOINT
// ============================================

app.get('/', (_req, res) => {
  res.json({
    message: 'LedgerLift API v1.0',
    description: 'Blockchain accounting and reporting platform',
    documentation: '/api-docs',
    health: '/health',
  });
});

// ============================================
// API ROUTES
// ============================================

// Routes will be added here by Vassy
// Example:
// import authRoutes from './routes/auth.routes';
// import walletRoutes from './routes/wallet.routes';
// import transactionRoutes from './routes/transaction.routes';
// 
// app.use('/api/auth', authRoutes);
// app.use('/api/wallets', authenticateJWT, walletRoutes);
// app.use('/api/transactions', authenticateJWT, transactionRoutes);

// ============================================
// 404 HANDLER
// ============================================

app.use((_req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
  });
});

// ============================================
// ERROR HANDLER (must be last)
// ============================================

app.use(errorHandler);

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
  logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔒 CORS enabled for: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
});

// Export app for testing
export default app;
