import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../services/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { calculateCarbon } from '../services/optimizer';
import { emitToUser } from '../services/socket';
import { io } from '../index';
import { sendEmail, pickupStatusEmail } from '../services/email';
import { PickupStatus } from '../types';

const router = Router();

// GET /api/pickups - role-filtered list
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);
    const offset = (page - 1) * limit;
    const { status } = req.query;

    let query = db('pickups')
      .join('matches', 'pickups.match_id', 'matches.id')
      .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
      .join('generators', 'waste_listings.generator_id', 'generators.id')
      .join('facilities', 'matches.facility_id', 'facilities.id')
      .select(
        'pickups.*',
        'waste_listings.waste_type',
        'waste_listings.volume_t',
        'generators.site_name as generator_name',
        'generators.lat as generator_lat',
        'generators.lng as generator_lng',
        'generators.city as generator_city',
        'facilities.name as facility_name',
        'facilities.lat as facility_lat',
        'facilities.lng as facility_lng',
        'facilities.city as facility_city',
        'facilities.conversion_type'
      )
      .orderBy('pickups.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (status) {
      query = query.where('pickups.status', status);
    }

    if (req.user?.role === 'generator') {
      const generator = await db('generators').where({ user_id: req.user.id }).first();
      if (generator) {
        const listingIds = await db('waste_listings').where({ generator_id: generator.id }).pluck('id');
        const matchIds = await db('matches').whereIn('listing_id', listingIds).pluck('id');
        query = query.whereIn('pickups.match_id', matchIds);
      }
    } else if (req.user?.role === 'facility_operator') {
      const facility = await db('facilities').where({ user_id: req.user.id }).first();
      if (facility) {
        query = query.where('matches.facility_id', facility.id);
      }
    } else if (req.user?.role === 'logistics_partner') {
      query = query.where('pickups.logistics_partner_id', req.user.id);
    }

    const pickups = await query;
    const total = await db('pickups').count('* as count').first();

    res.json({
      pickups,
      pagination: { page, limit, total: parseInt(total?.count as string || '0', 10) },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/pickups/:id/status - update pickup status
router.patch('/:id/status', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const statusSchema = z.object({
      status: z.enum(['scheduled', 'in_transit', 'delivered', 'verified', 'cancelled']),
      scheduled_at: z.string().datetime().optional(),
      notes: z.string().max(500).optional(),
    });

    const body = statusSchema.parse(req.body);

    const pickup = await db('pickups')
      .join('matches', 'pickups.match_id', 'matches.id')
      .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
      .join('generators', 'waste_listings.generator_id', 'generators.id')
      .where('pickups.id', req.params.id)
      .select(
        'pickups.*',
        'waste_listings.waste_type',
        'waste_listings.volume_t',
        'generators.lat as generator_lat',
        'generators.lng as generator_lng',
        'generators.user_id as generator_user_id',
        'matches.facility_id',
        'generators.id as generator_id'
      )
      .first();

    if (!pickup) {
      res.status(404).json({ error: 'Pickup not found' });
      return;
    }

    const updateData: Record<string, unknown> = {
      status: body.status,
      updated_at: new Date(),
    };

    if (body.notes) updateData.notes = body.notes;
    if (body.status === 'scheduled' && body.scheduled_at) {
      updateData.scheduled_at = new Date(body.scheduled_at);
    }
    if (body.status === 'delivered') {
      updateData.delivered_at = new Date();
    }
    if (body.status === 'verified') {
      updateData.verified_at = new Date();

      // Calculate carbon sequestration on verification
      const facility = await db('facilities').where({ id: pickup.facility_id }).first();
      if (facility && pickup.generator_lat && pickup.generator_lng) {
        const distKm = calculateHaversineDistance(
          pickup.generator_lat, pickup.generator_lng,
          facility.lat, facility.lng
        );
        updateData.distance_km = distKm;

        const carbonResult = await calculateCarbon({
          waste_type: pickup.waste_type,
          conversion_method: facility.conversion_type,
          volume_t: pickup.volume_t,
          distance_km: distKm,
        });

        if (carbonResult) {
          updateData.co2_sequestered_t = carbonResult.net_co2_t;

          // Create carbon credit record
          const { v4: uuidv4 } = await import('uuid');
          await db('carbon_credits').insert({
            id: uuidv4(),
            pickup_id: pickup.id,
            tonnes_co2: carbonResult.net_co2_t,
            methodology: carbonResult.methodology,
            source_reference: carbonResult.source,
            verified: true,
            issued_at: new Date(),
          });
        }
      }
    }

    await db('pickups').where({ id: req.params.id }).update(updateData);

    // Notify relevant users
    const statusTimestamp = new Date().toISOString();
    const notifyUsers = [pickup.generator_user_id];

    const facilityRecord = await db('facilities').where({ id: pickup.facility_id }).first();
    if (facilityRecord) notifyUsers.push(facilityRecord.user_id);
    if (pickup.logistics_partner_id) notifyUsers.push(pickup.logistics_partner_id);

    for (const userId of notifyUsers) {
      if (userId) {
        emitToUser(io, userId, 'pickup:status_update', {
          pickupId: pickup.id,
          newStatus: body.status,
          timestamp: statusTimestamp,
        });

        // Send email
        const user = await db('users').where({ id: userId }).first();
        const profile = await db('profiles').where({ user_id: userId }).first();
        if (user) {
          await sendEmail({
            to: user.email,
            subject: `Pickup status updated: ${body.status}`,
            html: pickupStatusEmail({
              recipientName: profile?.org_name || 'User',
              pickupId: pickup.id,
              newStatus: body.status,
              timestamp: new Date(statusTimestamp).toLocaleString('en-IN'),
            }),
          });
        }
      }
    }

    const updated = await db('pickups').where({ id: req.params.id }).first();
    res.json({ pickup: updated });
  } catch (err) {
    next(err);
  }
});

// Haversine distance calculation (km)
function calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default router;
