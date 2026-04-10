import express, { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import logger from './utils/logger';
import prisma from './config/database';

// Charger les variables d'environnement
dotenv.config();

// Import routes
import authRoutes from './routes/auth.routes';
import walletRoutes from './routes/wallet.routes';

const app = express();
const PORT = process.env.PORT || 5000;

// =====================
// MIDDLEWARES DE SÉCURITÉ
// =====================

// Helmet - Sécurise les headers HTTP
app.use(helmet());

// CORS - Configure les origines autorisées
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting - Limite les requêtes par IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requêtes par fenêtre
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =====================
// LOGGING DES REQUÊTES
// =====================

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // Log quand la réponse est terminée
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request processed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  });

  next();
});

// =====================
// HEALTH CHECK
// =====================

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// =====================
// ROUTES API
// =====================

app.use('/api/auth', authRoutes);
app.use('/api/wallets', walletRoutes);

// =====================
// 404 HANDLER
// =====================

app.use((req: Request, res: Response) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.path
  });
});

// =====================
// GESTION GLOBALE DES ERREURS
// =====================

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // Logger l'erreur
  logger.error('Error occurred', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    statusCode: err.statusCode || 500
  });

  // Déterminer le status code
  const statusCode = err.statusCode || 500;

  // Ne pas exposer les détails d'erreur en production
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal server error'
    : err.message || 'Internal server error';

  // Réponse d'erreur
  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
      // Stack trace seulement en développement
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

app.use(errorHandler);

// =====================
// GESTION DES ERREURS NON CATCHÉES
// =====================

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', {
    message: error.message,
    stack: error.stack
  });
  // Donner le temps de logger avant de sortir
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
});

// =====================
// DÉMARRAGE DU SERVEUR
// =====================

const startServer = async () => {
  try {
    // Connexion à la base de données
    await prisma.$connect();
    logger.info('Database connected successfully');

    // Démarrer le serveur
    app.listen(PORT, () => {
      logger.info('Server started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version
      });
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
};

// Gestion du shutdown gracieux
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();

export default app;