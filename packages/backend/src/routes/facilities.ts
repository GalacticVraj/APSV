import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import db from '../services/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { cacheGet, cacheSet, cacheDelPattern } from '../services/redis';

const router = Router();

const facilitySchema = z.object({
  name: z.string().min(2).max(200),
  lat: z.number().min(8).max(37),   // India bounds
  lng: z.number().min(68).max(98),  // India bounds
  conversion_type: z.enum(['biochar_pyrolysis', 'anaerobic_digestion', 'aerobic_composting', 'vermicomposting']),
  capacity_t_month: z.number().positive(),
  remaining_capacity_t: z.number().min(0),
  accepted_waste_types: z.array(z.enum([
    'food_organic', 'agricultural_biomass', 'industrial_biomass',
    'municipal_organic', 'food_processing', 'restaurant_waste'
  ])).min(1),
  efficiency_pct: z.number().min(0).max(100),
  service_radius_km: z.number().positive().max(500),
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().regex(/^\d{6}$/),
  description: z.string().max(1000).optional(),
});

// GET /api/facilities - list all (for map, with optional bounding box)
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 200);
    const offset = (page - 1) * limit;
    const { minLat, maxLat, minLng, maxLng, waste_type } = req.query;

    let query = db('facilities')
      .join('profiles', 'facilities.user_id', 'profiles.user_id')
      .join('users', 'facilities.user_id', 'users.id')
      .select(
        'facilities.*',
        'profiles.org_name',
        'users.profile_verified'
      )
      .limit(limit)
      .offset(offset);

    if (minLat && maxLat && minLng && maxLng) {
      query = query
        .where('facilities.lat', '>=', parseFloat(minLat as string))
        .where('facilities.lat', '<=', parseFloat(maxLat as string))
        .where('facilities.lng', '>=', parseFloat(minLng as string))
        .where('facilities.lng', '<=', parseFloat(maxLng as string));
    }

    const facilities = await query;

    // Filter by waste type compatibility in JS (JSONB @> operator would be ideal in PostGIS but this works for demo)
    const filtered = waste_type
      ? facilities.filter((f: { accepted_waste_types: string | string[] }) => {
          const types = typeof f.accepted_waste_types === 'string'
            ? JSON.parse(f.accepted_waste_types)
            : f.accepted_waste_types;
          return types.includes(waste_type);
        })
      : facilities;

    const total = await db('facilities').count('* as count').first();

    res.json({
      facilities: filtered,
      pagination: { page, limit, total: parseInt(total?.count as string || '0', 10) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/facilities/my
router.get('/my', authenticate, requireRole('facility_operator'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const facility = await db('facilities').where({ user_id: req.user!.id }).first();
    if (!facility) {
      res.status(404).json({ error: 'Facility profile not found. Complete onboarding first.' });
      return;
    }
    res.json({ facility });
  } catch (err) {
    next(err);
  }
});

// GET /api/facilities/my/schedule - get upcoming pickups calendar
router.get('/my/schedule', authenticate, requireRole('facility_operator'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const facility = await db('facilities').where({ user_id: req.user!.id }).first();
    if (!facility) {
      res.status(404).json({ error: 'Facility profile not found' });
      return;
    }

    const upcoming = await db('pickups')
      .join('matches', 'pickups.match_id', 'matches.id')
      .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
      .join('generators', 'waste_listings.generator_id', 'generators.id')
      .where('matches.facility_id', facility.id)
      .whereIn('pickups.status', ['scheduled', 'in_transit'])
      .select(
        'pickups.id',
        'pickups.status',
        'pickups.scheduled_at',
        'waste_listings.waste_type',
        'waste_listings.volume_t',
        'generators.site_name',
        'generators.city'
      )
      .orderBy('pickups.scheduled_at', 'asc')
      .limit(30);

    res.json({ schedule: upcoming });
  } catch (err) {
    next(err);
  }
});

// POST /api/facilities
router.post('/', authenticate, requireRole('facility_operator'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = facilitySchema.parse(req.body);

    const existing = await db('facilities').where({ user_id: req.user!.id }).first();
    if (existing) {
      res.status(409).json({ error: 'Facility profile already exists. Use PATCH to update.' });
      return;
    }

    const id = uuidv4();
    await db('facilities').insert({
      id,
      user_id: req.user!.id,
      ...body,
      accepted_waste_types: JSON.stringify(body.accepted_waste_types),
      verified: false,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await cacheDelPattern('facilities:*');

    const facility = await db('facilities').where({ id }).first();
    res.status(201).json({ facility });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/facilities/:id
router.patch('/:id', authenticate, requireRole('facility_operator'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const facility = await db('facilities').where({ id: req.params.id, user_id: req.user!.id }).first();
    if (!facility) {
      res.status(404).json({ error: 'Facility not found or access denied' });
      return;
    }

    const body = facilitySchema.partial().parse(req.body);
    const updateData: Record<string, unknown> = { ...body, updated_at: new Date() };
    if (body.accepted_waste_types) {
      updateData.accepted_waste_types = JSON.stringify(body.accepted_waste_types);
    }

    await db('facilities').where({ id: req.params.id }).update(updateData);
    await cacheDelPattern('facilities:*');

    const updated = await db('facilities').where({ id: req.params.id }).first();
    res.json({ facility: updated });
  } catch (err) {
    next(err);
  }
});

// GET /api/facilities/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const cacheKey = `facility:${req.params.id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.json({ facility: JSON.parse(cached) });
      return;
    }

    const facility = await db('facilities')
      .join('profiles', 'facilities.user_id', 'profiles.user_id')
      .where('facilities.id', req.params.id)
      .select('facilities.*', 'profiles.org_name')
      .first();

    if (!facility) {
      res.status(404).json({ error: 'Facility not found' });
      return;
    }

    await cacheSet(cacheKey, JSON.stringify(facility), 300);
    res.json({ facility });
  } catch (err) {
    next(err);
  }
});

export default router;
