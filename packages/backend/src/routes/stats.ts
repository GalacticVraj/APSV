import { Router, Response, NextFunction } from 'express';
import db from '../services/db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { optionalAuth } from '../middleware/auth';

const router = Router();

// GET /api/stats/platform - public platform-wide stats for landing page
router.get('/platform', optionalAuth, async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const [co2Stats, wasteStats, facilitiesCount, generatorsCount, pickupsCount] = await Promise.all([
      db('carbon_credits').sum('tonnes_co2 as total').first(),
      db('pickups')
        .where({ status: 'verified' })
        .join('matches', 'pickups.match_id', 'matches.id')
        .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
        .sum('waste_listings.volume_t as volume')
        .first(),
      db('facilities').count('* as count').first(),
      db('generators').count('* as count').first(),
      db('pickups').where({ status: 'verified' }).count('* as count').first(),
    ]);

    res.json({
      total_co2_sequestered_t: parseFloat(co2Stats?.total as string || '0'),
      total_waste_diverted_t: parseFloat(wasteStats?.volume as string || '0'),
      active_facilities: parseInt(facilitiesCount?.count as string || '0', 10),
      active_generators: parseInt(generatorsCount?.count as string || '0', 10),
      completed_pickups: parseInt(pickupsCount?.count as string || '0', 10),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/stats/my-impact - for authenticated user
router.get('/my-impact', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;

    if (user.role === 'generator') {
      const generator = await db('generators').where({ user_id: user.id }).first();
      if (!generator) {
        res.json({ impact: null, message: 'Complete onboarding to see your impact' });
        return;
      }

      const listingIds = await db('waste_listings').where({ generator_id: generator.id }).pluck('id');
      const matchIds = listingIds.length > 0
        ? await db('matches').whereIn('listing_id', listingIds).pluck('id')
        : [];
      const pickupIds = matchIds.length > 0
        ? await db('pickups').whereIn('match_id', matchIds).where({ status: 'verified' }).pluck('id')
        : [];

      const [co2Total, wasteTotal, monthlyData] = await Promise.all([
        pickupIds.length > 0
          ? db('carbon_credits').whereIn('pickup_id', pickupIds).sum('tonnes_co2 as total').first()
          : { total: '0' },
        matchIds.length > 0
          ? db('pickups')
            .whereIn('match_id', matchIds)
            .where({ status: 'verified' })
            .join('matches', 'pickups.match_id', 'matches.id')
            .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
            .sum('waste_listings.volume_t as volume')
            .first()
          : { volume: '0' },
        pickupIds.length > 0
          ? db('carbon_credits')
            .whereIn('pickup_id', pickupIds)
            .select(db.raw("DATE_TRUNC('month', issued_at) as month"))
            .sum('tonnes_co2 as co2')
            .groupByRaw("DATE_TRUNC('month', issued_at)")
            .orderBy('month', 'asc')
            .limit(12)
          : [],
      ]);

      res.json({
        impact: {
          total_co2_t: parseFloat(co2Total?.total as string || '0'),
          total_waste_diverted_t: parseFloat(wasteTotal?.volume as string || '0'),
          completed_pickups: pickupIds.length,
          monthly_trend: monthlyData,
        },
      });
    } else if (user.role === 'facility_operator') {
      const facility = await db('facilities').where({ user_id: user.id }).first();
      if (!facility) {
        res.json({ impact: null, message: 'Complete onboarding to see your impact' });
        return;
      }

      const matchIds = await db('matches').where({ facility_id: facility.id }).pluck('id');
      const pickupIds = matchIds.length > 0
        ? await db('pickups').whereIn('match_id', matchIds).where({ status: 'verified' }).pluck('id')
        : [];

      const [co2Total, throughput, monthlyData] = await Promise.all([
        pickupIds.length > 0
          ? db('carbon_credits').whereIn('pickup_id', pickupIds).sum('tonnes_co2 as total').first()
          : { total: '0' },
        matchIds.length > 0
          ? db('pickups')
            .whereIn('match_id', matchIds)
            .where({ status: 'verified' })
            .join('matches', 'pickups.match_id', 'matches.id')
            .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
            .sum('waste_listings.volume_t as volume')
            .first()
          : { volume: '0' },
        pickupIds.length > 0
          ? db('carbon_credits')
            .whereIn('pickup_id', pickupIds)
            .select(db.raw("DATE_TRUNC('month', issued_at) as month"))
            .sum('tonnes_co2 as co2')
            .groupByRaw("DATE_TRUNC('month', issued_at)")
            .orderBy('month', 'asc')
            .limit(12)
          : [],
      ]);

      res.json({
        impact: {
          total_co2_t: parseFloat(co2Total?.total as string || '0'),
          total_throughput_t: parseFloat(throughput?.volume as string || '0'),
          capacity_utilization_pct: Math.round(
            ((facility.capacity_t_month - facility.remaining_capacity_t) / facility.capacity_t_month) * 100
          ),
          monthly_trend: monthlyData,
        },
      });
    } else {
      res.json({ impact: null });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
