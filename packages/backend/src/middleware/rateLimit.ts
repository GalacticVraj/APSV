import rateLimit from 'express-rate-limit';

// General rate limiter: 200 requests per 15 minutes per IP
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in 15 minutes' },
});

// Strict limiter for auth endpoints: 20 attempts per 15 minutes
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again in 15 minutes' },
});

// AI endpoint limiter: 30 requests per minute (cost control)
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI rate limit exceeded, please wait a moment before trying again' },
});
