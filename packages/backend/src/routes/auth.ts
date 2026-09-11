import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import db from '../services/db';
import { authRateLimiter } from '../middleware/rateLimit';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['generator', 'facility_operator', 'logistics_partner', 'municipal_admin']),
  org_name: z.string().min(2).max(200),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function generateTokens(user: { id: string; email: string; role: UserRole }) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  return { accessToken, refreshToken };
}

// POST /api/auth/register
router.post('/register', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = registerSchema.parse(req.body);

    // Check for existing user
    const existing = await db('users').where({ email: body.email }).first();
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const userId = uuidv4();

    await db.transaction(async (trx) => {
      await trx('users').insert({
        id: userId,
        email: body.email,
        password_hash: passwordHash,
        role: body.role,
        verified: false,
        profile_verified: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await trx('profiles').insert({
        id: uuidv4(),
        user_id: userId,
        org_name: body.org_name,
        phone: body.phone || null,
        created_at: new Date(),
        updated_at: new Date(),
      });
    });

    const user = await db('users').where({ id: userId }).first();
    const tokens = generateTokens({ id: userId, email: body.email, role: body.role });

    res.status(201).json({
      user: {
        id: userId,
        email: body.email,
        role: body.role,
        verified: false,
        profile_verified: false,
        org_name: body.org_name,
      },
      ...tokens,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = loginSchema.parse(req.body);

    const user = await db('users')
      .join('profiles', 'users.id', 'profiles.user_id')
      .where('users.email', body.email)
      .select(
        'users.id',
        'users.email',
        'users.role',
        'users.password_hash',
        'users.verified',
        'users.profile_verified',
        'profiles.org_name',
        'profiles.phone'
      )
      .first();

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const passwordValid = await bcrypt.compare(body.password, user.password_hash);
    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const tokens = generateTokens({ id: user.id, email: user.email, role: user.role });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        verified: user.verified,
        profile_verified: user.profile_verified,
        org_name: user.org_name,
        phone: user.phone,
      },
      ...tokens,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret'
    ) as { id: string };

    const user = await db('users').where({ id: decoded.id }).first();
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const tokens = generateTokens({ id: user.id, email: user.email, role: user.role });
    res.json(tokens);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Refresh token expired, please log in again' });
    } else {
      next(err);
    }
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = await db('users')
      .join('profiles', 'users.id', 'profiles.user_id')
      .where('users.id', req.user!.id)
      .select(
        'users.id',
        'users.email',
        'users.role',
        'users.verified',
        'users.profile_verified',
        'users.created_at',
        'profiles.org_name',
        'profiles.phone',
        'profiles.address',
        'profiles.city',
        'profiles.state',
        'profiles.pincode'
      )
      .first();

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/profile
router.patch('/profile', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const updateSchema = z.object({
      org_name: z.string().min(2).max(200).optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      pincode: z.string().optional(),
    });

    const body = updateSchema.parse(req.body);

    await db('profiles').where({ user_id: req.user!.id }).update({
      ...body,
      updated_at: new Date(),
    });

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
