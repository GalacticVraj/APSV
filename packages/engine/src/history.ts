/**
 * Carbon over time, and the attribution of what moved it.
 *
 * The optimiser solves one planning window. That answers "how much net carbon is
 * this plan creating" but not "is it getting better or worse", which is the
 * question a carbon manager actually opens the product with. This module supplies
 * the missing time axis without inventing one.
 *
 * The method: `generateHistory` already produces a real weekly supply series per
 * source — crop-calendar seasonality, an AR(1) weather shock and a modest trend,
 * seeded so it is stable across reloads. For each historical week we set every
 * source's availability to that week's observed rate and re-run the real optimiser
 * and the real carbon ledger. Every point on the trend is therefore a genuine
 * solve, not a curve drawn through the headline figure.
 *
 * Two consequences worth stating plainly:
 *
 *  1. Each point is expressed **per planning window at that week's supply rate**,
 *     not as that week's tonnage. That keeps every point on the same basis as the
 *     headline number, so the trend and the hero figure can never disagree about
 *     what they are measuring.
 *
 *  2. The series reflects supply variation only. Prices, assumptions and the
 *     facility estate are held at their current values, because we have no history
 *     for them — inventing one would be the exact fabrication this product refuses.
 *     The basis string says so, and the UI prints it.
 */

import { optimize } from './optimizer.ts';
import { generateHistory } from './forecast.ts';
import {
  aggregateAllocations,
  buildLedger,
  dominantBiocharStream,
  permanenceFor,
} from './carbon.ts';
import { PATHWAYS } from './pathways.ts';
import type {
  Allocation,
  CarbonLedger,
  NetworkState,
  ObjectiveMode,
  PathwayId,
  StreamId,
} from './types.ts';

const WEEK_MS = 7 * 24 * 3600 * 1000;

/** Weeks of history generated per source before we slice the tail we need. */
const HISTORY_WEEKS = 104;

export interface CarbonHistoryPoint {
  /** 0 is the most recent completed week; negative values run backwards. */
  weekIndex: number;
  date: string;
  /** supply offered in the window, at this week's observed rate */
  suppliedT: number;
  divertedT: number;
  strandedT: number;
  netT: number;
  durableRemovalT: number;
  avoidedEmissionsT: number;
  substitutionT: number;
  emissionsT: number;
  transportEmissionsT: number;
  processEmissionsT: number;
  /** net tCO2e per tonne diverted — the intensity of the operation */
  intensityTPerT: number;
  tonnesByPathway: Partial<Record<PathwayId, number>>;
  /**
   * Net carbon booked at each facility that week, tCO2e per window. Facilities
   * absent from the map received nothing that week — a real outcome, not a gap.
   */
  netByFacility: Record<string, number>;
}

export interface PeriodComparison {
  /** mean tCO2e per window over the trailing period */
  currentT: number;
  previousT: number;
  deltaT: number;
  deltaPct: number;
  /** weeks averaged on each side */
  weeks: number;
  improving: boolean;
}

export interface ChangeDriver {
  key: string;
  label: string;
  /** contribution to the net change, tCO2e */
  deltaT: number;
  detail: string;
}

export interface CarbonHistory {
  points: CarbonHistoryPoint[];
  period: PeriodComparison;
  drivers: ChangeDriver[];
  /** one plain sentence, composed from the drivers above and nothing else */
  narrative: string;
  basis: string;
}

/** Per-source weekly supply, cached across calls since it is deterministic. */
const historyCache = new Map<string, number[]>();

function weeklySupply(state: NetworkState): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const s of state.sources) {
    const key = `${s.id}:${s.availableT.toFixed(3)}`;
    let series = historyCache.get(key);
    if (!series) {
      series = generateHistory(s, HISTORY_WEEKS);
      historyCache.set(key, series);
    }
    out.set(s.id, series);
  }
  return out;
}

/**
 * Net carbon per facility for one week, each from that facility's own ledger under
 * the week's dominant biochar feedstock — the same rule the Facilities page uses,
 * so a facility's trend and its profile describe the same quantity.
 */
function netByFacility(
  state: NetworkState,
  allocations: Allocation[],
): Record<string, number> {
  const dominant = dominantBiocharStream(allocations);
  const permanence = dominant
    ? permanenceFor(dominant, state.assumptions.soilTempC)
    : null;
  const byFacility = new Map<string, Allocation[]>();
  for (const a of allocations) {
    const list = byFacility.get(a.facilityId);
    if (list) list.push(a);
    else byFacility.set(a.facilityId, [a]);
  }
  const out: Record<string, number> = {};
  for (const [id, list] of byFacility) {
    const agg = aggregateAllocations(list, state.facilities, state.vehicles, state.assumptions);
    out[id] = buildLedger(agg, state.assumptions, permanence, false).netT;
  }
  return out;
}
function tonnesByPathway(allocations: Allocation[]): Partial<Record<PathwayId, number>> {
  const out: Partial<Record<PathwayId, number>> = {};
  for (const a of allocations) out[a.pathway] = (out[a.pathway] ?? 0) + a.tonnes;
  return out;
}

function ledgerFor(state: NetworkState, allocations: Allocation[]): CarbonLedger {
  const agg = aggregateAllocations(
    allocations,
    state.facilities,
    state.vehicles,
    state.assumptions,
  );
  const dominant: StreamId | null = dominantBiocharStream(allocations);
  const permanence = dominant ? permanenceFor(dominant, state.assumptions.soilTempC) : null;
  // Uncertainty is deliberately off here: a 2000-draw Monte Carlo per week would
  // dominate the runtime, and the band belongs to the current plan, not to history.
  return buildLedger(agg, state.assumptions, permanence, false);
}

/**
 * Re-solves the network on each of the last `weeks` weeks of observed supply.
 *
 * Cost is one optimiser call per week. Shadow prices and the rejected-alternatives
 * comparison are skipped — neither is read from a history point — which is what
 * keeps this affordable enough to compute on demand.
 */
export function carbonHistory(
  state: NetworkState,
  objective: ObjectiveMode,
  weeks = 20,
): CarbonHistory {
  const series = weeklySupply(state);
  const windowWeeks = Math.max(1, Math.round(state.assumptions.windowDays / 7));
  const perWindow = state.assumptions.windowDays / 7;
  const asOfMs = Date.parse(state.asOf + 'T00:00:00Z');

  const points: CarbonHistoryPoint[] = [];

  for (let back = weeks - 1; back >= 0; back--) {
    const w = HISTORY_WEEKS - 1 - back;
    const sources = state.sources.map((s) => {
      const weekly = series.get(s.id)?.[w] ?? 0;
      return { ...s, availableT: weekly * perWindow };
    });
    const weekState: NetworkState = { ...state, sources };

    const result = optimize(weekState, objective, {
      skipShadowPrices: true,
      skipAlternatives: true,
    });
    const ledger = ledgerFor(weekState, result.allocations);
    const t = result.totals;

    points.push({
      weekIndex: -back,
      date: new Date(asOfMs - back * WEEK_MS).toISOString().slice(0, 10),
      suppliedT: t.suppliedT,
      divertedT: t.divertedT,
      strandedT: t.strandedT,
      netT: ledger.netT,
      durableRemovalT: ledger.durableRemovalT,
      avoidedEmissionsT: ledger.avoidedEmissionsT,
      substitutionT: ledger.substitutionT,
      emissionsT: ledger.emissionsT,
      transportEmissionsT: t.transportEmissionsT,
      processEmissionsT: t.processEmissionsT,
      intensityTPerT: t.divertedT > 0 ? ledger.netT / t.divertedT : 0,
      tonnesByPathway: tonnesByPathway(result.allocations),
      netByFacility: netByFacility(weekState, result.allocations),
    });
  }

  const period = comparePeriods(points, windowWeeks);
  const drivers = changeDrivers(points, windowWeeks);

  return {
    points,
    period,
    drivers,
    narrative: composeNarrative(period, drivers),
    basis:
      `Each point is a full re-solve of the network on that week's observed supply, ` +
      `expressed as tCO₂e per ${state.assumptions.windowDays}-day window so it stays ` +
      `comparable to the headline figure. Supply varies; prices, assumptions and the ` +
      `facility estate are held at their current values, because no history exists for them.`,
  };
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/**
 * Indian digit grouping, to match the formatting the rest of the product uses.
 * Composed here rather than in the client because these strings are prose: the
 * copilot and any future report reads them as written.
 */
function grouped(v: number): string {
  return Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function comparePeriods(
  points: CarbonHistoryPoint[],
  windowWeeks: number,
): PeriodComparison {
  const n = Math.min(windowWeeks, Math.floor(points.length / 2));
  const current = points.slice(points.length - n);
  const previous = points.slice(points.length - 2 * n, points.length - n);
  const currentT = mean(current.map((p) => p.netT));
  const previousT = mean(previous.map((p) => p.netT));
  const deltaT = currentT - previousT;
  return {
    currentT,
    previousT,
    deltaT,
    deltaPct: previousT !== 0 ? (deltaT / Math.abs(previousT)) * 100 : 0,
    weeks: n,
    // More net carbon removed or avoided is an improvement.
    improving: deltaT >= 0,
  };
}

/**
 * Attributes the period-over-period change to the ledger groups that moved, plus
 * the physical movement behind it.
 *
 * Every figure here is a difference of two measured means. Nothing is modelled and
 * nothing is apportioned by assumption, so the drivers reconcile to the net change.
 */
export function changeDrivers(points: CarbonHistoryPoint[], windowWeeks: number): ChangeDriver[] {
  const n = Math.min(windowWeeks, Math.floor(points.length / 2));
  if (n === 0) return [];
  const cur = points.slice(points.length - n);
  const prev = points.slice(points.length - 2 * n, points.length - n);
  const d = (f: (p: CarbonHistoryPoint) => number) => mean(cur.map(f)) - mean(prev.map(f));

  const tonnesT = d((p) => p.divertedT);
  const drivers: ChangeDriver[] = [
    {
      key: 'removal',
      label: 'Durable removal',
      deltaT: d((p) => p.durableRemovalT),
      detail: 'Carbon fixed in biochar, after the permanence adjustment',
    },
    {
      key: 'avoided',
      label: 'Avoided disposal',
      deltaT: d((p) => p.avoidedEmissionsT),
      detail: 'Methane and N₂O not released by the counterfactual fate',
    },
    {
      key: 'substitution',
      label: 'Fossil displacement',
      deltaT: d((p) => p.substitutionT),
      detail: 'Coal, CNG, grid power and synthetic nitrogen displaced',
    },
    {
      key: 'transport',
      label: 'Transport emissions',
      deltaT: -d((p) => p.transportEmissionsT),
      detail: 'Well-to-wheel haulage including empty return legs',
    },
    {
      key: 'process',
      label: 'Processing emissions',
      deltaT: -d((p) => p.processEmissionsT),
      detail: 'Parasitic grid draw, digester slip and windrow emissions',
    },
  ].filter((x) => Math.abs(x.deltaT) >= 0.5);

  drivers.sort((a, b) => Math.abs(b.deltaT) - Math.abs(a.deltaT));

  // The physical movement behind the change, reported alongside rather than folded in.
  const shift = pathwayShift(cur, prev);
  if (shift) {
    drivers.push({
      key: 'throughput',
      label: 'Throughput shift',
      deltaT: 0,
      detail:
        `${grouped(shift.tonnes)} t ${shift.tonnes >= 0 ? 'more' : 'less'} ` +
        `routed to ${PATHWAYS[shift.pathway].short}` +
        (Math.abs(tonnesT) >= 1
          ? ` and ${grouped(tonnesT)} t ${tonnesT >= 0 ? 'more' : 'less'} diverted overall`
          : ''),
    });
  }
  return drivers;
}

function pathwayShift(
  cur: CarbonHistoryPoint[],
  prev: CarbonHistoryPoint[],
): { pathway: PathwayId; tonnes: number } | null {
  const ids = new Set<PathwayId>();
  for (const p of [...cur, ...prev]) {
    for (const k of Object.keys(p.tonnesByPathway) as PathwayId[]) ids.add(k);
  }
  let best: { pathway: PathwayId; tonnes: number } | null = null;
  for (const id of ids) {
    const delta =
      mean(cur.map((p) => p.tonnesByPathway[id] ?? 0)) -
      mean(prev.map((p) => p.tonnesByPathway[id] ?? 0));
    if (!best || Math.abs(delta) > Math.abs(best.tonnes)) best = { pathway: id, tonnes: delta };
  }
  return best && Math.abs(best.tonnes) >= 1 ? best : null;
}

/**
 * Composes the "what changed" sentence.
 *
 * Strictly a rendering of the driver list: the lead driver, the physical movement
 * if one was detected, and the largest offsetting driver if one exists. No claim
 * appears here that is not a measured difference.
 */
export function composeNarrative(period: PeriodComparison, drivers: ChangeDriver[]): string {
  const t = (x: number) => `${grouped(x)} tCO₂e`;
  if (Math.abs(period.deltaT) < 0.5) {
    return `Net impact held steady against the previous ${period.weeks}-week period, within half a tonne of CO₂e.`;
  }

  const direction = period.deltaT > 0 ? 'increased' : 'decreased';
  const scored = drivers.filter((x) => x.key !== 'throughput' && Math.abs(x.deltaT) >= 0.5);
  const lead = scored[0];
  const shift = drivers.find((x) => x.key === 'throughput');

  let s = `Net impact ${direction} by ${t(period.deltaT)} against the previous ${period.weeks}-week period.`;
  if (!lead) return s;

  s += ` The main driver was ${lead.label.toLowerCase()}, ${lead.deltaT > 0 ? 'up' : 'down'} ${t(lead.deltaT)}`;
  if (shift) s += `, on ${shift.detail}`;
  s += '.';

  // An offset only counts if it pushed the other way from the lead driver.
  const offset = scored.slice(1).find((x) => Math.sign(x.deltaT) !== Math.sign(lead.deltaT));
  if (offset) {
    s += ` Partially offset by ${offset.label.toLowerCase()}, ${offset.deltaT > 0 ? 'up' : 'down'} ${t(offset.deltaT)}.`;
  }
  return s;
}
