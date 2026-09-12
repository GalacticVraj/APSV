import Redis from 'ioredis';
import { logger } from '../utils/logger';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!redis) {
    try {
      redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        connectTimeout: 5000,
      });

      redis.on('connect', () => logger.info('Redis connected'));
      redis.on('error', (err) => {
        logger.warn('Redis error (non-fatal, will use in-memory fallback)', { error: err.message });
        redis = null;
      });
    } catch (err) {
      logger.warn('Redis initialization failed, running without cache');
      return null;
    }
  }
  return redis;
}

// Cache helper with TTL - falls back gracefully if Redis unavailable
export async function cacheGet(key: string): Promise<string | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    return await r.get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds = 300): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.setex(key, ttlSeconds, value);
  } catch {
    // Non-fatal
  }
}

export async function cacheDel(key: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.del(key);
  } catch {
    // Non-fatal
  }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    const keys = await r.keys(pattern);
    if (keys.length > 0) {
      await r.del(...keys);
    }
  } catch {
    // Non-fatal
  }
}
