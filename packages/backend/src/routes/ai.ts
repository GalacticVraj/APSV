import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { aiRateLimiter } from '../middleware/rateLimit';
import { getAIResponse, generateStructuredInsight, InsightParseError } from '../services/ai';
import { InsightTemplateKey } from '../ai-insights/templates';
import db from '../services/db';

const router = Router();

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(2000),
  })).min(1).max(20),
});

// POST /api/ai/chat
router.post('/chat', authenticate, aiRateLimiter, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = chatSchema.parse(req.body);
    const user = req.user!;

    // Gather real context data for the AI to reason over
    const context: Record<string, unknown> = {
      role: user.role,
      user_id: user.id,
    };

    // Role-specific context
    if (user.role === 'generator') {
      const generator = await db('generators').where({ user_id: user.id }).first();
      if (generator) {
        const listings = await db('waste_listings')
          .where({ generator_id: generator.id })
          .orderBy('created_at', 'desc')
          .limit(5);

        const listingIds = listings.map((l: { id: string }) => l.id);
        const matches = listingIds.length > 0
          ? await db('matches')
            .whereIn('listing_id', listingIds)
            .join('facilities', 'matches.facility_id', 'facilities.id')
            .select('matches.*', 'facilities.name as facility_name', 'facilities.city', 'facilities.conversion_type')
            .orderBy('score', 'desc')
            .limit(5)
          : [];

        const matchIds = await db('matches').whereIn('listing_id', listingIds).pluck('id');
        const pickups = matchIds.length > 0
          ? await db('pickups').whereIn('match_id', matchIds).orderBy('created_at', 'desc').limit(5)
          : [];

        const carbonTotal = await db('carbon_credits')
          .whereIn('pickup_id', await db('pickups').whereIn('match_id', matchIds).pluck('id'))
          .sum('tonnes_co2 as total')
          .first();

        context.generator = {
          site_name: generator.site_name,
          city: generator.city,
          waste_types: generator.waste_types,
          avg_volume_t_month: generator.avg_volume_t_month,
        };
        context.listings = listings.map((l: Record<string, unknown>) => ({
          id: l.id,
          waste_type: l.waste_type,
          volume_t: l.volume_t,
          status: l.status,
          frequency: l.frequency,
        }));
        context.matches = matches.map((m: Record<string, unknown>) => ({
          score: m.score,
          status: m.status,
          facility_name: m.facility_name,
          city: m.city,
          conversion_type: m.conversion_type,
          explanation: m.explanation_text,
        }));
        context.pickups = pickups.map((p: Record<string, unknown>) => ({
          status: p.status,
          co2_sequestered_t: p.co2_sequestered_t,
        }));
        context.stats = {
          total_co2_sequestered_t: parseFloat(carbonTotal?.total as string || '0'),
          active_listings: listings.filter((l: { status: string }) => l.status === 'open').length,
        };
      }
    } else if (user.role === 'facility_operator') {
      const facility = await db('facilities').where({ user_id: user.id }).first();
      if (facility) {
        const inbound = await db('matches')
          .where({ facility_id: facility.id, status: 'pending' })
          .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
          .join('generators', 'waste_listings.generator_id', 'generators.id')
          .select('matches.*', 'waste_listings.waste_type', 'waste_listings.volume_t', 'generators.site_name', 'generators.city')
          .limit(5);

        const carbonTotal = await db('carbon_credits')
          .join('pickups', 'carbon_credits.pickup_id', 'pickups.id')
          .join('matches', 'pickups.match_id', 'matches.id')
          .where('matches.facility_id', facility.id)
          .sum('carbon_credits.tonnes_co2 as total')
          .first();

        context.facility = {
          name: facility.name,
          city: facility.city,
          conversion_type: facility.conversion_type,
          capacity_t_month: facility.capacity_t_month,
          remaining_capacity_t: facility.remaining_capacity_t,
          capacity_utilization_pct: Math.round(
            ((facility.capacity_t_month - facility.remaining_capacity_t) / facility.capacity_t_month) * 100
          ),
        };
        context.inbound_requests = inbound.map((m: Record<string, unknown>) => ({
          score: m.score,
          waste_type: m.waste_type,
          volume_t: m.volume_t,
          generator: m.site_name,
          city: m.city,
        }));
        context.stats = {
          total_co2_sequestered_t: parseFloat(carbonTotal?.total as string || '0'),
          pending_requests: inbound.length,
        };
      }
    } else if (user.role === 'platform_admin') {
      const platformStats = await db('carbon_credits').sum('tonnes_co2 as co2').first();
      const wasteStats = await db('pickups').where({ status: 'verified' })
        .join('matches', 'pickups.match_id', 'matches.id')
        .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
        .sum('waste_listings.volume_t as volume').first();

      context.stats = {
        total_co2_sequestered_t: parseFloat(platformStats?.co2 as string || '0'),
        total_waste_diverted_t: parseFloat(wasteStats?.volume as string || '0'),
        active_facilities: await db('facilities').count('* as count').first().then(r => parseInt(r?.count as string || '0', 10)),
        active_generators: await db('generators').count('* as count').first().then(r => parseInt(r?.count as string || '0', 10)),
      };
    }

    const { response, provider } = await getAIResponse(
      body.messages.map((m) => ({ ...m, role: m.role as 'user' | 'assistant' })),
      context as { role: string }
    );

    res.json({ response, provider });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/ai/insights ────────────────────────────────────────────────────
// One-shot, scoped structured insight for a specific data component.
// Not a chat endpoint — no conversation history, no open text input.

const VALID_TEMPLATE_KEYS: InsightTemplateKey[] = [
  'waste_listing',
  'facility_card',
  'kpi_card',
  'trade_ledger_row',
  'pathway_economics',
  'break_even',
  'what_if_result',
  'investment_opportunity',
  'value_flow',
];

const insightSchema = z.object({
  templateKey: z.enum(VALID_TEMPLATE_KEYS as [InsightTemplateKey, ...InsightTemplateKey[]]),
  dataPackage: z.record(z.unknown()),
});

router.post(
  '/insights',
  authenticate,
  aiRateLimiter,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = insightSchema.parse(req.body);

      try {
        const { insight, provider } = await generateStructuredInsight(
          body.templateKey,
          body.dataPackage
        );
        res.json({ insight, provider });
      } catch (err) {
        // Return a clean error payload so the frontend can show an inline error
        // state rather than crashing or showing a generic 500.
        if (err instanceof InsightParseError) {
          res.json({ error: 'The AI returned a response that could not be parsed into a structured insight. Try refreshing.', errorCode: 'parse_error' });
          return;
        }
        if ((err as Error)?.message?.includes('Timeout')) {
          res.json({ error: 'The AI service timed out. Try refreshing in a moment.', errorCode: 'timeout' });
          return;
        }
        // Re-throw unexpected errors to the global error handler
        throw err;
      }
    } catch (err) {
      next(err);
    }
  }
);

export default router;
