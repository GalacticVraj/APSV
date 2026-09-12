/**
 * Where the network could create more net carbon, and what change would do it.
 *
 * The design decision that makes this defensible: **an opportunity is a scenario**.
 * Not a heuristic, not a rule that fires on a threshold, not a score. Each
 * candidate is a real `ScenarioInstance` that the existing scenario engine applies
 * to a clone of the network and re-optimises, and the improvement reported is the
 * difference between two ledgers built from two real solves.
 *
 * Three things follow from that, all of them load-bearing:
 *
 *  1. Nothing is estimated with a formula. The number on the page is what the
 *     optimiser actually produced when the change was applied.
 *  2. "Simulate" is free and cannot drift: the page hands the Scenarios screen the
 *     same `ScenarioInstance` it evaluated, so the user re-runs the identical change.
 *  3. Candidates that do NOT improve carbon are kept and reported with their
 *     measured delta. A page that only shows what worked is hiding the shape of the
 *     problem — and "solving on profit-first would cost 3,156 tCO₂e" is one of the
 *     more useful things this network can tell a carbon manager.
 *
 * Every opportunity carries why the optimiser has not already taken it, read from
 * real state — a binding capacity constraint, or the objective currently in force.
 * An opportunity without that explanation is a misleading recommendation.
 */

import { optimize } from './optimizer.ts';
import { runScenario } from './scenario.ts';
import { networkLedger, OWN_BASIS } from './carbon.ts';
import { OBJECTIVE_META } from './constants.ts';
import type {
  FlowChange,
  NetworkState,
  ObjectiveMode,
  OptimizationResult,
  ScenarioInstance,
} from './types.ts';

/** Capacity increment tested at a binding site, tonnes per day. */
const UPRATE_TPD = 40;

export interface OpportunityMeasure {
  carbonBeforeT: number;
  carbonAfterT: number;
  carbonDeltaT: number;
  marginBeforeInr: number;
  marginAfterInr: number;
  marginDeltaInr: number;
  divertedBeforeT: number;
  divertedAfterT: number;
  divertedDeltaT: number;
  strandedDeltaT: number;
  tkmDeltaPct: number;
  /** net carbon gained per additional tonne placed; null when no extra tonnage moved */
  carbonPerAddedTonneT: number | null;
}

export interface Opportunity {
  id: string;
  kind: 'objective' | 'capacity';
  headline: string;
  /** the exact change, handed to the Scenarios screen unmodified */
  scenario: ScenarioInstance;
  scenarioLabel: string;
  measure: OpportunityMeasure;
  why: string;
  whyNotAlready: string;
  /** the largest material movements the re-solve produced */
  flowChanges: FlowChange[];
  facilityId: string | null;
  solveMs: number;
}

export interface RejectedCandidate {
  id: string;
  headline: string;
  carbonDeltaT: number;
  marginDeltaInr: number;
  reason: string;
}

export interface OpportunityReport {
  current: {
    carbonT: number;
    marginInr: number;
    divertedT: number;
    strandedT: number;
    objective: ObjectiveMode;
  };
  opportunities: Opportunity[];
  /** candidates measured and found not to improve carbon, kept rather than hidden */
  rejected: RejectedCandidate[];
  candidatesTested: number;
  basis: string;
}

// ─────────────────────────────────────────────────────────────────────────────

interface Candidate {
  id: string;
  kind: Opportunity['kind'];
  headline: string;
  scenario: ScenarioInstance;
  facilityId: string | null;
  whyNotAlready: string;
}

function buildCandidates(state: NetworkState, result: OptimizationResult): Candidate[] {
  const out: Candidate[] = [];
  const current = result.objective;

  // 1. A different objective. Immediately available — it is a choice, not an
  //    investment — which is exactly why it belongs at the top of the list.
  for (const mode of Object.keys(OBJECTIVE_META) as ObjectiveMode[]) {
    if (mode === current) continue;
    out.push({
      id: `objective:${mode}`,
      kind: 'objective',
      headline: `Re-solve the network on ${OBJECTIVE_META[mode].label}`,
      scenario: { kind: 'objective_change', params: { objective: mode } },
      facilityId: null,
      whyNotAlready:
        `The network is currently solved under the ${OBJECTIVE_META[current].label} objective, ` +
        `which weighs operating margin alongside carbon. The optimiser is doing exactly what it ` +
        `was asked; this changes the instruction rather than the network.`,
    });
  }

  // 2. More throughput where capacity actually binds. A plant with spare capacity
  //    is not a candidate: the optimiser would already be using it.
  const facById = new Map(state.facilities.map((f) => [f.id, f]));
  for (const s of result.shadowPrices) {
    if (!s.binding) continue;
    const f = facById.get(s.facilityId);
    if (!f || f.status !== 'online') continue;
    out.push({
      id: `capacity:${s.facilityId}`,
      kind: 'capacity',
      headline: `Commission ${UPRATE_TPD} t/day more at ${s.facilityName}`,
      scenario: {
        kind: 'new_facility',
        params: { facilityId: s.facilityId, addTpd: UPRATE_TPD },
      },
      facilityId: s.facilityId,
      whyNotAlready:
        `Capacity here is binding at ${s.utilisationPct.toFixed(0)}% of nameplate. The optimiser ` +
        `cannot route more material to this plant however valuable it would be — only added ` +
        `throughput can, and that is an investment decision rather than a routing one.`,
    });
  }

  return out;
}

function measure(
  state: NetworkState,
  beforeResult: OptimizationResult,
  afterResult: OptimizationResult,
): OpportunityMeasure {
  // Two complete plans: each valued on its own feedstock mix.
  const before = networkLedger(
    beforeResult.allocations,
    state.facilities,
    state.vehicles,
    state.assumptions,
    OWN_BASIS,
  );
  // The after-state is measured on the same estate for the ledger's factor set;
  // the scenario's own mutations are already baked into its allocations.
  const after = networkLedger(
    afterResult.allocations,
    state.facilities,
    state.vehicles,
    state.assumptions,
    OWN_BASIS,
  );

  const divertedDeltaT = afterResult.totals.divertedT - beforeResult.totals.divertedT;
  const carbonDeltaT = after.netT - before.netT;

  return {
    carbonBeforeT: before.netT,
    carbonAfterT: after.netT,
    carbonDeltaT,
    marginBeforeInr: beforeResult.totals.marginInr,
    marginAfterInr: afterResult.totals.marginInr,
    marginDeltaInr: afterResult.totals.marginInr - beforeResult.totals.marginInr,
    divertedBeforeT: beforeResult.totals.divertedT,
    divertedAfterT: afterResult.totals.divertedT,
    divertedDeltaT,
    strandedDeltaT: afterResult.totals.strandedT - beforeResult.totals.strandedT,
    tkmDeltaPct:
      beforeResult.totals.tkm > 0
        ? ((afterResult.totals.tkm - beforeResult.totals.tkm) / beforeResult.totals.tkm) * 100
        : 0,
    carbonPerAddedTonneT:
      Math.abs(divertedDeltaT) > 1 ? carbonDeltaT / divertedDeltaT : null,
  };
}

/**
 * Why the change helps, written from the measured deltas rather than from the
 * category it belongs to. Two capacity opportunities at different plants produce
 * different sentences because they produced different numbers.
 */
function composeWhy(c: Candidate, m: OpportunityMeasure): string {
  const n = (v: number, dp = 0) =>
    Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: dp });

  /**
   * Matches the client's own rupee formatter, which switches to lakh below a
   * crore. Quoting ₹0.27 Cr in this sentence while the panel beside it reads
   * ₹27.05 L is the same quantity twice in two scales, on one card.
   */
  const rupees = (v: number) => {
    const a = Math.abs(v);
    if (a >= 1e7) return `₹${n(a / 1e7, 2)} Cr`;
    if (a >= 1e5) return `₹${n(a / 1e5, 2)} L`;
    return `₹${n(a)}`;
  };
  const cr = rupees;

  const bits: string[] = [];
  if (m.divertedDeltaT > 1) {
    bits.push(`${n(m.divertedDeltaT)} t more material is placed`);
  } else if (m.divertedDeltaT < -1) {
    bits.push(`${n(m.divertedDeltaT)} t less material is placed, but at a higher carbon value`);
  }
  if (m.strandedDeltaT < -1) bits.push(`${n(m.strandedDeltaT)} t less is left stranded`);

  let s =
    bits.length > 0
      ? `Re-optimising with this change, ${bits.join(' and ')}, lifting net carbon by ${n(m.carbonDeltaT)} tCO₂e.`
      : `Re-optimising with this change lifted net carbon by ${n(m.carbonDeltaT)} tCO₂e on the same tonnage, by routing it better.`;

  if (m.carbonPerAddedTonneT !== null) {
    s += ` That is ${n(m.carbonPerAddedTonneT, 3)} tCO₂e per additional tonne moved.`;
  }

  if (m.marginDeltaInr > 1e5) {
    s += ` Operating margin also rises by ${cr(m.marginDeltaInr)}, so carbon and economics agree here.`;
  } else if (m.marginDeltaInr < -1e5) {
    s += ` Operating margin falls by ${cr(m.marginDeltaInr)}, so this is a genuine trade-off rather than a free gain.`;
  }
  return s;
}

/**
 * Evaluates every candidate by actually applying it and re-solving.
 *
 * Roughly 20 ms per candidate on this network, so the whole sweep is well under a
 * second and does not need to be approximated.
 */
export function findOpportunities(
  state: NetworkState,
  result: OptimizationResult,
): OpportunityReport {
  const candidates = buildCandidates(state, result);
  const opportunities: Opportunity[] = [];
  const rejected: RejectedCandidate[] = [];

  const before = networkLedger(
    result.allocations,
    state.facilities,
    state.vehicles,
    state.assumptions,
    OWN_BASIS,
  );

  for (const c of candidates) {
    const t0 = Date.now();
    const run = runScenario(state, c.scenario, result.objective, result);
    const solveMs = Date.now() - t0;
    const m = measure(state, result, run.after);

    // The threshold is one tonne of CO2e, not a percentage: below that the change
    // is noise and presenting it as an opportunity would be padding the list.
    if (m.carbonDeltaT <= 1) {
      rejected.push({
        id: c.id,
        headline: c.headline,
        carbonDeltaT: m.carbonDeltaT,
        marginDeltaInr: m.marginDeltaInr,
        reason:
          m.carbonDeltaT < -1
            ? `Measured by re-optimisation: this would cost ${Math.abs(m.carbonDeltaT).toLocaleString('en-IN', { maximumFractionDigits: 0 })} tCO₂e.`
            : 'Measured by re-optimisation: no material carbon change.',
      });
      continue;
    }

    opportunities.push({
      id: c.id,
      kind: c.kind,
      headline: c.headline,
      scenario: c.scenario,
      scenarioLabel: run.label,
      measure: m,
      why: composeWhy(c, m),
      whyNotAlready: c.whyNotAlready,
      flowChanges: run.flowChanges
        .slice()
        .sort((a, b) => Math.abs(b.carbonDeltaT) - Math.abs(a.carbonDeltaT))
        .slice(0, 6),
      facilityId: c.facilityId,
      solveMs,
    });
  }

  // Ranked on the one thing this page is about. Every secondary dimension is shown
  // rather than folded into a composite, so the ordering never needs explaining.
  opportunities.sort((a, b) => b.measure.carbonDeltaT - a.measure.carbonDeltaT);
  rejected.sort((a, b) => b.carbonDeltaT - a.carbonDeltaT);

  return {
    current: {
      carbonT: before.netT,
      marginInr: result.totals.marginInr,
      divertedT: result.totals.divertedT,
      strandedT: result.totals.strandedT,
      objective: result.objective,
    },
    opportunities,
    rejected,
    candidatesTested: candidates.length,
    basis:
      `Every figure here is the difference between two full optimiser runs: the current plan, ` +
      `and the plan after the change was applied to a clone of the network. Nothing is ` +
      `extrapolated. Both sides are modelled estimates for one ` +
      `${state.assumptions.windowDays}-day planning window — a modelled improvement, not a ` +
      `guaranteed reduction, and not a carbon credit.`,
  };
}

/**
 * Re-runs one opportunity and returns the scenario result in full.
 *
 * Used when the detail view needs the flow-level diff and narrative the summary
 * does not carry. Same engine, same scenario instance.
 */
export function explainOpportunity(
  state: NetworkState,
  result: OptimizationResult,
  scenario: ScenarioInstance,
) {
  const run = runScenario(state, scenario, result.objective, result);
  return { run, measure: measure(state, result, run.after) };
}

/** Convenience for callers that hold no prior solve. */
export function opportunitiesFor(state: NetworkState, mode: ObjectiveMode): OpportunityReport {
  return findOpportunities(state, optimize(state, mode));
}
