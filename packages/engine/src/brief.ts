/**
 * The Carbon Intelligence Brief.
 *
 * This module computes nothing. Every figure it returns is read from a module that
 * already owns it — the ledger, the history, the opportunity sweep, the shock
 * engine, the facility ranking, the evidence register, the N-1 resilience
 * analysis. The brief's only job is selection and composition: decide which of
 * those findings a decision-maker needs in one minute, and say them in order.
 *
 * That constraint is the point. A report that recomputes anything is a second
 * opinion with editorial authority, and it will eventually disagree with the
 * screen it summarises. Here, if the Ledger changes, the brief changes with it,
 * because it is the same number and not a copy of it.
 *
 * The one thing the brief adds is prose, and even that is assembled strictly from
 * measured values: the headline names the real top opportunity and the real worst
 * contingency, and says nothing that is not in the numbers beside it.
 */

import { inheritFrom, networkLedger } from './carbon.ts';
import { PATHWAYS } from './pathways.ts';
import { STREAMS } from './streams.ts';
import { OBJECTIVE_META } from './constants.ts';
import type { Opportunity } from './opportunity.ts';
import type { ObjectiveOutcome, ShockResult } from './shock.ts';
import type { EvidenceHealth } from './evidence.ts';
import type { FacilityRankRow } from './facility.ts';
import type { CarbonHistory } from './history.ts';
import type {
  Allocation,
  CarbonLedger,
  NetworkState,
  ObjectiveMode,
  OptimizationResult,
  PathwayId,
  ResilienceReport,
  ScenarioInstance,
  StreamId,
} from './types.ts';

export interface BriefPosition {
  netT: number;
  removalT: number;
  avoidedT: number;
  substitutionT: number;
  grossBenefitT: number;
  transportT: number;
  processT: number;
  adjustmentT: number;
  suppliedT: number;
  divertedT: number;
  strandedT: number;
  perTonneT: number;
  uncertainty: { p5: number; p95: number; draws: number } | null;
}

export interface BriefTrend {
  deltaT: number;
  deltaPct: number;
  weeks: number;
  improving: boolean;
  basis: string;
  narrative: string;
}

export interface BriefAction {
  headline: string;
  carbonDeltaT: number;
  marginDeltaInr: number;
  tonnesDeltaT: number;
  scenario: ScenarioInstance;
  why: string;
  whyNotAlready: string;
  facilityId: string | null;
}

export interface BriefRisk {
  facilityId: string;
  facilityName: string;
  scenario: ScenarioInstance;
  baselineNetT: number;
  afterNetT: number;
  carbonDeltaT: number;
  carbonLossPct: number;
  marginDeltaInr: number;
  strandedDeltaT: number;
  flowsChanged: number;
  facilitiesChanged: number;
  why: string;
  resilienceScore: number;
  resilienceGrade: string;
  resilienceMethod: string;
}

/** One band of the flow visualisation: material in, carbon out, per pathway. */
export interface BriefFlowBand {
  pathway: PathwayId;
  label: string;
  tonnes: number;
  netT: number;
  perTonneT: number;
  facilityCount: number;
  topFacilities: Array<{ id: string; name: string; tonnes: number }>;
  topStreams: Array<{ stream: StreamId; label: string; tonnes: number }>;
}

export interface BriefContributors {
  best: FacilityRankRow | null;
  weakestPerTonne: FacilityRankRow | null;
  largestIdle: FacilityRankRow | null;
}

export interface BriefMethodology {
  planningWindow: string;
  supplyBasis: string;
  allocationBasis: string;
  transportBasis: string;
  processingBasis: string;
  permanenceBasis: string;
  trendBasis: string;
  limitations: string[];
}

export interface CarbonBrief {
  generatedAt: string;
  asOf: string;
  windowDays: number;
  version: number;
  objective: ObjectiveMode;
  objectiveLabel: string;

  headline: string;
  whatChanged: string;

  position: BriefPosition;
  trend: BriefTrend | null;
  flow: BriefFlowBand[];
  action: BriefAction | null;
  risk: BriefRisk | null;
  objectives: ObjectiveOutcome[] | null;
  contributors: BriefContributors;
  evidence: EvidenceHealth;
  methodology: BriefMethodology;

  /** honest statements where a section has nothing to report */
  notes: { action: string | null; risk: string | null; trend: string | null };
}

// ─────────────────────────────────────────────────────────────────────────────

function splitLedger(ledger: CarbonLedger): Omit<
  BriefPosition,
  'suppliedT' | 'divertedT' | 'strandedT' | 'perTonneT' | 'uncertainty'
> {
  const sum = (pred: (k: string) => boolean) =>
    ledger.lines.filter((l) => pred(l.key)).reduce((a, l) => a + l.valueT, 0);
  return {
    netT: ledger.netT,
    removalT: ledger.durableRemovalT,
    avoidedT: ledger.avoidedEmissionsT,
    substitutionT: ledger.substitutionT,
    grossBenefitT: ledger.durableRemovalT + ledger.avoidedEmissionsT + ledger.substitutionT,
    // Charges are reported positive; the decomposition subtracts them.
    transportT: -sum((k) => k === 'em_transport' || k === 'em_aggregation'),
    processT: -sum((k) => k.startsWith('em_') && k !== 'em_transport' && k !== 'em_aggregation'),
    adjustmentT: -sum((k) => k === 'char_permanence'),
  };
}

/**
 * Material and carbon per pathway.
 *
 * Built by grouping the plan's own allocations and running each group through
 * `networkLedger`, so the bands sum to the network figure exactly. Removal,
 * avoidance and substitution are not merged here either — the band carries net,
 * and the deeper split stays in the Ledger where it belongs.
 */
function buildFlow(
  state: NetworkState,
  allocations: Allocation[],
): BriefFlowBand[] {
  // The whole plan's permanence feedstock, so the bands sum to the network figure
  // rather than each band picking its own BC100.
  const basis = inheritFrom(allocations);
  const byPathway = new Map<PathwayId, Allocation[]>();
  for (const a of allocations) {
    const list = byPathway.get(a.pathway);
    if (list) list.push(a);
    else byPathway.set(a.pathway, [a]);
  }

  const facName = new Map(state.facilities.map((f) => [f.id, f.name]));
  const bands: BriefFlowBand[] = [];

  for (const [pathway, list] of byPathway) {
    const tonnes = list.reduce((a, x) => a + x.tonnes, 0);
    const netT = networkLedger(
      list,
      state.facilities,
      state.vehicles,
      state.assumptions,
      basis,
    ).netT;

    const facT = new Map<string, number>();
    const strT = new Map<StreamId, number>();
    for (const a of list) {
      facT.set(a.facilityId, (facT.get(a.facilityId) ?? 0) + a.tonnes);
      strT.set(a.stream, (strT.get(a.stream) ?? 0) + a.tonnes);
    }

    bands.push({
      pathway,
      label: PATHWAYS[pathway].short,
      tonnes,
      netT,
      perTonneT: tonnes > 0 ? netT / tonnes : 0,
      facilityCount: facT.size,
      topFacilities: [...facT.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id, t]) => ({ id, name: facName.get(id) ?? id, tonnes: t })),
      topStreams: [...strT.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([stream, t]) => ({ stream, label: STREAMS[stream].label, tonnes: t })),
    });
  }

  bands.sort((a, b) => b.netT - a.netT);
  return bands;
}

function pickContributors(ranking: FacilityRankRow[]): BriefContributors {
  const working = ranking.filter((r) => r.receivedT > 0);
  const idleCandidates = ranking
    .filter((r) => r.status === 'online' && r.capacityT - r.receivedT > 1)
    .sort((a, b) => b.capacityT - b.receivedT - (a.capacityT - a.receivedT));
  return {
    best: working[0] ?? null,
    weakestPerTonne:
      working.length > 1
        ? [...working].sort((a, b) => a.perTonneT - b.perTonneT)[0]
        : null,
    largestIdle: idleCandidates[0] ?? null,
  };
}

/**
 * The executive interpretation.
 *
 * Names the real position, the real strongest opportunity and the real worst
 * contingency. Every clause is a value that appears elsewhere in the brief; if a
 * section has nothing, the sentence omits it rather than softening it.
 */
function composeHeadline(
  position: BriefPosition,
  action: BriefAction | null,
  risk: BriefRisk | null,
  trend: BriefTrend | null,
): string {
  const n = (v: number, dp = 0) =>
    Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: dp });

  let s = `The current plan produces ${n(position.netT)} tCO₂e of net carbon impact across ${n(position.divertedT)} t of diverted material`;
  if (position.strandedT > 1) s += `, with ${n(position.strandedT)} t left unplaced`;
  s += '.';

  if (action) {
    // Only the first character is lowered: a full toLowerCase strips the capitals
    // off the plant name and the sentence reads "at jagraon pellet plant".
    const phrase = action.headline.charAt(0).toLowerCase() + action.headline.slice(1);
    s += ` The strongest measured upside is to ${phrase}, worth ${n(action.carbonDeltaT)} tCO₂e.`;
  } else {
    s += ` No tested change improved net carbon under the current constraints.`;
  }

  if (risk) {
    s += ` The largest identified resilience risk is losing ${risk.facilityName}, which the optimiser absorbs at a cost of ${n(risk.carbonDeltaT)} tCO₂e — ${n(risk.carbonLossPct, 1)}% of the network's carbon.`;
  }

  if (trend && Math.abs(trend.deltaPct) >= 1) {
    s += ` Against the previous ${trend.weeks}-week period the position has ${trend.improving ? 'improved' : 'weakened'} by ${n(Math.abs(trend.deltaPct), 1)}%.`;
  }
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────

export interface BriefInputs {
  state: NetworkState;
  result: OptimizationResult;
  version: number;
  ledger: CarbonLedger;
  history: CarbonHistory | null;
  opportunities: Opportunity[];
  ranking: FacilityRankRow[];
  evidence: EvidenceHealth;
  resilience: ResilienceReport;
  /** the worst contingency, already run through the shock engine */
  worstShock: ShockResult | null;
  objectives: ObjectiveOutcome[] | null;
}

/**
 * Assembles the brief from artefacts the Twin already owns.
 *
 * Everything arrives pre-computed. This function selects and phrases; it does not
 * solve, and it does not recalculate a single tonne of CO2e.
 */
export function buildBrief(inputs: BriefInputs): CarbonBrief {
  const {
    state,
    result,
    version,
    ledger,
    history,
    opportunities,
    ranking,
    evidence,
    resilience,
    worstShock,
    objectives,
  } = inputs;

  const split = splitLedger(ledger);
  const position: BriefPosition = {
    ...split,
    suppliedT: result.totals.suppliedT,
    divertedT: result.totals.divertedT,
    strandedT: result.totals.strandedT,
    perTonneT: result.totals.divertedT > 0 ? ledger.netT / result.totals.divertedT : 0,
    uncertainty: ledger.uncertainty
      ? { p5: ledger.uncertainty.p5, p95: ledger.uncertainty.p95, draws: ledger.uncertainty.draws }
      : null,
  };

  const trend: BriefTrend | null = history
    ? {
        deltaT: history.period.deltaT,
        deltaPct: history.period.deltaPct,
        weeks: history.period.weeks,
        improving: history.period.improving,
        basis: history.basis,
        narrative: history.narrative,
      }
    : null;

  const top = opportunities[0] ?? null;
  const action: BriefAction | null = top
    ? {
        headline: top.headline,
        carbonDeltaT: top.measure.carbonDeltaT,
        marginDeltaInr: top.measure.marginDeltaInr,
        tonnesDeltaT: top.measure.divertedDeltaT,
        scenario: top.scenario,
        why: top.why,
        whyNotAlready: top.whyNotAlready,
        facilityId: top.facilityId,
      }
    : null;

  const worstRow = resilience.n1Results[0] ?? null;
  const risk: BriefRisk | null =
    worstShock && worstRow
      ? {
          facilityId: resilience.worstCaseFacilityId,
          facilityName: resilience.worstCaseFacilityName,
          scenario: worstShock.scenario,
          baselineNetT: worstShock.baseline.netT,
          afterNetT: worstShock.after.netT,
          carbonDeltaT: worstShock.carbonDeltaT,
          carbonLossPct: resilience.worstCaseLossPct,
          marginDeltaInr: worstShock.marginDeltaInr,
          strandedDeltaT: worstShock.after.strandedT - worstShock.baseline.strandedT,
          flowsChanged: worstShock.flowChanges.length,
          facilitiesChanged: worstShock.changedFacilities.length,
          why: worstShock.why,
          resilienceScore: resilience.score,
          resilienceGrade: resilience.grade,
          resilienceMethod: resilience.method,
        }
      : null;

  const methodology: BriefMethodology = {
    planningWindow: `${state.assumptions.windowDays}-day forward window to ${state.asOf}, solved under the ${OBJECTIVE_META[result.objective].label} objective.`,
    supplyBasis:
      'Per-source availability generated from the crop calendar with a seeded weather shock. Not collected from the field.',
    allocationBasis:
      'Min-cost flow with Johnson potentials over the feasible arc set, with branch and bound over which plants operate.',
    transportBasis:
      'Well-to-wheel diesel on the achievable payload, including the empty return leg, plus field aggregation.',
    processingBasis:
      'Parasitic grid draw at the Indian grid factor, digester methane slip, and turned-windrow composting rates rather than the static-pile default.',
    permanenceBasis:
      'Two-pool decay parameterised by the char H/C(org) ratio, Q10-corrected from the reference dataset to Indian soil temperature. Durable removal and avoided emissions are never summed.',
    trendBasis: history
      ? history.basis
      : 'No trend computed for this brief.',
    limitations: [
      'Every carbon figure is a model output. Nothing in this network is a measurement.',
      'Biogenic CO₂ is excluded: only CH₄ and N₂O from the counterfactual fate are counted as a real atmospheric addition.',
      'The trend re-solves past supply; it is not a record of historical emissions.',
      'Opportunity and shock figures are differences between two modelled plans, not forecasts of realised outcomes.',
    ],
  };

  return {
    generatedAt: new Date().toISOString(),
    asOf: state.asOf,
    windowDays: state.assumptions.windowDays,
    version,
    objective: result.objective,
    objectiveLabel: OBJECTIVE_META[result.objective].label,
    headline: composeHeadline(position, action, risk, trend),
    whatChanged:
      trend && Math.abs(trend.deltaT) >= 0.5
        ? trend.narrative
        : 'No material network change identified in the current comparison window.',
    position,
    trend,
    flow: buildFlow(state, result.allocations),
    action,
    risk,
    objectives,
    contributors: pickContributors(ranking),
    evidence,
    methodology,
    notes: {
      action:
        action === null
          ? 'No tested change improved net carbon under the current network constraints. The candidates and their measured outcomes are listed in Opportunities.'
          : null,
      risk:
        risk === null
          ? 'No single-facility contingency could be evaluated for this network.'
          : null,
      trend:
        trend === null
          ? 'No trend is available for this brief. A planning-window result is not a historical measurement, and none has been computed.'
          : null,
    },
  };
}
