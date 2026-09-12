/**
 * Economics.
 *
 * Mirrors the carbon ledger line for line: every rupee is traceable to a physical
 * quantity and a published price. The two ledgers share the same `PhysicalPerTonne`
 * inventory, so a carbon number and a rupee number can never describe different
 * amounts of material.
 */

import type {
  Allocation,
  Assumptions,
  Facility,
  PathwayId,
  StreamId,
  VehicleType,
} from './types.ts';
import { PRICES } from './constants.ts';
import { STREAMS } from './streams.ts';
import { PATHWAYS, pathwayYield } from './pathways.ts';
import { EMPTY_RETURN_FUEL_RATIO, type CarbonComponents } from './carbon.ts';

export interface EconLine {
  key: string;
  label: string;
  /** INR — positive = revenue, negative = cost */
  valueInr: number;
  kind: 'product_revenue' | 'carbon_revenue' | 'feedstock' | 'logistics' | 'processing' | 'total';
  basis: string;
}

export interface EconPerTonne {
  productRevenue: number;
  carbonRevenue: number;
  feedstockCost: number;
  aggregationCost: number;
  transportCost: number;
  processingCost: number;
  capexCost: number;
  margin: number;
  lines: EconLine[];
}

/**
 * Cost of moving one tonne over `distanceKm`, including the empty return leg.
 * Per-tonne cost is driven by achievable payload, which for baled straw is set by
 * deck volume rather than mass rating.
 */
export function transportCostPerTonne(
  distanceKm: number,
  payloadT: number,
  vehicle: VehicleType,
  assumptions: Assumptions,
): number {
  if (payloadT <= 0) return Infinity;
  const roundTripKm = distanceKm * (1 + EMPTY_RETURN_FUEL_RATIO);
  const fuelCost = vehicle.dieselLPerKm * roundTripKm * assumptions.dieselPriceInrPerL;
  // costInrPerKm covers hire, maintenance and driver but not fuel.
  const runningCost = vehicle.costInrPerKm * roundTripKm * 0.45;
  const tripCost = fuelCost + runningCost + vehicle.fixedCostInrPerTrip;
  return tripCost / payloadT;
}

export function economicsPerTonne(
  streamId: StreamId,
  pathwayId: PathwayId,
  facility: Facility,
  distanceKm: number,
  payloadT: number,
  vehicle: VehicleType,
  carbon: CarbonComponents,
  assumptions: Assumptions,
): EconPerTonne {
  const s = STREAMS[streamId];
  const y = pathwayYield(s, pathwayId, facility.efficiency);
  const lines: EconLine[] = [];

  let productRevenue = 0;
  const addProduct = (key: string, label: string, qty: number, price: number, unit: string) => {
    if (qty <= 0) return;
    const v = qty * price;
    productRevenue += v;
    lines.push({
      key,
      label,
      valueInr: v,
      kind: 'product_revenue',
      basis: `${qty.toFixed(3)} ${unit} × ₹${price.toLocaleString('en-IN')}`,
    });
  };

  addProduct('biochar', 'Biochar sales', y.biocharT, PRICES.biochar.price, 't');
  addProduct('cbg', 'Compressed bio-gas sales', y.cbgKg, PRICES.bio_cng.price, 'kg');
  addProduct('pellets', 'Pellet sales', y.pelletT, PRICES.pellets.price, 't');
  addProduct('compost', 'Compost sales', y.compostT, PRICES.compost.price, 't');
  addProduct('digestate', 'Digestate (FOM) sales', y.digestateT, PRICES.digestate.price, 't');
  if (y.netKwh > 0) {
    addProduct('power', 'Power export', y.netKwh, PRICES.electricity.price, 'kWh');
  }

  const carbonRevenue =
    carbon.durableT * assumptions.cdrPriceInrPerT +
    Math.max(0, carbon.avoidedT + carbon.substitutionT) * assumptions.vcmPriceInrPerT;
  if (carbon.durableT > 0) {
    lines.push({
      key: 'cdr',
      label: 'Durable removal credits',
      valueInr: carbon.durableT * assumptions.cdrPriceInrPerT,
      kind: 'carbon_revenue',
      basis: `${carbon.durableT.toFixed(3)} tCO₂e × ₹${assumptions.cdrPriceInrPerT.toLocaleString('en-IN')}`,
    });
  }
  const avoidedValue =
    Math.max(0, carbon.avoidedT + carbon.substitutionT) * assumptions.vcmPriceInrPerT;
  if (avoidedValue > 0) {
    lines.push({
      key: 'vcm',
      label: 'Avoided-emission credits',
      valueInr: avoidedValue,
      kind: 'carbon_revenue',
      basis: `${(carbon.avoidedT + carbon.substitutionT).toFixed(3)} tCO₂e × ₹${assumptions.vcmPriceInrPerT.toLocaleString('en-IN')}`,
    });
  }

  const feedstockCost = s.gatePriceInrPerT;
  lines.push({
    key: 'gate',
    label: feedstockCost >= 0 ? 'Feedstock purchase' : 'Tipping fee received',
    valueInr: -feedstockCost,
    kind: 'feedstock',
    basis:
      feedstockCost >= 0
        ? `₹${feedstockCost}/t paid to the generator`
        : `₹${-feedstockCost}/t received for accepting the material`,
  });

  const aggregationCost = s.aggregationCostInrPerT;
  lines.push({
    key: 'aggregation',
    label: 'Aggregation and handling',
    valueInr: -aggregationCost,
    kind: 'feedstock',
    basis: `₹${aggregationCost}/t — ${s.kind === 'crop_residue' ? 'rake, bale, load' : 'collection and handling'}`,
  });

  const transportCost = transportCostPerTonne(distanceKm, payloadT, vehicle, assumptions);
  lines.push({
    key: 'transport',
    label: 'Road transport',
    valueInr: -transportCost,
    kind: 'logistics',
    basis: `${distanceKm.toFixed(0)} km on a ${vehicle.label} at ${payloadT.toFixed(1)} t payload (round trip)`,
  });

  const processingCost = facility.opexInrPerT;
  lines.push({
    key: 'opex',
    label: 'Processing opex',
    valueInr: -processingCost,
    kind: 'processing',
    basis: `₹${processingCost}/t at ${facility.name}`,
  });

  const capexCost = facility.capexAmortInrPerT;
  lines.push({
    key: 'capex',
    label: 'Capital charge (amortised)',
    valueInr: -capexCost,
    kind: 'processing',
    basis: `₹${capexCost}/t at nameplate throughput`,
  });

  const margin =
    productRevenue +
    carbonRevenue -
    feedstockCost -
    aggregationCost -
    transportCost -
    processingCost -
    capexCost;

  lines.push({
    key: 'margin',
    label: 'Operating margin',
    valueInr: margin,
    kind: 'total',
    basis: 'Revenue less feedstock, logistics and processing',
  });

  return {
    productRevenue,
    carbonRevenue,
    feedstockCost,
    aggregationCost,
    transportCost,
    processingCost,
    capexCost,
    margin,
    lines,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Network-level rollup
// ─────────────────────────────────────────────────────────────────────────────

export interface EconAggregate {
  productRevenueInr: number;
  carbonRevenueInr: number;
  feedstockCostInr: number;
  aggregationCostInr: number;
  transportCostInr: number;
  processingCostInr: number;
  capexCostInr: number;
  marginInr: number;
  byPathway: Record<string, { tonnes: number; revenue: number; cost: number; margin: number }>;
  byFacility: Record<string, { tonnes: number; revenue: number; cost: number; margin: number }>;
}

export function emptyEconAggregate(): EconAggregate {
  return {
    productRevenueInr: 0,
    carbonRevenueInr: 0,
    feedstockCostInr: 0,
    aggregationCostInr: 0,
    transportCostInr: 0,
    processingCostInr: 0,
    capexCostInr: 0,
    marginInr: 0,
    byPathway: {},
    byFacility: {},
  };
}

export function rollupEconomics(allocations: Allocation[]): EconAggregate {
  const agg = emptyEconAggregate();
  for (const a of allocations) {
    agg.marginInr += a.marginInr;
    agg.productRevenueInr += a.revenueInr;
    agg.processingCostInr += a.costInr;
    const p = agg.byPathway[a.pathway] ?? { tonnes: 0, revenue: 0, cost: 0, margin: 0 };
    p.tonnes += a.tonnes;
    p.revenue += a.revenueInr;
    p.cost += a.costInr;
    p.margin += a.marginInr;
    agg.byPathway[a.pathway] = p;
    const fkey = a.facilityId;
    const fa = agg.byFacility[fkey] ?? { tonnes: 0, revenue: 0, cost: 0, margin: 0 };
    fa.tonnes += a.tonnes;
    fa.revenue += a.revenueInr;
    fa.cost += a.costInr;
    fa.margin += a.marginInr;
    agg.byFacility[fkey] = fa;
  }
  return agg;
}

/**
 * Marginal abatement cost: rupees of net cost per tonne of CO2e delivered.
 * Negative means the abatement pays for itself — the tonnes an operator should do
 * first regardless of any carbon price.
 */
export function abatementCost(marginInr: number, netCarbonT: number): number {
  if (Math.abs(netCarbonT) < 1e-6) return 0;
  return -marginInr / netCarbonT;
}

/** Pathway comparison row for the Pathway Comparison table. */
export interface PathwayComparisonRow {
  pathway: PathwayId;
  label: string;
  feasible: boolean;
  reason: string;
  suitability: number;
  netCarbonPerT: number;
  durablePerT: number;
  revenuePerT: number;
  costPerT: number;
  marginPerT: number;
  netValuePerT: number;
  abatementCostPerTco2e: number;
}

export const PATHWAY_LABEL: Record<PathwayId, string> = {
  pyrolysis_biochar: PATHWAYS.pyrolysis_biochar.short,
  anaerobic_digestion_cbg: PATHWAYS.anaerobic_digestion_cbg.short,
  pellet_cofiring: PATHWAYS.pellet_cofiring.short,
  composting: PATHWAYS.composting.short,
  gasification_power: PATHWAYS.gasification_power.short,
};

// ─────────────────────────────────────────────────────────────────────────────
// Established Economic Models (Phase 3 Upgrade)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Levelized Cost of Processing (LCOP)
 * Evaluates the true unit cost of processing by discounting lifetime capital
 * and operating expenses against discounted lifetime throughput.
 * Formula: sum( (Capex_t + Opex_t) / (1+r)^t ) / sum( Throughput_t / (1+r)^t )
 * 
 * @param facility The facility with its capex/opex parameters.
 * @param lifetimeYears Expected operating life (default 20).
 * @param discountRate Discount rate (WACC) from constants.
 */
export function levelizedCostOfProcessing(
  facility: Facility,
  discountRate: number,
  lifetimeYears: number = 20
): number {
  let npvCost = 0;
  let npvTonnes = 0;
  
  // We approximate capexAmortInrPerT back to a day-0 lump sum (very roughly)
  // or simply treat the amortized cost as an annual cash flow for this model.
  // A truer LCOP treats capex as Year 0 and opex as Years 1..N.
  // For simplicity, assume capex was spread, or use the amortized value as a proxy
  // for capital recovery factor. 
  // Wait, if it's already amortized per tonne at nameplate, the annual capital charge is:
  const annualCapex = facility.capexAmortInrPerT * facility.capacityTpd * 330;
  
  // Year 0: initial investment (approximated from annual amortized over life)
  // Since capexAmortInrPerT = NPV_capex / NPV_tonnes roughly, we can reconstruct NPV_capex:
  let crf = (discountRate * Math.pow(1 + discountRate, lifetimeYears)) / (Math.pow(1 + discountRate, lifetimeYears) - 1);
  const totalCapex = annualCapex / crf;
  
  npvCost += totalCapex;
  
  for (let t = 1; t <= lifetimeYears; t++) {
    const discountFactor = Math.pow(1 + discountRate, t);
    const annualOpex = facility.opexInrPerT * (facility.capacityTpd * 330);
    const annualTonnes = facility.capacityTpd * 330; // Assuming nameplate for LCOP baseline
    
    npvCost += annualOpex / discountFactor;
    npvTonnes += annualTonnes / discountFactor;
  }
  
  return npvCost / npvTonnes;
}

/**
 * Discounted Cash Flow (DCF) & Net Present Value (NPV) for Expansion
 * Calculates the NPV of expanding a facility's capacity by 1 tpd, based on the LP
 * shadow price (marginal value of capacity) projected over N years.
 * 
 * @param marginalValuePerTonne Marginal daily value (shadow price) of 1 extra tonne capacity
 * @param capexPerTpd Capital cost required to add 1 tpd capacity
 * @param discountRate WACC
 * @param horizonYears Evaluation horizon (e.g., 10 years)
 */
export function expansionNpv(
  marginalValuePerTonne: number,
  capexPerTpd: number,
  discountRate: number,
  horizonYears: number = 10
): { npv: number; irr: number | null; realOptionWaitValue: number } {
  let npv = -capexPerTpd;
  const annualCashFlow = marginalValuePerTonne * 330; // 330 active days
  
  for (let t = 1; t <= horizonYears; t++) {
    npv += annualCashFlow / Math.pow(1 + discountRate, t);
  }
  
  // Real Options Framing: Option to Wait (simplified proxy)
  // If NPV is slightly negative or highly uncertain, waiting 1 year might avoid a bad investment.
  // Wait value is the Black-Scholes call option value on the NPV, approximated here
  // as max(0, expected_volatility_upside) minus lost year of cash flows.
  // For UI purposes, we return a simple heuristic: if NPV > 0, wait value is 0 (invest now).
  // If NPV is close to 0, wait value is the value of avoiding downside.
  const realOptionWaitValue = npv < 0 && npv > -capexPerTpd * 0.5 ? Math.abs(npv) * 0.2 : 0;
  
  return { npv, irr: null, realOptionWaitValue };
}

/**
 * Life Cycle Costing (LCC) baseline adjustment
 * Adds the avoided societal/financial cost of landfilling to the net margin.
 */
export function lifeCycleAvoidedCost(
  tonnes: number,
  landfillTippingFeeInrPerT: number
): number {
  return tonnes * landfillTippingFeeInrPerT;
}
