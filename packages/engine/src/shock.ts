/**
 * The shock engine: what happens to carbon when the network changes.
 *
 * This module adds no simulation of its own. `runScenario` already clones the
 * network, applies a `ScenarioInstance`, re-optimises and diffs the flows; what
 * was missing was the carbon reading of that result. So this wraps the existing
 * engine and answers the three questions a carbon manager asks after a shock:
 *
 *   How much did net carbon move, and is that a real number?
 *   What physically changed — which source, which plant, which pathway?
 *   Why did the optimiser respond that way?
 *
 * The decomposition is the part worth defending. Rather than attributing the
 * change to categories invented for the UI, it **diffs the two ledgers line by
 * line**. Every driver is therefore a real ledger line, and the drivers sum to the
 * net change by construction rather than by agreement — there is no residual and
 * no "other" bucket to hide one in.
 *
 * A scenario never touches the live network. `cloneNetwork` deep-copies every
 * mutable field and `runScenario` works on that copy; a test in this suite holds
 * the baseline byte-identical across a run.
 */

import { optimize } from './optimizer.ts';
import { runScenario } from './scenario.ts';
import { inheritFrom, networkLedger, OWN_BASIS } from './carbon.ts';
import { OBJECTIVE_META } from './constants.ts';
import { PATHWAYS } from './pathways.ts';
import type {
  CarbonLedger,
  FlowChange,
  LedgerLine,
  NetworkState,
  ObjectiveMode,
  OptimizationResult,
  ScenarioInstance,
  SolveStage,
} from './types.ts';

export interface LedgerLineDelta {
  key: string;
  label: string;
  kind: LedgerLine['kind'];
  before: number;
  after: number;
  delta: number;
}

export interface GroupDelta {
  key: string;
  label: string;
  /** contribution to the change in net carbon, tCO2e */
  delta: number;
  /** does a positive value here help the network */
  benefit: boolean;
}

export interface ChangedFacility {
  id: string;
  name: string;
  pathwayShort: string;
  beforeT: number;
  afterT: number;
  tonnesDeltaT: number;
  beforeCarbonT: number;
  afterCarbonT: number;
  carbonDeltaT: number;
}

export interface ConstraintChange {
  facilityId: string;
  facilityName: string;
  beforeBinding: boolean;
  afterBinding: boolean;
  beforeUtilPct: number;
  afterUtilPct: number;
  /** 'became_binding' | 'became_slack' — unchanged constraints are not reported */
  change: 'became_binding' | 'became_slack';
}

export interface ObjectiveOutcome {
  objective: ObjectiveMode;
  label: string;
  /** the baseline solved under THIS objective, not under the current one */
  baselineNetT: number;
  scenarioNetT: number;
  carbonDeltaT: number;
  marginDeltaInr: number;
  isCurrent: boolean;
}

export type ShockClass =
  | 'carbon_up_econ_up'
  | 'carbon_up_econ_down'
  | 'carbon_down_econ_up'
  | 'carbon_down_econ_down';

export interface ShockSide {
  netT: number;
  marginInr: number;
  divertedT: number;
  strandedT: number;
  tkm: number;
}

export interface ShockResult {
  scenario: ScenarioInstance;
  label: string;
  objective: ObjectiveMode;

  baseline: ShockSide;
  after: ShockSide;
  carbonDeltaT: number;
  carbonDeltaPct: number;
  marginDeltaInr: number;

  /** every ledger line that moved, and the same grouped into six drivers */
  lineDeltas: LedgerLineDelta[];
  groupDeltas: GroupDelta[];

  flowChanges: FlowChange[];
  changedFacilities: ChangedFacility[];
  constraints: ConstraintChange[];

  narrative: string[];
  why: string;
  classification: ShockClass;
  stages: SolveStage[];

  /** did any material physically move, or is this purely a valuation change */
  physicallyChanged: boolean;
  unchangedReason: string | null;
  solveMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────

const GROUPS: Array<{
  key: string;
  label: string;
  benefit: boolean;
  match: (l: LedgerLineDelta) => boolean;
}> = [
  { key: 'removal', label: 'Durable removal', benefit: true, match: (l) => l.kind === 'removal' },
  { key: 'avoided', label: 'Avoided disposal', benefit: true, match: (l) => l.kind === 'avoided' },
  {
    key: 'substitution',
    label: 'Fossil displacement',
    benefit: true,
    match: (l) => l.kind === 'substitution',
  },
  {
    key: 'transport',
    label: 'Transport emissions',
    benefit: false,
    match: (l) => l.key === 'em_transport' || l.key === 'em_aggregation',
  },
  {
    key: 'processing',
    label: 'Processing emissions',
    benefit: false,
    match: (l) =>
      l.kind === 'emission' && l.key !== 'em_transport' && l.key !== 'em_aggregation',
  },
  {
    key: 'adjustment',
    label: 'Permanence adjustment',
    benefit: false,
    match: (l) => l.kind === 'adjustment',
  },
];

/**
 * Line-by-line difference between two ledgers.
 *
 * Lines present on one side only are included with zero on the other, so a
 * pathway that appears or disappears is visible rather than silently absent.
 */
function diffLedgers(before: CarbonLedger, after: CarbonLedger): LedgerLineDelta[] {
  const keys = new Set<string>();
  for (const l of before.lines) if (l.kind !== 'total') keys.add(l.key);
  for (const l of after.lines) if (l.kind !== 'total') keys.add(l.key);

  const out: LedgerLineDelta[] = [];
  for (const key of keys) {
    const b = before.lines.find((l) => l.key === key);
    const a = after.lines.find((l) => l.key === key);
    const meta = a ?? b!;
    const bv = b?.valueT ?? 0;
    const av = a?.valueT ?? 0;
    if (Math.abs(av - bv) < 1e-9) continue;
    out.push({ key, label: meta.label, kind: meta.kind, before: bv, after: av, delta: av - bv });
  }
  out.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  return out;
}

function groupDeltas(lines: LedgerLineDelta[]): GroupDelta[] {
  return GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    delta: lines.filter(g.match).reduce((a, l) => a + l.delta, 0),
    benefit: g.benefit,
  })).filter((g) => Math.abs(g.delta) > 1e-9);
}

function side(state: NetworkState, r: OptimizationResult): { s: ShockSide; ledger: CarbonLedger } {
  // A complete plan, valued on its own feedstock mix.
  const ledger = networkLedger(
    r.allocations,
    state.facilities,
    state.vehicles,
    state.assumptions,
    OWN_BASIS,
  );
  return {
    s: {
      netT: ledger.netT,
      marginInr: r.totals.marginInr,
      divertedT: r.totals.divertedT,
      strandedT: r.totals.strandedT,
      tkm: r.totals.tkm,
    },
    ledger,
  };
}

/** Plants whose intake or carbon contribution moved. */
function changedFacilities(
  state: NetworkState,
  before: OptimizationResult,
  after: OptimizationResult,
): ChangedFacility[] {
  // Each facility is a SLICE of its own plan, so both sides inherit the
  // permanence feedstock of the plan they came from. Deriving it per facility
  // valued each plant on its own biochar mix — the same defect that made the
  // brief's pathway bands miss the network total by 54 tCO2e.
  const beforeBasis = inheritFrom(before.allocations);
  const afterBasis = inheritFrom(after.allocations);

  const out: ChangedFacility[] = [];
  for (const f of state.facilities) {
    const bAlloc = before.allocations.filter((a) => a.facilityId === f.id);
    const aAlloc = after.allocations.filter((a) => a.facilityId === f.id);
    const bT = bAlloc.reduce((x, a) => x + a.tonnes, 0);
    const aT = aAlloc.reduce((x, a) => x + a.tonnes, 0);
    if (Math.abs(aT - bT) < 0.5) continue;

    const bC = networkLedger(
      bAlloc,
      state.facilities,
      state.vehicles,
      state.assumptions,
      beforeBasis,
    ).netT;
    const aC = networkLedger(
      aAlloc,
      state.facilities,
      state.vehicles,
      state.assumptions,
      afterBasis,
    ).netT;
    out.push({
      id: f.id,
      name: f.name,
      pathwayShort: PATHWAYS[f.pathway].short,
      beforeT: bT,
      afterT: aT,
      tonnesDeltaT: aT - bT,
      beforeCarbonT: bC,
      afterCarbonT: aC,
      carbonDeltaT: aC - bC,
    });
  }
  out.sort((a, b) => Math.abs(b.carbonDeltaT) - Math.abs(a.carbonDeltaT));
  return out;
}

/** Capacity constraints that flipped. Read from the optimiser's own shadow prices. */
function constraintChanges(
  before: OptimizationResult,
  after: OptimizationResult,
): ConstraintChange[] {
  const bById = new Map(before.shadowPrices.map((s) => [s.facilityId, s]));
  const out: ConstraintChange[] = [];
  for (const a of after.shadowPrices) {
    const b = bById.get(a.facilityId);
    if (!b || b.binding === a.binding) continue;
    out.push({
      facilityId: a.facilityId,
      facilityName: a.facilityName,
      beforeBinding: b.binding,
      afterBinding: a.binding,
      beforeUtilPct: b.utilisationPct,
      afterUtilPct: a.utilisationPct,
      change: a.binding ? 'became_binding' : 'became_slack',
    });
  }
  return out;
}

/**
 * Why the network responded this way.
 *
 * Assembled from measured facts only: the dominant ledger driver, the physical
 * movement behind it, and any constraint that flipped. No causal claim is made
 * that is not readable off the two solves.
 */
function composeWhy(
  r: ShockResult,
  before: OptimizationResult,
  after: OptimizationResult,
): string {
  const n = (v: number, dp = 0) =>
    Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: dp });

  if (!r.physicallyChanged) {
    return (
      `The optimiser produced the same allocation before and after. Net carbon moved by ` +
      `${n(r.carbonDeltaT)} tCO₂e because the change altered how that allocation is valued or ` +
      `charged, not where material goes.`
    );
  }

  const lead = r.groupDeltas
    .slice()
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];

  const moved = Math.abs(r.after.divertedT - r.baseline.divertedT);
  let s = `The optimiser re-solved from scratch and produced a different plan: `;
  const bits: string[] = [];
  if (moved > 0.5) {
    bits.push(
      `${n(moved)} t ${r.after.divertedT > r.baseline.divertedT ? 'more' : 'less'} material placed`,
    );
  }
  if (r.changedFacilities.length > 0) {
    bits.push(`intake changed at ${r.changedFacilities.length} plant${r.changedFacilities.length > 1 ? 's' : ''}`);
  }
  if (r.flowChanges.length > 0) {
    bits.push(`${r.flowChanges.length} source-to-plant flows altered`);
  }
  s += bits.length > 0 ? bits.join(', ') + '.' : 'the same tonnage routed differently.';

  if (lead) {
    s +=
      ` The largest carbon driver is ${lead.label.toLowerCase()}, ` +
      `${lead.delta >= 0 ? 'up' : 'down'} ${n(lead.delta)} tCO₂e.`;
  }

  const flipped = r.constraints[0];
  if (flipped) {
    s +=
      ` ${flipped.facilityName} capacity ` +
      (flipped.change === 'became_binding'
        ? `became binding at ${n(flipped.afterUtilPct)}% — it is now limiting the network.`
        : `went slack, falling from ${n(flipped.beforeUtilPct)}% to ${n(flipped.afterUtilPct)}% utilisation.`);
  }
  return s;
}

function classify(carbonDeltaT: number, marginDeltaInr: number): ShockClass {
  const c = carbonDeltaT >= 0;
  const m = marginDeltaInr >= 0;
  if (c && m) return 'carbon_up_econ_up';
  if (c && !m) return 'carbon_up_econ_down';
  if (!c && m) return 'carbon_down_econ_up';
  return 'carbon_down_econ_down';
}

/**
 * Applies a shock and reads the carbon consequence.
 *
 * `result` is the caller's existing baseline solve, passed through so the
 * before-side is the plan the rest of the product is showing rather than a
 * re-solve that could differ.
 */
export function runShock(
  state: NetworkState,
  result: OptimizationResult,
  scenario: ScenarioInstance,
  objective: ObjectiveMode,
): ShockResult {
  const t0 = Date.now();
  const run = runScenario(state, scenario, objective, result);
  const solveMs = Date.now() - t0;

  const b = side(state, run.before);
  const a = side(state, run.after);
  const lineDeltas = diffLedgers(b.ledger, a.ledger);

  const physicallyChanged =
    run.flowChanges.length > 0 ||
    Math.abs(a.s.divertedT - b.s.divertedT) > 0.5 ||
    run.before.allocations.length !== run.after.allocations.length;

  const out: ShockResult = {
    scenario,
    label: run.label,
    objective,
    baseline: b.s,
    after: a.s,
    carbonDeltaT: a.s.netT - b.s.netT,
    carbonDeltaPct: Math.abs(b.s.netT) > 1e-9 ? ((a.s.netT - b.s.netT) / Math.abs(b.s.netT)) * 100 : 0,
    marginDeltaInr: a.s.marginInr - b.s.marginInr,
    lineDeltas,
    groupDeltas: groupDeltas(lineDeltas),
    flowChanges: run.flowChanges,
    changedFacilities: changedFacilities(state, run.before, run.after),
    constraints: constraintChanges(run.before, run.after),
    narrative: run.narrative,
    why: '',
    classification: classify(a.s.netT - b.s.netT, a.s.marginInr - b.s.marginInr),
    stages: run.computeStages,
    physicallyChanged,
    unchangedReason: physicallyChanged
      ? null
      : 'Network allocation unchanged: every source keeps its destination and tonnage.',
    solveMs,
  };
  out.why = composeWhy(out, run.before, run.after);
  return out;
}

/**
 * The same shock under every objective the optimiser supports.
 *
 * Each objective gets its own baseline, because "what this change is worth"
 * depends on what the network was trying to do before it. Comparing a carbon-first
 * scenario against a balanced baseline would attribute the objective switch to the
 * shock. Eight solves, roughly 160 ms.
 */
export function compareObjectives(
  state: NetworkState,
  scenario: ScenarioInstance,
  current: ObjectiveMode,
): ObjectiveOutcome[] {
  const out: ObjectiveOutcome[] = [];
  for (const mode of Object.keys(OBJECTIVE_META) as ObjectiveMode[]) {
    const baseline = optimize(state, mode);
    const run = runScenario(state, scenario, mode, baseline);
    const b = side(state, run.before);
    const a = side(state, run.after);
    out.push({
      objective: mode,
      label: OBJECTIVE_META[mode].label,
      baselineNetT: b.s.netT,
      scenarioNetT: a.s.netT,
      carbonDeltaT: a.s.netT - b.s.netT,
      marginDeltaInr: a.s.marginInr - b.s.marginInr,
      isCurrent: mode === current,
    });
  }
  out.sort((x, y) => y.carbonDeltaT - x.carbonDeltaT);
  return out;
}
