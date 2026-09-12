import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import db from '../services/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { cacheGet, cacheSet, cacheDelPattern } from '../services/redis';

const router = Router();

const generatorSchema = z.object({
  site_name: z.string().min(2).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  waste_types: z.array(z.enum([
    'food_organic', 'agricultural_biomass', 'industrial_biomass',
    'municipal_organic', 'food_processing', 'restaurant_waste'
  ])).min(1),
  avg_volume_t_month: z.number().positive(),
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().regex(/^\d{6}$/, 'Invalid PIN code'),
  description: z.string().max(1000).optional(),
});

// GET /api/generators - list all generators (for map)
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 200);
    const offset = (page - 1) * limit;

    // Bounding box filter for map viewport
    const { minLat, maxLat, minLng, maxLng } = req.query;

    let query = db('generators')
      .join('profiles', 'generators.user_id', 'profiles.user_id')
      .join('users', 'generators.user_id', 'users.id')
      .select(
        'generators.id',
        'generators.user_id',
        'generators.site_name',
        'generators.lat',
        'generators.lng',
        'generators.waste_types',
        'generators.avg_volume_t_month',
        'generators.address',
        'generators.city',
        'generators.state',
        'generators.pincode',
        'generators.description',
        'generators.created_at',
        'profiles.org_name',
        'users.verified',
        'users.profile_verified'
      )
      .limit(limit)
      .offset(offset);

    if (minLat && maxLat && minLng && maxLng) {
      query = query
        .where('generators.lat', '>=', parseFloat(minLat as string))
        .where('generators.lat', '<=', parseFloat(maxLat as string))
        .where('generators.lng', '>=', parseFloat(minLng as string))
        .where('generators.lng', '<=', parseFloat(maxLng as string));
    }

    const generators = await query;
    const total = await db('generators').count('* as count').first();

    res.json({
      generators,
      pagination: { page, limit, total: parseInt(total?.count as string || '0', 10) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/generators/my - get current user's generator profile
router.get('/my', authenticate, requireRole('generator'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const generator = await db('generators').where({ user_id: req.user!.id }).first();
    if (!generator) {
      res.status(404).json({ error: 'Generator profile not found. Complete onboarding first.' });
      return;
    }
    res.json({ generator });
  } catch (err) {
    next(err);
  }
});

// POST /api/generators - create generator profile (onboarding)
router.post('/', authenticate, requireRole('generator'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = generatorSchema.parse(req.body);

    const existing = await db('generators').where({ user_id: req.user!.id }).first();
    if (existing) {
      res.status(409).json({ error: 'Generator profile already exists. Use PATCH to update.' });
      return;
    }

    const id = uuidv4();
    await db('generators').insert({
      id,
      user_id: req.user!.id,
      ...body,
      waste_types: JSON.stringify(body.waste_types),
      created_at: new Date(),
      updated_at: new Date(),
    });

    await cacheDelPattern('generators:*');

    const generator = await db('generators').where({ id }).first();
    res.status(201).json({ generator });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/generators/:id - update generator
router.patch('/:id', authenticate, requireRole('generator'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const generator = await db('generators').where({ id: req.params.id, user_id: req.user!.id }).first();
    if (!generator) {
      res.status(404).json({ error: 'Generator not found or access denied' });
      return;
    }

    const body = generatorSchema.partial().parse(req.body);
    const updateData: Record<string, unknown> = { ...body, updated_at: new Date() };
    if (body.waste_types) {
      updateData.waste_types = JSON.stringify(body.waste_types);
    }

    await db('generators').where({ id: req.params.id }).update(updateData);
    await cacheDelPattern('generators:*');

    const updated = await db('generators').where({ id: req.params.id }).first();
    res.json({ generator: updated });
  } catch (err) {
    next(err);
  }
});

// GET /api/generators/:id - get specific generator
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const cacheKey = `generator:${req.params.id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.json({ generator: JSON.parse(cached) });
      return;
    }

    const generator = await db('generators')
      .join('profiles', 'generators.user_id', 'profiles.user_id')
      .where('generators.id', req.params.id)
      .select('generators.*', 'profiles.org_name')
      .first();

    if (!generator) {
      res.status(404).json({ error: 'Generator not found' });
      return;
    }

    await cacheSet(cacheKey, JSON.stringify(generator), 300);
    res.json({ generator });
  } catch (err) {
    next(err);
  }
});

export default router;
