import { Router, Response, NextFunction } from 'express';
import db from '../services/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { optimizeRoute } from '../services/optimizer';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const router = Router();

// GET /api/logistics-routes - for logistics partner
router.get('/', authenticate, requireRole('logistics_partner', 'platform_admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = 20;
    const offset = (page - 1) * limit;

    let query = db('logistics_routes')
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (req.user?.role === 'logistics_partner') {
      query = query.where({ logistics_partner_id: req.user.id });
    }

    const routes = await query;
    res.json({ routes });
  } catch (err) {
    next(err);
  }
});

// POST /api/logistics-routes/optimize - create optimized route
router.post('/optimize', authenticate, requireRole('logistics_partner', 'platform_admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      pickup_ids: z.array(z.string().uuid()).min(1).max(20),
      depot_lat: z.number().min(8).max(37),
      depot_lng: z.number().min(68).max(98),
      vehicle_capacity_t: z.number().positive().max(50),
    });

    const body = schema.parse(req.body);

    const pickups = await db('pickups')
      .join('matches', 'pickups.match_id', 'matches.id')
      .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
      .join('generators', 'waste_listings.generator_id', 'generators.id')
      .whereIn('pickups.id', body.pickup_ids)
      .where('pickups.status', 'requested')
      .select(
        'pickups.id',
        'generators.lat',
        'generators.lng',
        'waste_listings.volume_t',
        'waste_listings.pickup_window_start',
        'waste_listings.pickup_window_end',
        'generators.address'
      );

    if (pickups.length === 0) {
      res.status(400).json({ error: 'No eligible pickups found. Pickups must be in "requested" status.' });
      return;
    }

    const routeResult = await optimizeRoute({
      pickups: pickups.map((p: Record<string, unknown>) => ({
        id: p.id as string,
        lat: p.lat as number,
        lng: p.lng as number,
        volume_t: p.volume_t as number,
        pickup_window_start: (p.pickup_window_start as Date).toISOString(),
        pickup_window_end: (p.pickup_window_end as Date).toISOString(),
      })),
      depot_lat: body.depot_lat,
      depot_lng: body.depot_lng,
      vehicle_capacity_t: body.vehicle_capacity_t,
    });

    if (!routeResult) {
      res.status(500).json({ error: 'Route optimization service unavailable' });
      return;
    }

    const routeId = uuidv4();
    await db('logistics_routes').insert({
      id: routeId,
      logistics_partner_id: req.user!.id,
      stops: JSON.stringify(routeResult.stops),
      total_distance_km: routeResult.total_distance_km,
      total_time_min: routeResult.total_time_min,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Assign logistics partner to pickups and update status
    for (const pickupId of body.pickup_ids) {
      await db('pickups').where({ id: pickupId }).update({
        logistics_partner_id: req.user!.id,
        status: 'scheduled',
        updated_at: new Date(),
      });
    }

    res.status(201).json({
      route: { id: routeId, ...routeResult },
      message: `Optimized route created with ${routeResult.stops.length} stops`,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/logistics-routes/:id
router.get('/:id', authenticate, requireRole('logistics_partner', 'platform_admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const route = await db('logistics_routes').where({ id: req.params.id }).first();
    if (!route) {
      res.status(404).json({ error: 'Route not found' });
      return;
    }
    res.json({ route });
  } catch (err) {
    next(err);
  }
});

export default router;
