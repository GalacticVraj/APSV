import { Router, Response, NextFunction } from 'express';
import db from '../services/db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// ─── Economic constants (from ARCHITECTURE.md & CarbonLoop methodology) ────────
// Durable removal (biochar) vs avoided emissions priced separately per architecture
const SHADOW_PRICE_AVOIDED_INR = 520;    // ₹/tCO₂e — avoided emissions
const SHADOW_PRICE_DURABLE_INR = 10800;  // ₹/tCO₂e — durable removal (biochar pyrolysis)
const TRANSPORT_COST_INR_PER_TONNE_KM = 12; // ₹/tonne-km (DEFRA 2023 HGV equivalent)
const DCF_5Y_FACTOR = 3.791; // 5-year NPV factor at 10% discount rate

// Levelised Cost of Processing estimates (₹/tonne input) by pathway
const LCOP_BY_TYPE: Record<string, number> = {
  biochar_pyrolysis:   3200,
  anaerobic_digestion: 2800,
  aerobic_composting:  1200,
  vermicomposting:      900,
};

function shadowPrice(conversionType: string): number {
  return conversionType === 'biochar_pyrolysis'
    ? SHADOW_PRICE_DURABLE_INR
    : SHADOW_PRICE_AVOIDED_INR;
}

// Adds role-scoped WHERE clauses to a query that joins waste_listings + matches
async function applyRoleScope(
  q: ReturnType<typeof db>,
  user: AuthenticatedRequest['user']
) {
  if (!user) return q;
  if (user.role === 'generator') {
    const gen = await db('generators').where({ user_id: user.id }).first();
    if (gen) q = q.where('waste_listings.generator_id', gen.id);
  } else if (user.role === 'facility_operator') {
    const fac = await db('facilities').where({ user_id: user.id }).first();
    if (fac) q = q.where('matches.facility_id', fac.id);
  }
  // platform_admin / municipal_admin → no additional scope
  return q;
}

// ─── GET /api/economics/overview ────────────────────────────────────────────────
router.get('/overview', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { dateStart, dateEnd, wasteType } = req.query;
    const user = req.user!;

    let q = db('pickups')
      .join('matches', 'pickups.match_id', 'matches.id')
      .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
      .join('facilities', 'matches.facility_id', 'facilities.id')
      .where('pickups.status', 'verified');

    if (dateStart) q = q.where('pickups.verified_at', '>=', new Date(dateStart as string));
    if (dateEnd)   q = q.where('pickups.verified_at', '<=', new Date(dateEnd as string));
    if (wasteType) q = q.where('waste_listings.waste_type', wasteType as string);
    q = await applyRoleScope(q, user);

    const rows = await q.select(
      'pickups.co2_sequestered_t',
      'pickups.distance_km',
      'waste_listings.volume_t',
      'waste_listings.waste_type',
      'facilities.conversion_type'
    );

    let totalCo2 = 0;
    let totalWaste = 0;
    let estimatedCarbonValue = 0;
    let estimatedTransportCost = 0;

    for (const p of rows) {
      const co2  = parseFloat(String(p.co2_sequestered_t || 0));
      const vol  = parseFloat(String(p.volume_t         || 0));
      const dist = parseFloat(String(p.distance_km      || 0));
      const price = shadowPrice(p.conversion_type);
      totalCo2               += co2;
      totalWaste             += vol;
      estimatedCarbonValue   += co2 * price;
      estimatedTransportCost += vol * dist * TRANSPORT_COST_INR_PER_TONNE_KM;
    }

    // Monthly trend (last 12 months)
    let monthlyQ = db('pickups')
      .join('matches', 'pickups.match_id', 'matches.id')
      .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
      .join('facilities', 'matches.facility_id', 'facilities.id')
      .where('pickups.status', 'verified')
      .select(
        db.raw("TO_CHAR(DATE_TRUNC('month', pickups.verified_at), 'YYYY-MM') as month"),
        db.raw('ROUND(SUM(pickups.co2_sequestered_t)::numeric, 3) as co2'),
        db.raw('ROUND(SUM(waste_listings.volume_t)::numeric, 2) as waste_t')
      )
      .groupByRaw("DATE_TRUNC('month', pickups.verified_at)")
      .orderBy('month', 'asc')
      .limit(12);

    if (dateStart) monthlyQ = monthlyQ.where('pickups.verified_at', '>=', new Date(dateStart as string));
    if (dateEnd)   monthlyQ = monthlyQ.where('pickups.verified_at', '<=', new Date(dateEnd as string));
    monthlyQ = await applyRoleScope(monthlyQ, user);
    const monthlyTrend = await monthlyQ;

    // Value per waste type
    let byTypeQ = db('pickups')
      .join('matches', 'pickups.match_id', 'matches.id')
      .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
      .join('facilities', 'matches.facility_id', 'facilities.id')
      .where('pickups.status', 'verified')
      .select('waste_listings.waste_type', 'facilities.conversion_type')
      .sum('pickups.co2_sequestered_t as total_co2')
      .sum('waste_listings.volume_t as total_volume')
      .groupBy('waste_listings.waste_type', 'facilities.conversion_type');

    if (dateStart) byTypeQ = byTypeQ.where('pickups.verified_at', '>=', new Date(dateStart as string));
    if (dateEnd)   byTypeQ = byTypeQ.where('pickups.verified_at', '<=', new Date(dateEnd as string));
    byTypeQ = await applyRoleScope(byTypeQ, user);
    const byType = await byTypeQ;

    const valuePerWasteType = byType.map((r: Record<string, unknown>) => {
      const co2   = parseFloat(String(r.total_co2    || 0));
      const vol   = parseFloat(String(r.total_volume || 0));
      const price = shadowPrice(String(r.conversion_type));
      return {
        waste_type:  r.waste_type,
        co2_t:       parseFloat(co2.toFixed(3)),
        volume_t:    parseFloat(vol.toFixed(2)),
        value_inr:   Math.round(co2 * price),
        co2_per_tonne: vol > 0 ? parseFloat((co2 / vol).toFixed(4)) : 0,
      };
    });

    res.json({
      kpis: {
        total_co2_t:                   parseFloat(totalCo2.toFixed(3)),
        total_waste_diverted_t:         parseFloat(totalWaste.toFixed(2)),
        estimated_carbon_value_inr:     Math.round(estimatedCarbonValue),
        estimated_transport_cost_inr:   Math.round(estimatedTransportCost),
        net_value_inr:                  Math.round(estimatedCarbonValue - estimatedTransportCost),
        pickup_count:                   rows.length,
      },
      monthly_trend: monthlyTrend.map((r: Record<string, unknown>) => ({
        month:   r.month,
        co2:     parseFloat(String(r.co2     || 0)),
        waste_t: parseFloat(String(r.waste_t || 0)),
      })),
      value_per_waste_type: valuePerWasteType,
      shadow_prices: {
        avoided_emissions_inr_per_tco2: SHADOW_PRICE_AVOIDED_INR,
        durable_removal_inr_per_tco2:   SHADOW_PRICE_DURABLE_INR,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/economics/trade-ledger ────────────────────────────────────────────
router.get('/trade-ledger', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      dateStart, dateEnd, wasteType,
      page: pageStr = '1',
      limit: limitStr = '25',
    } = req.query;
    const page   = Math.max(1, parseInt(pageStr as string, 10));
    const limit  = Math.min(100, Math.max(1, parseInt(limitStr as string, 10)));
    const offset = (page - 1) * limit;
    const user   = req.user!;

    let q = db('pickups')
      .join('matches',       'pickups.match_id',       'matches.id')
      .join('waste_listings','matches.listing_id',      'waste_listings.id')
      .join('generators',    'waste_listings.generator_id', 'generators.id')
      .join('profiles',      'generators.user_id',     'profiles.user_id')
      .join('facilities',    'matches.facility_id',    'facilities.id')
      .where('pickups.status', 'verified');

    if (dateStart) q = q.where('pickups.verified_at', '>=', new Date(dateStart as string));
    if (dateEnd)   q = q.where('pickups.verified_at', '<=', new Date(dateEnd as string));
    if (wasteType) q = q.where('waste_listings.waste_type', wasteType as string);
    q = await applyRoleScope(q, user);

    const [{ count }] = await q.clone().count('pickups.id as count');
    const totalCount = parseInt(String(count || 0), 10);

    const pickups = await q
      .select(
        'pickups.id',
        'pickups.verified_at',
        'pickups.co2_sequestered_t',
        'pickups.distance_km',
        'waste_listings.waste_type',
        'waste_listings.volume_t',
        db.raw("profiles.org_name as generator_name"),
        db.raw("generators.city as generator_city"),
        db.raw("facilities.name as facility_name"),
        db.raw("facilities.city as facility_city"),
        'facilities.conversion_type'
      )
      .orderBy('pickups.verified_at', 'desc')
      .limit(limit)
      .offset(offset);

    // Page-level summaries
    let pageCo2 = 0;
    let pageVol = 0;
    const mapped = pickups.map((p: Record<string, unknown>) => {
      const co2 = parseFloat(String(p.co2_sequestered_t || 0));
      const vol = parseFloat(String(p.volume_t          || 0));
      pageCo2 += co2;
      pageVol += vol;
      return {
        ...p,
        co2_sequestered_t: parseFloat(co2.toFixed(3)),
        volume_t:          parseFloat(vol.toFixed(2)),
        distance_km:       parseFloat(parseFloat(String(p.distance_km || 0)).toFixed(1)),
        estimated_value_inr: Math.round(co2 * shadowPrice(String(p.conversion_type))),
      };
    });

    res.json({
      pickups: mapped,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
      summary: {
        page_co2_t:    parseFloat(pageCo2.toFixed(3)),
        page_volume_t: parseFloat(pageVol.toFixed(2)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/economics/pathway-economics ───────────────────────────────────────
router.get('/pathway-economics', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { dateStart, dateEnd } = req.query;
    const user = req.user!;

    let q = db('pickups')
      .join('matches',       'pickups.match_id',    'matches.id')
      .join('waste_listings','matches.listing_id',   'waste_listings.id')
      .join('facilities',    'matches.facility_id', 'facilities.id')
      .where('pickups.status', 'verified')
      .select('facilities.conversion_type')
      .count('pickups.id as pickup_count')
      .sum('waste_listings.volume_t as total_volume')
      .sum('pickups.co2_sequestered_t as total_co2')
      .avg('pickups.distance_km as avg_distance_km')
      .groupBy('facilities.conversion_type');

    if (dateStart) q = q.where('pickups.verified_at', '>=', new Date(dateStart as string));
    if (dateEnd)   q = q.where('pickups.verified_at', '<=', new Date(dateEnd as string));
    q = await applyRoleScope(q, user);

    const rows = await q;

    const pathways = rows.map((r: Record<string, unknown>) => {
      const ct       = String(r.conversion_type);
      const totalCo2 = parseFloat(String(r.total_co2    || 0));
      const totalVol = parseFloat(String(r.total_volume || 0));
      const price    = shadowPrice(ct);
      const lcop     = LCOP_BY_TYPE[ct] || 1500;
      const grossVal = totalCo2 * price;
      const netMarg  = grossVal - totalVol * lcop;

      return {
        conversion_type:          ct,
        pickup_count:             parseInt(String(r.pickup_count || 0), 10),
        total_volume_t:           parseFloat(totalVol.toFixed(2)),
        total_co2_t:              parseFloat(totalCo2.toFixed(3)),
        avg_co2_per_tonne:        totalVol > 0 ? parseFloat((totalCo2 / totalVol).toFixed(4)) : 0,
        avg_distance_km:          parseFloat(parseFloat(String(r.avg_distance_km || 0)).toFixed(1)),
        lcop_inr_per_tonne:       lcop,
        shadow_price_inr_per_tco2: price,
        gross_value_inr:          Math.round(grossVal),
        net_margin_inr:           Math.round(netMarg),
        margin_per_tonne_inr:     totalVol > 0 ? Math.round(netMarg / totalVol) : 0,
      };
    });

    // Sort by net margin descending (best pathway first)
    pathways.sort((a: { net_margin_inr: number }, b: { net_margin_inr: number }) =>
      b.net_margin_inr - a.net_margin_inr
    );

    res.json({ pathways });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/economics/investment-opportunities ─────────────────────────────────
router.get('/investment-opportunities', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;

    let facQ = db('facilities').select('*');
    if (user.role === 'facility_operator') {
      facQ = facQ.where({ user_id: user.id });
    }
    const facilities = await facQ;

    // Historical stats per facility for avg CO₂ per pickup + volume
    const facilityStats = await db('pickups')
      .join('matches',       'pickups.match_id',   'matches.id')
      .join('waste_listings','matches.listing_id',  'waste_listings.id')
      .where('pickups.status', 'verified')
      .select('matches.facility_id')
      .avg('pickups.co2_sequestered_t as avg_co2')
      .avg('waste_listings.volume_t as avg_volume')
      .count('pickups.id as pickup_count')
      .groupBy('matches.facility_id');

    const statsMap = new Map<string, Record<string, unknown>>(
      facilityStats.map((s: Record<string, unknown>) => [String(s.facility_id), s])
    );

    const opportunities = facilities.map((fac: Record<string, unknown>) => {
      const stats         = statsMap.get(String(fac.id));
      const avgCo2Pick    = parseFloat(String(stats?.avg_co2   || 0));
      const avgVolPick    = parseFloat(String(stats?.avg_volume || 1));
      const avgCo2PerT    = avgVolPick > 0 ? avgCo2Pick / avgVolPick : 0;
      const remainingCap  = parseFloat(String(fac.remaining_capacity_t || 0));
      const capMonth      = parseFloat(String(fac.capacity_t_month     || 1));
      const price         = shadowPrice(String(fac.conversion_type));
      const lcop          = LCOP_BY_TYPE[String(fac.conversion_type)] || 1500;
      const annualShadow  = remainingCap * 12 * avgCo2PerT * price;
      const annualCost    = remainingCap * 12 * lcop;
      const annualNet     = annualShadow - annualCost;
      const breakEvenDist = avgCo2PerT > 0
        ? parseFloat((price * avgCo2PerT / TRANSPORT_COST_INR_PER_TONNE_KM).toFixed(1))
        : 0;

      return {
        id:                  fac.id,
        name:                fac.name,
        city:                fac.city,
        conversion_type:     fac.conversion_type,
        capacity_t_month:    parseFloat(capMonth.toFixed(0)),
        remaining_capacity_t: parseFloat(remainingCap.toFixed(1)),
        headroom_pct:        capMonth > 0 ? Math.round((remainingCap / capMonth) * 100) : 0,
        avg_co2_per_tonne:   parseFloat(avgCo2PerT.toFixed(4)),
        shadow_price_inr:    price,
        lcop_inr_per_tonne:  lcop,
        annual_shadow_value_inr: Math.round(annualShadow),
        annual_net_value_inr:    Math.round(annualNet),
        break_even_distance_km:  breakEvenDist,
        dcf_5y_inr:          Math.round(Math.max(0, annualNet) * DCF_5Y_FACTOR),
        historical_pickups:  parseInt(String(stats?.pickup_count || 0), 10),
      };
    });

    // Sort by DCF descending (highest investment return first)
    opportunities.sort(
      (a: { dcf_5y_inr: number }, b: { dcf_5y_inr: number }) => b.dcf_5y_inr - a.dcf_5y_inr
    );

    res.json({ facilities: opportunities });
  } catch (err) {
    next(err);
  }
});

export default router;
