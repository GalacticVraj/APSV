import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

interface AuthSocket extends Socket {
  userId?: string;
  userRole?: string;
}

export function initializeSocket(io: SocketIOServer): void {
  // Authenticate socket connections with JWT
  io.use((socket: AuthSocket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) {
      // Allow unauthenticated connections for public stats
      return next();
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as {
        id: string;
        role: string;
      };
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch {
      // Allow connection but without auth - they join only public rooms
      next();
    }
  });

  io.on('connection', (socket: AuthSocket) => {
    logger.debug('Socket connected', { socketId: socket.id, userId: socket.userId });

    // Join user-specific room for targeted notifications
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
      logger.debug('Socket joined user room', { userId: socket.userId });
    }

    // Join public stats room
    socket.join('public:stats');

    socket.on('disconnect', () => {
      logger.debug('Socket disconnected', { socketId: socket.id });
    });

    socket.on('error', (err) => {
      logger.error('Socket error', { socketId: socket.id, error: err.message });
    });
  });
}

// Helper to emit to a specific user
export function emitToUser(io: SocketIOServer, userId: string, event: string, data: unknown): void {
  io.to(`user:${userId}`).emit(event, data);
}

// Helper to broadcast platform stats update
export function emitStatsUpdate(io: SocketIOServer, stats: unknown): void {
  io.to('public:stats').emit('stats:update', stats);
}
