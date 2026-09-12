import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import db from '../services/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { calculateCarbon } from '../services/optimizer';
import { emitToUser } from '../services/socket';
import { io } from '../index';
import { sendEmail, pickupStatusEmail } from '../services/email';

const router = Router();

// GET /api/matches - for current role's relevant matches
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);
    const offset = (page - 1) * limit;

    let query = db('matches')
      .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
      .join('generators', 'waste_listings.generator_id', 'generators.id')
      .join('facilities', 'matches.facility_id', 'facilities.id')
      .select(
        'matches.*',
        'waste_listings.waste_type',
        'waste_listings.volume_t',
        'waste_listings.pickup_window_start',
        'waste_listings.pickup_window_end',
        'generators.site_name as generator_name',
        'generators.city as generator_city',
        'generators.lat as generator_lat',
        'generators.lng as generator_lng',
        'facilities.name as facility_name',
        'facilities.city as facility_city',
        'facilities.conversion_type',
        'facilities.lat as facility_lat',
        'facilities.lng as facility_lng'
      )
      .orderBy('matches.score', 'desc')
      .limit(limit)
      .offset(offset);

    if (req.user?.role === 'generator') {
      const generator = await db('generators').where({ user_id: req.user.id }).first();
      if (generator) {
        const listingIds = await db('waste_listings')
          .where({ generator_id: generator.id })
          .pluck('id');
        query = query.whereIn('matches.listing_id', listingIds);
      }
    } else if (req.user?.role === 'facility_operator') {
      const facility = await db('facilities').where({ user_id: req.user.id }).first();
      if (facility) {
        query = query.where('matches.facility_id', facility.id);
      }
    }

    const matches = await query;
    const total = await db('matches').count('* as count').first();

    res.json({
      matches,
      pagination: { page, limit, total: parseInt(total?.count as string || '0', 10) },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/matches/:id/accept - facility accepts a match
router.post('/:id/accept', authenticate, requireRole('facility_operator'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const facility = await db('facilities').where({ user_id: req.user!.id }).first();
    if (!facility) {
      res.status(400).json({ error: 'Facility profile not found' });
      return;
    }

    const match = await db('matches')
      .where({ id: req.params.id, facility_id: facility.id, status: 'pending' })
      .first();

    if (!match) {
      res.status(404).json({ error: 'Match not found, already responded to, or access denied' });
      return;
    }

    await db.transaction(async (trx) => {
      await trx('matches').where({ id: req.params.id }).update({
        status: 'accepted',
        updated_at: new Date(),
      });

      // Create a pickup record
      const pickupId = uuidv4();
      await trx('pickups').insert({
        id: pickupId,
        match_id: req.params.id,
        status: 'requested',
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Update listing status
      await trx('waste_listings').where({ id: match.listing_id }).update({
        status: 'matched',
        updated_at: new Date(),
      });

      // Reduce facility remaining capacity
      const listing = await trx('waste_listings').where({ id: match.listing_id }).first();
      if (listing) {
        await trx('facilities').where({ id: facility.id }).decrement(
          'remaining_capacity_t', Math.min(listing.volume_t, facility.remaining_capacity_t)
        );
      }
    });

    // Notify the generator
    const listing = await db('waste_listings').where({ id: match.listing_id }).first();
    const generator = await db('generators').where({ id: listing?.generator_id }).first();
    if (generator) {
      emitToUser(io, generator.user_id, 'match:accepted', {
        matchId: req.params.id,
        facilityName: facility.name,
      });
    }

    res.json({ message: 'Match accepted. Pickup created.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/matches/:id/decline
router.post('/:id/decline', authenticate, requireRole('facility_operator'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const facility = await db('facilities').where({ user_id: req.user!.id }).first();
    const match = await db('matches')
      .where({ id: req.params.id, facility_id: facility?.id, status: 'pending' })
      .first();

    if (!match) {
      res.status(404).json({ error: 'Match not found or already responded to' });
      return;
    }

    await db('matches').where({ id: req.params.id }).update({
      status: 'declined',
      updated_at: new Date(),
    });

    res.json({ message: 'Match declined' });
  } catch (err) {
    next(err);
  }
});

// POST /api/matches/:id/counter-propose
router.post('/:id/counter-propose', authenticate, requireRole('facility_operator'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const counterSchema = z.object({
      window_start: z.string().datetime(),
      window_end: z.string().datetime(),
      message: z.string().max(500).optional(),
    });
    const body = counterSchema.parse(req.body);

    const facility = await db('facilities').where({ user_id: req.user!.id }).first();
    const match = await db('matches')
      .where({ id: req.params.id, facility_id: facility?.id, status: 'pending' })
      .first();

    if (!match) {
      res.status(404).json({ error: 'Match not found or already responded to' });
      return;
    }

    await db('matches').where({ id: req.params.id }).update({
      status: 'counter_proposed',
      counter_proposed_window: JSON.stringify({ start: body.window_start, end: body.window_end }),
      counter_message: body.message || null,
      updated_at: new Date(),
    });

    // Notify generator
    const listing = await db('waste_listings').where({ id: match.listing_id }).first();
    const generator = await db('generators').where({ id: listing?.generator_id }).first();
    if (generator) {
      emitToUser(io, generator.user_id, 'match:counter_proposed', {
        matchId: req.params.id,
        facilityName: facility?.name,
        proposedWindow: { start: body.window_start, end: body.window_end },
      });
    }

    res.json({ message: 'Counter-proposal sent' });
  } catch (err) {
    next(err);
  }
});

export default router;
