import { Router, Response, NextFunction } from 'express';
import db from '../services/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/admin/users - list all users for verification
router.get('/users', authenticate, requireRole('platform_admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = 20;
    const offset = (page - 1) * limit;
    const { verified, role } = req.query;

    let query = db('users')
      .join('profiles', 'users.id', 'profiles.user_id')
      .select(
        'users.id',
        'users.email',
        'users.role',
        'users.verified',
        'users.profile_verified',
        'users.created_at',
        'profiles.org_name',
        'profiles.phone',
        'profiles.city',
        'profiles.state'
      )
      .orderBy('users.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (verified !== undefined) {
      query = query.where('users.verified', verified === 'true');
    }
    if (role) {
      query = query.where('users.role', role);
    }

    const users = await query;
    const total = await db('users').count('* as count').first();

    res.json({
      users,
      pagination: { page, limit, total: parseInt(total?.count as string || '0', 10) },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users/:id/verify
router.post('/users/:id/verify', authenticate, requireRole('platform_admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = await db('users').where({ id: req.params.id }).first();
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await db('users').where({ id: req.params.id }).update({
      verified: true,
      profile_verified: true,
      updated_at: new Date(),
    });

    // Verify facility too if applicable
    await db('facilities').where({ user_id: req.params.id }).update({
      verified: true,
      updated_at: new Date(),
    });

    res.json({ message: 'User verified successfully' });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users/:id/reject
router.post('/users/:id/reject', authenticate, requireRole('platform_admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await db('users').where({ id: req.params.id }).update({
      verified: false,
      updated_at: new Date(),
    });
    res.json({ message: 'User rejected' });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/analytics - platform-wide analytics
router.get('/analytics', authenticate, requireRole('platform_admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const [
      totalUsers,
      pendingVerifications,
      totalListings,
      activeListings,
      totalPickups,
      completedPickups,
      carbonCredits,
      topGenerators,
      topFacilities,
      recentPickups,
    ] = await Promise.all([
      db('users').count('* as count').first(),
      db('users').where({ verified: false }).count('* as count').first(),
      db('waste_listings').count('* as count').first(),
      db('waste_listings').where({ status: 'open' }).count('* as count').first(),
      db('pickups').count('* as count').first(),
      db('pickups').where({ status: 'verified' }).count('* as count').first(),
      db('carbon_credits').sum('tonnes_co2 as total').first(),
      db('waste_listings')
        .join('generators', 'waste_listings.generator_id', 'generators.id')
        .join('profiles', 'generators.user_id', 'profiles.user_id')
        .groupBy('generators.id', 'profiles.org_name', 'generators.site_name')
        .select('profiles.org_name', 'generators.site_name')
        .sum('waste_listings.volume_t as total_volume')
        .orderBy('total_volume', 'desc')
        .limit(5),
      db('facilities')
        .leftJoin('carbon_credits', function() {
          this.on('carbon_credits.pickup_id', '=', db.raw('(SELECT pickups.id FROM pickups JOIN matches ON pickups.match_id = matches.id WHERE matches.facility_id = facilities.id LIMIT 1)'));
        })
        .select('facilities.name', 'facilities.city', 'facilities.conversion_type')
        .sum('carbon_credits.tonnes_co2 as total_co2')
        .groupBy('facilities.id')
        .orderBy('total_co2', 'desc')
        .limit(5),
      db('pickups')
        .join('matches', 'pickups.match_id', 'matches.id')
        .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
        .select(
          'pickups.id',
          'pickups.status',
          'pickups.created_at',
          'pickups.co2_sequestered_t',
          'waste_listings.waste_type',
          'waste_listings.volume_t'
        )
        .orderBy('pickups.created_at', 'desc')
        .limit(10),
    ]);

    res.json({
      summary: {
        total_users: parseInt(totalUsers?.count as string || '0', 10),
        pending_verifications: parseInt(pendingVerifications?.count as string || '0', 10),
        total_listings: parseInt(totalListings?.count as string || '0', 10),
        active_listings: parseInt(activeListings?.count as string || '0', 10),
        total_pickups: parseInt(totalPickups?.count as string || '0', 10),
        completed_pickups: parseInt(completedPickups?.count as string || '0', 10),
        total_co2_sequestered_t: parseFloat(carbonCredits?.total as string || '0'),
      },
      top_generators: topGenerators,
      top_facilities: topFacilities,
      recent_pickups: recentPickups,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/disputes
router.get('/disputes', authenticate, requireRole('platform_admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const disputes = await db('disputes')
      .join('users', 'disputes.reporter_id', 'users.id')
      .join('profiles', 'users.id', 'profiles.user_id')
      .select('disputes.*', 'profiles.org_name as reporter_name', 'users.email as reporter_email')
      .orderBy('disputes.created_at', 'desc')
      .limit(50);

    res.json({ disputes });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/disputes/:id/resolve
router.post('/disputes/:id/resolve', authenticate, requireRole('platform_admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await db('disputes').where({ id: req.params.id }).update({
      status: 'resolved',
      resolved_at: new Date(),
      resolution_note: req.body.resolution_note || '',
      updated_at: new Date(),
    });
    res.json({ message: 'Dispute resolved' });
  } catch (err) {
    next(err);
  }
});

export default router;
