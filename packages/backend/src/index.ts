import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { errorHandler } from './middleware/errorHandler';
import { generalRateLimiter } from './middleware/rateLimit';
import { initializeSocket } from './services/socket';
import { logger } from './utils/logger';

// Route imports
import authRoutes from './routes/auth';
import generatorRoutes from './routes/generators';
import facilityRoutes from './routes/facilities';
import listingRoutes from './routes/listings';
import matchRoutes from './routes/matches';
import pickupRoutes from './routes/pickups';
import routeRoutes from './routes/routes';
import adminRoutes from './routes/admin';
import aiRoutes from './routes/ai';
import notificationRoutes from './routes/notifications';
import reportRoutes from './routes/reports';
import statsRoutes from './routes/stats';
import economicsRoutes from './routes/economics';

const app = express();
const httpServer = createServer(app);

// Socket.IO setup
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
});

initializeSocket(io);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for API server
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(compression());

// Rate limiting on all public routes
app.use('/api', generalRateLimiter);

// Health check (no auth, no rate limit)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/generators', generatorRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/pickups', pickupRoutes);
app.use('/api/logistics-routes', routeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/economics', economicsRoutes);

// Global error handler (must be last)
app.use(errorHandler);

const PORT = parseInt(process.env.PORT || '3001', 10);

if (process.env.AI_PROVIDER === 'groq' && !process.env.GROQ_API_KEY) {
  logger.error('CRITICAL: AI_PROVIDER is set to groq, but GROQ_API_KEY is missing from the environment. Failing fast.');
  process.exit(1);
}

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    logger.info(`CarbonLoop API running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

export default app;
