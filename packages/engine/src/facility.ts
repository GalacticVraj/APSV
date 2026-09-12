/**
 * Facilities, seen as carbon decision points.
 *
 * A plant is not a place where waste gets processed. It is the point at which a
 * haul distance, a conversion efficiency and a feedstock chemistry combine into a
 * carbon result — and the only question this module answers is which plants are
 * helping the network's net figure and which are dragging on it.
 *
 * Built the same way the Carbon Ledger's trace is built, and for the same reason:
 * the allocations arriving at one plant are aggregated and run through the network's
 * own `buildLedger`. Per-facility ledgers therefore sum into the network ledger
 * exactly, and a facility's carbon story is a decomposition of the network figure
 * rather than a parallel account of it.
 *
 * Permanence follows the Ledger's rule — the network's dominant biochar feedstock,
 * not each plant's own — because these are decompositions of a finished total. That
 * differs from Carbon Pathways, which evaluates hypothetical arcs and so uses the
 * material's own stream, exactly as `buildArcs` does. Both are correct for what they
 * describe; the difference is stated wherever either number is shown.
 */

import {
  aggregateAllocations,
  buildLedger,
  dominantBiocharStream,
  networkLedger,
  permanenceFor,
} from './carbon.ts';
import { buildArcs } from './optimizer.ts';
import { PATHWAYS } from './pathways.ts';
import { STREAMS } from './streams.ts';
import type {
  Allocation,
  CarbonLedger,
  Facility,
  NetworkState,
  OptimizationResult,
  PathwayId,
  ShadowPrice,
  StrandedLot,
  StreamId,
} from './types.ts';

export interface FacilityArc {
  sourceId: string;
  sourceName: string;
  district: string;
  lat: number;
  lon: number;
  stream: StreamId;
  streamLabel: string;
  tonnes: number;
  distanceKm: number;
  vehicleId: string;
  trips: number;
  netCarbonT: number;
  carbonPerT: number;
  /** transport emissions attributable to this arc, tCO2e (positive = a charge) */
  transportT: number;
  /** share of the facility's net carbon, % */
  sharePct: number;
}

export interface FacilityOpportunity {
  kind: 'idle_capacity' | 'binding_capacity';
  what: string;
  why: string;
  /** carbon the network would gain, tCO2e over the window */
  carbonDeltaT: number;
  tonnes: number;
  /** what the user can actually do about it from here */
  action: 'simulate' | 'objective' | 'trace';
  actionLabel: string;
}

export interface FacilityCarbon {
  id: string;
  name: string;
  operator: string;
  district: string;
  state: string;
  lat: number;
  lon: number;
  status: string;
  pathway: PathwayId;
  pathwayLabel: string;
  pathwayShort: string;
  producesDurableRemoval: boolean;
  powerSource: string;
  commissioned: number;
  efficiency: number;

  capacityTpd: number;
  /** capacity available across the whole window, t */
  capacityT: number;
  receivedT: number;
  utilisationPct: number;
  headroomT: number;

  /** the ledger for this facility alone, from the network's own builder */
  ledger: CarbonLedger;
  netT: number;
  /** net tCO2e per tonne received; 0 when the plant received nothing */
  perTonneT: number;
  grossBenefitT: number;
  transportT: number;
  processT: number;
  adjustmentT: number;
  /** share of the network's net carbon, % */
  sharePct: number;

  arcs: FacilityArc[];
  streams: Array<{ stream: StreamId; label: string; tonnes: number }>;
  shadow: ShadowPrice | null;
  why: string;
  opportunities: FacilityOpportunity[];
}

/** Compact row for the ranking, computed for every facility including idle ones. */
export interface FacilityRankRow {
  id: string;
  name: string;
  district: string;
  status: string;
  pathwayShort: string;
  receivedT: number;
  capacityT: number;
  utilisationPct: number;
  netT: number;
  perTonneT: number;
  grossBenefitT: number;
  transportT: number;
  processT: number;
  sharePct: number;
  sourceCount: number;
  meanHaulKm: number;
}

// ─────────────────────────────────────────────────────────────────────────────

function windowCapacityT(f: Facility, windowDays: number): number {
  return f.capacityTpd * f.availability * windowDays;
}

/**
 * The ledger for one facility, built from the allocations arriving at it.
 *
 * `networkDominant` is passed in rather than derived per facility so that every
 * facility ledger shares the network's BC100 and the parts sum to the whole.
 */
function ledgerForFacility(
  state: NetworkState,
  allocations: Allocation[],
  networkDominant: StreamId | null,
): CarbonLedger {
  const agg = aggregateAllocations(allocations, state.facilities, state.vehicles, state.assumptions);
  const permanence = networkDominant
    ? permanenceFor(networkDominant, state.assumptions.soilTempC)
    : null;
  return buildLedger(agg, state.assumptions, permanence, false);
}

function splitEmissions(ledger: CarbonLedger): {
  transportT: number;
  processT: number;
  adjustmentT: number;
  grossBenefitT: number;
} {
  const sum = (pred: (k: string) => boolean) =>
    ledger.lines.filter((l) => pred(l.key)).reduce((a, l) => a + l.valueT, 0);
  return {
    // Reported positive: these are charges, and a negative "charge" reads wrong.
    transportT: -sum((k) => k === 'em_transport' || k === 'em_aggregation'),
    processT: -sum((k) => k.startsWith('em_') && k !== 'em_transport' && k !== 'em_aggregation'),
    adjustmentT: -sum((k) => k === 'char_permanence'),
    grossBenefitT: ledger.durableRemovalT + ledger.avoidedEmissionsT + ledger.substitutionT,
  };
}

/** Every facility, ranked by contribution to the network's net carbon. */
export function facilityRanking(
  state: NetworkState,
  result: OptimizationResult,
): FacilityRankRow[] {
  const dominant = dominantBiocharStream(result.allocations);
  // Divided by the ledger's net, not `totals.netCarbonT`: the optimiser's
  // aggregate uses per-arc permanence and is a different figure from the one the
  // product displays, so shares against it would not total 100%.
  const netTotal =
    Math.abs(
      networkLedger(result.allocations, state.facilities, state.vehicles, state.assumptions)
        .netT,
    ) || 1;

  return state.facilities
    .map((f) => {
      const mine = result.allocations.filter((a) => a.facilityId === f.id);
      const ledger = ledgerForFacility(state, mine, dominant);
      const received = mine.reduce((a, x) => a + x.tonnes, 0);
      const capacityT = windowCapacityT(f, state.assumptions.windowDays);
      const split = splitEmissions(ledger);
      const tkm = mine.reduce((a, x) => a + x.tkm, 0);

      return {
        id: f.id,
        name: f.name,
        district: f.district,
        status: f.status,
        pathwayShort: PATHWAYS[f.pathway].short,
        receivedT: received,
        capacityT,
        utilisationPct: capacityT > 0 ? (received / capacityT) * 100 : 0,
        netT: ledger.netT,
        perTonneT: received > 0 ? ledger.netT / received : 0,
        grossBenefitT: split.grossBenefitT,
        transportT: split.transportT,
        processT: split.processT,
        sharePct: (ledger.netT / netTotal) * 100,
        sourceCount: mine.length,
        meanHaulKm: received > 0 ? tkm / received : 0,
      };
    })
    .sort((a, b) => b.netT - a.netT);
}

/**
 * The full carbon profile of one facility.
 *
 * Returns null for a facility that does not exist. A facility that exists but
 * received nothing still returns a profile — "this plant contributed no carbon and
 * here is why" is a real answer and the page renders it.
 */
export function facilityCarbon(
  state: NetworkState,
  result: OptimizationResult,
  facilityId: string,
  stranded: StrandedLot[] = [],
): FacilityCarbon | null {
  const f = state.facilities.find((x) => x.id === facilityId);
  if (!f) return null;

  const dominant = dominantBiocharStream(result.allocations);
  const mine = result.allocations.filter((a) => a.facilityId === facilityId);
  const ledger = ledgerForFacility(state, mine, dominant);
  const split = splitEmissions(ledger);
  const receivedT = mine.reduce((a, x) => a + x.tonnes, 0);
  const capacityT = windowCapacityT(f, state.assumptions.windowDays);
  // Divided by the ledger's net, not `totals.netCarbonT`: the optimiser's
  // aggregate uses per-arc permanence and is a different figure from the one the
  // product displays, so shares against it would not total 100%.
  const netTotal =
    Math.abs(
      networkLedger(result.allocations, state.facilities, state.vehicles, state.assumptions)
        .netT,
    ) || 1;

  const srcById = new Map(state.sources.map((s) => [s.id, s]));
  const facNet = ledger.netT || 1;

  // Transport is apportioned across arcs by their own tonne-kilometres, which is
  // what the emission is actually proportional to — not by tonnage or by headcount.
  const totalTkm = mine.reduce((a, x) => a + x.tkm, 0) || 1;

  const arcs: FacilityArc[] = mine
    .map((a) => {
      const s = srcById.get(a.sourceId);
      // Each arc's carbon comes from its own ledger under the network's BC100, not
      // from `Allocation.netCarbonT`. The optimiser's field is computed with the
      // arc's own permanence and does not sum to the facility ledger — for this
      // plant it is 16% low. Building it the way the Carbon Ledger builds a trace
      // makes the arcs sum to the facility exactly, and makes the same arc show the
      // same number on both screens.
      const arcLedger = ledgerForFacility(state, [a], dominant);
      return {
        sourceId: a.sourceId,
        sourceName: s?.name ?? a.sourceId,
        district: s?.district ?? '—',
        lat: s?.lat ?? 0,
        lon: s?.lon ?? 0,
        stream: a.stream,
        streamLabel: STREAMS[a.stream].label,
        tonnes: a.tonnes,
        distanceKm: a.distanceKm,
        vehicleId: a.vehicleId,
        trips: a.trips,
        netCarbonT: arcLedger.netT,
        carbonPerT: a.tonnes > 0 ? arcLedger.netT / a.tonnes : 0,
        transportT: split.transportT * (a.tkm / totalTkm),
        sharePct: (arcLedger.netT / facNet) * 100,
      };
    })
    .sort((x, y) => y.netCarbonT - x.netCarbonT);

  const byStream = new Map<StreamId, number>();
  for (const a of mine) byStream.set(a.stream, (byStream.get(a.stream) ?? 0) + a.tonnes);

  const shadow = result.shadowPrices.find((s) => s.facilityId === facilityId) ?? null;
  const headroomT = Math.max(0, capacityT - receivedT);

  const profile: FacilityCarbon = {
    id: f.id,
    name: f.name,
    operator: f.operator,
    district: f.district,
    state: f.state,
    lat: f.lat,
    lon: f.lon,
    status: f.status,
    pathway: f.pathway,
    pathwayLabel: PATHWAYS[f.pathway].label,
    pathwayShort: PATHWAYS[f.pathway].short,
    producesDurableRemoval: PATHWAYS[f.pathway].producesDurableRemoval,
    powerSource: f.powerSource,
    commissioned: f.commissioned,
    efficiency: f.efficiency,
    capacityTpd: f.capacityTpd,
    capacityT,
    receivedT,
    utilisationPct: capacityT > 0 ? (receivedT / capacityT) * 100 : 0,
    headroomT,
    ledger,
    netT: ledger.netT,
    perTonneT: receivedT > 0 ? ledger.netT / receivedT : 0,
    grossBenefitT: split.grossBenefitT,
    transportT: split.transportT,
    processT: split.processT,
    adjustmentT: split.adjustmentT,
    sharePct: (ledger.netT / netTotal) * 100,
    arcs,
    streams: [...byStream.entries()]
      .map(([stream, tonnes]) => ({ stream, label: STREAMS[stream].label, tonnes }))
      .sort((a, b) => b.tonnes - a.tonnes),
    shadow,
    why: '',
    opportunities: [],
  };

  profile.why = composeWhy(profile, state, result);
  profile.opportunities = findOpportunities(profile, state, result, stranded);
  return profile;
}

/**
 * Why this plant performs as it does.
 *
 * Written by comparing the facility against the network it sits in, so the
 * sentence names the factor that actually distinguishes it rather than reciting
 * every number again.
 */
function composeWhy(
  p: FacilityCarbon,
  state: NetworkState,
  result: OptimizationResult,
): string {
  const n = (v: number, dp = 0) =>
    Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: dp });

  if (p.status !== 'online') {
    return `${p.name} is ${p.status.replace(/_/g, ' ')} and received nothing this window, so it contributes no carbon either way.`;
  }
  if (p.receivedT <= 0) {
    return `${p.name} is online but received no material this window, so it contributes nothing to the net figure. The optimiser found better destinations for everything within its catchment.`;
  }

  // Ledger net over placed tonnes, so the comparison is against the figure the
  // rest of the product shows rather than the optimiser's internal aggregate.
  const networkPerT =
    result.totals.divertedT > 0
      ? networkLedger(result.allocations, state.facilities, state.vehicles, state.assumptions).netT /
        result.totals.divertedT
      : 0;
  const better = p.perTonneT >= networkPerT;
  const gap = Math.abs(p.perTonneT - networkPerT);

  let s = `${p.name} turns ${n(p.receivedT)} t into ${n(p.netT)} tCO₂e — ${n(p.perTonneT, 3)} per tonne, ${n(gap, 3)} ${better ? 'above' : 'below'} the network average of ${n(networkPerT, 3)}.`;

  // Name the factor that actually explains the position, in order of magnitude.
  const charges = p.transportT + p.processT;
  const chargeShare = p.grossBenefitT > 0 ? (charges / p.grossBenefitT) * 100 : 0;
  const meanHaul = p.receivedT > 0 ? p.arcs.reduce((a, x) => a + x.distanceKm * x.tonnes, 0) / p.receivedT : 0;
  const networkHaul =
    result.totals.divertedT > 0 ? result.totals.tkm / result.totals.divertedT : 0;

  if (p.transportT > p.processT * 1.5 && meanHaul > networkHaul * 1.15) {
    s += ` Transport is the dominant charge here: material travels ${n(meanHaul)} km on average against a network mean of ${n(networkHaul)} km, costing ${n(p.transportT)} tCO₂e.`;
  } else if (p.processT > p.transportT * 1.5) {
    s += ` Processing rather than haulage is the dominant charge, at ${n(p.processT)} tCO₂e against ${n(p.transportT)} tCO₂e for transport.`;
  } else if (chargeShare < 8 && p.grossBenefitT > 0) {
    s += ` Its charges are light — transport and processing together consume only ${n(chargeShare, 1)}% of the gross benefit.`;
  }

  if (p.producesDurableRemoval && p.ledger.durableRemovalT > 0) {
    s += ` It is one of the plants producing durable removal, ${n(p.ledger.durableRemovalT)} tCO₂e after the permanence adjustment.`;
  }
  return s;
}

/**
 * Opportunities, only where the engine can actually price them.
 *
 * Two are calculable and both are reported with the reason the optimiser did not
 * already take them — an "opportunity" the solver rejected for a good reason is a
 * misleading recommendation unless that reason travels with it.
 */
function findOpportunities(
  p: FacilityCarbon,
  state: NetworkState,
  result: OptimizationResult,
  stranded: StrandedLot[],
): FacilityOpportunity[] {
  const out: FacilityOpportunity[] = [];
  const n = (v: number, dp = 0) =>
    Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: dp });

  if (p.status !== 'online') return out;

  // 1. Idle capacity with stranded material that has a real arc into this plant.
  if (p.headroomT > 1 && stranded.length > 0) {
    const arcSet = buildArcs(state);
    const strandedIds = new Map(stranded.map((s) => [s.sourceId, s]));
    const reachable = arcSet.arcs
      .filter((a) => a.facilityId === p.id && strandedIds.has(a.sourceId) && a.netCarbonPerT > 0)
      .map((a) => ({ arc: a, lot: strandedIds.get(a.sourceId)! }))
      .sort((x, y) => y.arc.netCarbonPerT - x.arc.netCarbonPerT);

    if (reachable.length > 0) {
      let remaining = p.headroomT;
      let gained = 0;
      let moved = 0;
      const names: string[] = [];
      for (const r of reachable) {
        if (remaining <= 1) break;
        const take = Math.min(remaining, r.lot.tonnes);
        if (take <= 1) continue;
        gained += take * r.arc.netCarbonPerT;
        moved += take;
        remaining -= take;
        if (names.length < 3) names.push(r.lot.name);
      }
      if (moved > 1) {
        out.push({
          kind: 'idle_capacity',
          what: `Fill ${n(moved)} t of idle capacity from stranded material`,
          why:
            `${n(p.headroomT)} t of this plant's window capacity is unused, and ${n(moved)} t of stranded feedstock ` +
            `at ${names.join(', ')} has a feasible route here. The optimiser left it unplaced under the ` +
            `${result.objective.replace(/_/g, ' ')} objective, which weighs margin as well as carbon — ` +
            `re-solving on Carbon First is what would test whether it takes it.`,
          carbonDeltaT: gained,
          tonnes: moved,
          action: 'objective',
          actionLabel: 'Re-solve on Carbon First',
        });
      }
    }
  }

  // 2. Capacity is binding — the shadow price is measured by re-optimisation.
  if (p.shadow?.binding && p.shadow.carbonPerExtraTonne > 0) {
    const extraTpd = 10;
    const extraT = extraTpd * state.assumptions.windowDays;
    out.push({
      kind: 'binding_capacity',
      what: `Add ${extraTpd} t/day of throughput`,
      why:
        `Capacity here is binding at ${n(p.utilisationPct, 0)}% utilisation. The marginal value of one more ` +
        `tonne was measured by re-optimising the whole network with the constraint relaxed, not inferred ` +
        `from this plant's average.`,
      carbonDeltaT: p.shadow.carbonPerExtraTonne * extraT,
      tonnes: extraT,
      action: 'simulate',
      actionLabel: 'Simulate in Scenarios',
    });
  }

  return out.sort((a, b) => b.carbonDeltaT - a.carbonDeltaT);
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparison
// ─────────────────────────────────────────────────────────────────────────────

export interface FacilityComparisonRow {
  key: string;
  label: string;
  unit: string;
  a: number;
  b: number;
  /** is a higher value better for this row */
  higherIsBetter: boolean;
}

export interface FacilityComparison {
  a: { id: string; name: string; pathwayShort: string };
  b: { id: string; name: string; pathwayShort: string };
  rows: FacilityComparisonRow[];
  /** sources that feed both, where a direct arc-level comparison is possible */
  sharedSources: Array<{
    sourceId: string;
    name: string;
    aPerT: number | null;
    bPerT: number | null;
    aKm: number | null;
    bKm: number | null;
  }>;
  summary: string;
}

export function compareFacilities(
  state: NetworkState,
  result: OptimizationResult,
  aId: string,
  bId: string,
): FacilityComparison | null {
  const a = facilityCarbon(state, result, aId);
  const b = facilityCarbon(state, result, bId);
  if (!a || !b) return null;

  const meanHaul = (p: FacilityCarbon) =>
    p.receivedT > 0 ? p.arcs.reduce((x, r) => x + r.distanceKm * r.tonnes, 0) / p.receivedT : 0;

  const rows: FacilityComparisonRow[] = [
    { key: 'net', label: 'Net carbon', unit: 'tCO₂e', a: a.netT, b: b.netT, higherIsBetter: true },
    { key: 'perT', label: 'Carbon per tonne', unit: 'tCO₂e/t', a: a.perTonneT, b: b.perTonneT, higherIsBetter: true },
    { key: 'received', label: 'Tonnes processed', unit: 't', a: a.receivedT, b: b.receivedT, higherIsBetter: true },
    { key: 'gross', label: 'Gross benefit', unit: 'tCO₂e', a: a.grossBenefitT, b: b.grossBenefitT, higherIsBetter: true },
    { key: 'transport', label: 'Transport emissions', unit: 'tCO₂e', a: a.transportT, b: b.transportT, higherIsBetter: false },
    { key: 'process', label: 'Processing emissions', unit: 'tCO₂e', a: a.processT, b: b.processT, higherIsBetter: false },
    { key: 'haul', label: 'Mean haul', unit: 'km', a: meanHaul(a), b: meanHaul(b), higherIsBetter: false },
    { key: 'util', label: 'Utilisation', unit: '%', a: a.utilisationPct, b: b.utilisationPct, higherIsBetter: true },
  ];

  // Where both plants can take the same source, the comparison stops being an
  // average and becomes a like-for-like arc comparison.
  const arcSet = buildArcs(state);
  const aArcs = new Map(arcSet.arcs.filter((x) => x.facilityId === aId).map((x) => [x.sourceId, x]));
  const bArcs = new Map(arcSet.arcs.filter((x) => x.facilityId === bId).map((x) => [x.sourceId, x]));
  const shared: FacilityComparison['sharedSources'] = [];
  for (const [sid, ax] of aArcs) {
    const bx = bArcs.get(sid);
    if (!bx) continue;
    const src = state.sources.find((s) => s.id === sid);
    shared.push({
      sourceId: sid,
      name: src?.name ?? sid,
      aPerT: ax.netCarbonPerT,
      bPerT: bx.netCarbonPerT,
      aKm: ax.distanceKm,
      bKm: bx.distanceKm,
    });
  }
  shared.sort((x, y) => Math.abs((y.bPerT ?? 0) - (y.aPerT ?? 0)) - Math.abs((x.bPerT ?? 0) - (x.aPerT ?? 0)));

  const n = (v: number, dp = 0) =>
    Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: dp });

  let summary: string;
  if (a.receivedT === 0 || b.receivedT === 0) {
    const idle = a.receivedT === 0 ? a : b;
    summary = `${idle.name} received nothing this window, so only its capacity and reachability can be compared — there is no carbon result to set against ${(idle === a ? b : a).name}.`;
  } else {
    const lead = a.perTonneT >= b.perTonneT ? a : b;
    const other = lead === a ? b : a;
    summary = `${lead.name} returns ${n(lead.perTonneT, 3)} tCO₂e per tonne against ${n(other.perTonneT, 3)} at ${other.name}.`;
    const haulGap = meanHaul(other) - meanHaul(lead);
    const procGap =
      (other.receivedT > 0 ? other.processT / other.receivedT : 0) -
      (lead.receivedT > 0 ? lead.processT / lead.receivedT : 0);
    if (Math.abs(haulGap) > 5 && haulGap > 0) {
      summary += ` Material reaching ${lead.name} travels ${n(haulGap)} km less on average.`;
    } else if (procGap > 1e-4) {
      summary += ` ${other.name} carries the heavier processing charge, ${n(procGap, 3)} tCO₂e more per tonne.`;
    } else if (lead.pathwayShort !== other.pathwayShort) {
      summary += ` They run different pathways — ${lead.pathwayShort} against ${other.pathwayShort} — so the difference is conversion chemistry rather than logistics.`;
    }
    if (shared.length > 0) {
      summary += ` ${shared.length} source${shared.length > 1 ? 's' : ''} can reach both, so the two can be compared arc for arc below.`;
    }
  }

  return {
    a: { id: a.id, name: a.name, pathwayShort: a.pathwayShort },
    b: { id: b.id, name: b.name, pathwayShort: b.pathwayShort },
    rows,
    sharedSources: shared.slice(0, 8),
    summary,
  };
}
