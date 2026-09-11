import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import db from '../services/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { computeMatches } from '../services/optimizer';
import { io } from '../index';
import { emitToUser } from '../services/socket';
import { sendEmail, matchNotificationEmail } from '../services/email';

const router = Router();

const listingSchema = z.object({
  waste_type: z.enum([
    'food_organic', 'agricultural_biomass', 'industrial_biomass',
    'municipal_organic', 'food_processing', 'restaurant_waste'
  ]),
  volume_t: z.number().positive().max(10000),
  frequency: z.enum(['one_time', 'weekly', 'biweekly', 'monthly']),
  pickup_window_start: z.string().datetime(),
  pickup_window_end: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

// GET /api/listings - list for current generator or all (admin)
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);
    const offset = (page - 1) * limit;

    let query = db('waste_listings')
      .join('generators', 'waste_listings.generator_id', 'generators.id')
      .join('profiles', 'generators.user_id', 'profiles.user_id')
      .select(
        'waste_listings.*',
        'generators.site_name',
        'generators.city',
        'generators.lat',
        'generators.lng',
        'profiles.org_name'
      )
      .orderBy('waste_listings.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    // Non-admin generators only see their own listings
    if (req.user?.role === 'generator') {
      const generator = await db('generators').where({ user_id: req.user.id }).first();
      if (generator) {
        query = query.where('waste_listings.generator_id', generator.id);
      }
    }

    const listings = await query;
    const total = await db('waste_listings').count('* as count').first();

    res.json({
      listings,
      pagination: { page, limit, total: parseInt(total?.count as string || '0', 10) },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/listings - create listing and auto-compute matches
router.post('/', authenticate, requireRole('generator'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = listingSchema.parse(req.body);

    const generator = await db('generators').where({ user_id: req.user!.id }).first();
    if (!generator) {
      res.status(400).json({ error: 'Complete generator onboarding before creating listings' });
      return;
    }

    const listingId = uuidv4();
    await db('waste_listings').insert({
      id: listingId,
      generator_id: generator.id,
      ...body,
      status: 'open',
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Compute matches asynchronously (do not block response)
    setImmediate(async () => {
      try {
        const facilities = await db('facilities')
          .where('remaining_capacity_t', '>', 0)
          .select('*');

        const matchResults = await computeMatches({
          listing_id: listingId,
          generator_lat: generator.lat,
          generator_lng: generator.lng,
          waste_type: body.waste_type,
          volume_t: body.volume_t,
          facilities: facilities.map((f: Record<string, unknown>) => ({
            id: f.id as string,
            lat: f.lat as number,
            lng: f.lng as number,
            conversion_type: f.conversion_type as string,
            remaining_capacity_t: f.remaining_capacity_t as number,
            capacity_t_month: f.capacity_t_month as number,
            accepted_waste_types: typeof f.accepted_waste_types === 'string'
              ? JSON.parse(f.accepted_waste_types as string)
              : f.accepted_waste_types as string[],
            efficiency_pct: f.efficiency_pct as number,
            service_radius_km: f.service_radius_km as number,
          })),
        });

        if (matchResults.length > 0) {
          // Store top 5 matches
          const topMatches = matchResults.slice(0, 5);
          for (const match of topMatches) {
            await db('matches').insert({
              id: uuidv4(),
              listing_id: listingId,
              facility_id: match.facility_id,
              score: match.score,
              status: 'pending',
              explanation_text: match.explanation,
              match_breakdown: JSON.stringify(match.breakdown),
              created_at: new Date(),
              updated_at: new Date(),
            });
          }

          // Notify generator via WebSocket
          emitToUser(io, req.user!.id, 'match:new', {
            listingId,
            matchCount: topMatches.length,
            topScore: topMatches[0].score,
          });

          // Send email notification
          const userProfile = await db('profiles').where({ user_id: req.user!.id }).first();
          const user = await db('users').where({ id: req.user!.id }).first();
          const topFacility = await db('facilities').where({ id: topMatches[0].facility_id }).first();

          if (user && topFacility) {
            await sendEmail({
              to: user.email,
              subject: 'New facility match found on CarbonLoop',
              html: matchNotificationEmail({
                recipientName: userProfile?.org_name || 'User',
                facilityName: topFacility.name,
                wasteType: body.waste_type.replace(/_/g, ' '),
                score: Math.round(topMatches[0].score),
              }),
            });
          }
        }
      } catch (matchErr) {
        // Non-fatal: listing created, match computation failed
        const errMsg = matchErr instanceof Error ? matchErr.message : 'Unknown error';
        console.error('Match computation failed:', errMsg);
      }
    });

    const listing = await db('waste_listings').where({ id: listingId }).first();
    res.status(201).json({ listing, message: 'Listing created. Matches are being computed.' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/listings/:id/cancel
router.patch('/:id/cancel', authenticate, requireRole('generator'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const generator = await db('generators').where({ user_id: req.user!.id }).first();
    const listing = await db('waste_listings')
      .where({ id: req.params.id, generator_id: generator?.id })
      .first();

    if (!listing) {
      res.status(404).json({ error: 'Listing not found or access denied' });
      return;
    }

    if (listing.status === 'completed') {
      res.status(400).json({ error: 'Cannot cancel a completed listing' });
      return;
    }

    await db('waste_listings').where({ id: req.params.id }).update({
      status: 'cancelled',
      updated_at: new Date(),
    });

    res.json({ message: 'Listing cancelled' });
  } catch (err) {
    next(err);
  }
});

export default router;
