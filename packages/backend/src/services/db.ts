import knex from 'knex';
import { logger } from '../utils/logger';

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'carbonloop',
    user: process.env.DB_USER || 'carbonloop_user',
    password: process.env.DB_PASSWORD || '',
  },
  pool: {
    min: 2,
    max: 20,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 600000,
  },
  asyncStackTraces: process.env.NODE_ENV === 'development',
});

// Test connection on startup
db.raw('SELECT 1')
  .then(() => logger.info('Database connected successfully'))
  .catch((err: Error) => {
    logger.error('Database connection failed', { error: err.message });
    // Do not exit - let app start and fail gracefully on first query
  });

export default db;
