/**
 * Evidence: can this number be defended?
 *
 * Carbon Home understands the impact, the Ledger traces it, and this module asks
 * the harder question — on what basis is any of it asserted. It is deliberately
 * not a certification system. Nothing here is verified, nothing is a credit, and
 * the page says so in the same words every other Carbon screen uses.
 *
 * Two things this module adds that did not exist before:
 *
 *  1. **Backward tracing.** The Ledger traces one allocation forward into the
 *     lines it feeds. This goes the other way: given a ledger line, which
 *     allocations produced it and in what proportion. Built by running each
 *     allocation through the same `buildLedger` and reading the same line key, so
 *     the contributors sum to the network line exactly rather than approximately.
 *
 *  2. **Honest classification of inputs.** Every carbon figure in this product is
 *     a model output — there is no measured MRV data in the dataset and pretending
 *     otherwise would be the one unforgivable failure for a page about evidence.
 *     What can be classified honestly is each *input*: whether it carries a
 *     published citation, is a modelling assumption stated at the point of use, or
 *     is a quantity the network itself produced. That distinction is real, it is
 *     readable off the data, and it is what a sceptic actually wants.
 */

import {
  aggregateAllocations,
  buildLedger,
  dominantBiocharStream,
  permanenceFor,
} from './carbon.ts';
import { provenanceFor, type ProvenanceRow } from './trace.ts';
import { PATHWAYS } from './pathways.ts';
import { STREAMS } from './streams.ts';
import type {
  Assumptions,
  CarbonLedger,
  LedgerLine,
  NetworkState,
  ObjectiveMode,
  OptimizationResult,
  PathwayId,
  StreamId,
} from './types.ts';

/**
 * Status of a carbon figure.
 *
 * Kept to the four words the product uses everywhere, and applied strictly:
 * nothing in this dataset is measured, and saying "modelled" when a reader might
 * hear "measured" is the failure mode this whole module exists to prevent.
 */
export type EvidenceStatus = 'measured' | 'estimated' | 'modelled' | 'missing';

/** How an individual input is underwritten. */
export type InputBasis = 'referenced' | 'assumption' | 'derived';

export interface EvidenceInput extends ProvenanceRow {
  basis: InputBasis;
}

export interface EvidenceRecord {
  /** the ledger line key — the join between every Carbon screen */
  key: string;
  label: string;
  valueT: number;
  unit: string;
  kind: LedgerLine['kind'];
  status: EvidenceStatus;
  /** the calculation, as the engine itself states it */
  calculation: string;
  source: string;
  uncertaintyPct: number;
  inputs: EvidenceInput[];
  inputsByBasis: Record<InputBasis, number>;
  hasProvenance: boolean;
  /** how many allocations in the current plan feed this line */
  contributorCount: number;
}

export interface EvidenceHealth {
  totalRecords: number;
  byStatus: Record<EvidenceStatus, number>;
  inputsTotal: number;
  inputsByBasis: Record<InputBasis, number>;
  /** ledger lines the plan produced but for which no inputs are recorded */
  linesWithoutProvenance: string[];
  /** plain statement of what this dataset can and cannot support */
  statement: string;
  gapStatement: string;
}

export interface LineContributor {
  sourceId: string;
  sourceName: string;
  facilityId: string;
  facilityName: string;
  stream: StreamId;
  streamLabel: string;
  pathway: PathwayId;
  pathwayShort: string;
  tonnes: number;
  distanceKm: number;
  /** this allocation's contribution to the line, tCO2e */
  valueT: number;
  sharePct: number;
}

export interface ModelBasis {
  windowDays: number;
  asOf: string;
  version: number;
  objective: ObjectiveMode;
  suppliedT: number;
  divertedT: number;
  strandedT: number;
  facilitiesOnline: number;
  facilitiesTotal: number;
  sourceCount: number;
  assumptions: Assumptions;
  supplyBasis: string;
  estateBasis: string;
  resultBasis: string;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classifies one input row.
 *
 * A factor with a citation is referenced; a factor whose stated source calls
 * itself an assumption is an assumption; a bare quantity with no factor came out
 * of the model. Read off the data rather than hand-tagged, so it cannot drift
 * away from what the engine actually did.
 */
function classify(row: ProvenanceRow): InputBasis {
  if (!row.factor) return 'derived';
  const src = row.factorSource ?? '';
  if (!src) return 'derived';
  if (/assumption|configuration|stated at point of use/i.test(src)) return 'assumption';
  return 'referenced';
}

function emptyBasisCount(): Record<InputBasis, number> {
  return { referenced: 0, assumption: 0, derived: 0 };
}

/**
 * The evidence register: every line of the current network ledger, with the
 * inputs, factor and citation behind it.
 */
export function evidenceRegister(
  state: NetworkState,
  result: OptimizationResult,
  ledger: CarbonLedger,
): EvidenceRecord[] {
  const dominant = dominantBiocharStream(result.allocations);
  const agg = aggregateAllocations(
    result.allocations,
    state.facilities,
    state.vehicles,
    state.assumptions,
  );
  const provenance = provenanceFor(
    agg,
    state.assumptions.soilTempC,
    state.assumptions.gridEfTPerMwh,
    dominant,
  );

  // One pass over the allocations tells us how many feed each line, without
  // building the full contributor list for every line up front.
  const counts = new Map<string, number>();
  const permanence = dominant ? permanenceFor(dominant, state.assumptions.soilTempC) : null;
  for (const a of result.allocations) {
    const one = buildLedger(
      aggregateAllocations([a], state.facilities, state.vehicles, state.assumptions),
      state.assumptions,
      permanence,
      false,
    );
    for (const l of one.lines) {
      if (l.kind === 'total' || Math.abs(l.valueT) < 1e-9) continue;
      counts.set(l.key, (counts.get(l.key) ?? 0) + 1);
    }
  }

  return ledger.lines
    .filter((l) => l.kind !== 'total')
    .map((l) => {
      const rows = provenance[l.key] ?? [];
      const inputs: EvidenceInput[] = rows.map((r) => ({ ...r, basis: classify(r) }));
      const inputsByBasis = emptyBasisCount();
      for (const i of inputs) inputsByBasis[i.basis]++;

      return {
        key: l.key,
        label: l.label,
        valueT: l.valueT,
        unit: 'tCO₂e',
        kind: l.kind,
        // Every figure this engine produces is a model output. There is no
        // measured observation anywhere in the dataset, and this is the one
        // place that must never round that statement off.
        status: 'modelled' as EvidenceStatus,
        calculation: l.basis,
        source: l.source,
        uncertaintyPct: l.uncertaintyPct,
        inputs,
        inputsByBasis,
        hasProvenance: inputs.length > 0,
        contributorCount: counts.get(l.key) ?? 0,
      };
    });
}

/**
 * What the register adds up to, stated without a score.
 *
 * There is no defensible way to compress "how trustworthy is this" into a
 * percentage, and inventing one would be exactly the greenwashing this product
 * refuses. So the health view counts what is actually countable and says the rest
 * in words.
 */
export function evidenceHealth(records: EvidenceRecord[]): EvidenceHealth {
  const byStatus: Record<EvidenceStatus, number> = {
    measured: 0,
    estimated: 0,
    modelled: 0,
    missing: 0,
  };
  const inputsByBasis = emptyBasisCount();
  let inputsTotal = 0;

  for (const r of records) {
    byStatus[r.status]++;
    for (const i of r.inputs) {
      inputsByBasis[i.basis]++;
      inputsTotal++;
    }
  }

  const withoutProvenance = records.filter((r) => !r.hasProvenance).map((r) => r.key);
  byStatus.missing = withoutProvenance.length;

  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const statement =
    `All ${records.length} carbon figures in the current plan are model outputs. None is a ` +
    `measurement: this network's supply, routing and conversion are generated, so there is no ` +
    `observed emission anywhere in the dataset to report. Of the ${inputsTotal} inputs behind ` +
    `them, ${inputsByBasis.referenced} ${plural(inputsByBasis.referenced, 'applies', 'apply')} ` +
    `a factor with a published citation, ${inputsByBasis.assumption} ` +
    `${plural(inputsByBasis.assumption, 'is a modelling assumption', 'are modelling assumptions')} ` +
    `stated at the point of use, and ${inputsByBasis.derived} ` +
    `${plural(inputsByBasis.derived, 'is a quantity', 'are quantities')} the network model itself produced.`;

  const gapStatement =
    withoutProvenance.length === 0
      ? `Every ledger line the plan produced has its inputs recorded. Note that this checks ` +
        `provenance coverage, not data quality — the network has no missing-input model, because ` +
        `every quantity in it is generated rather than collected. A real deployment would need ` +
        `one, and its absence is a property of this dataset rather than a clean bill of health.`
      : `${withoutProvenance.length} ledger line${withoutProvenance.length > 1 ? 's' : ''} ` +
        `(${withoutProvenance.join(', ')}) produced a value with no recorded inputs. The ` +
        `calculation basis is still shown, but the itemised breakdown is absent.`;

  return {
    totalRecords: records.length,
    byStatus,
    inputsTotal,
    inputsByBasis,
    linesWithoutProvenance: withoutProvenance,
    statement,
    gapStatement,
  };
}

/**
 * Backward trace: which allocations produced this ledger line.
 *
 * Each allocation is run through the same `buildLedger` the network uses and the
 * same line key is read off it, so the contributors sum to the network line
 * exactly. This is the mirror of the Ledger's forward trace and shares its
 * machinery rather than reimplementing it.
 */
export function lineContributors(
  state: NetworkState,
  result: OptimizationResult,
  lineKey: string,
): LineContributor[] {
  const dominant = dominantBiocharStream(result.allocations);
  const permanence = dominant ? permanenceFor(dominant, state.assumptions.soilTempC) : null;
  const srcById = new Map(state.sources.map((s) => [s.id, s]));
  const facById = new Map(state.facilities.map((f) => [f.id, f]));

  const rows: LineContributor[] = [];
  for (const a of result.allocations) {
    const one = buildLedger(
      aggregateAllocations([a], state.facilities, state.vehicles, state.assumptions),
      state.assumptions,
      permanence,
      false,
    );
    const line = one.lines.find((l) => l.key === lineKey);
    if (!line || Math.abs(line.valueT) < 1e-9) continue;
    rows.push({
      sourceId: a.sourceId,
      sourceName: srcById.get(a.sourceId)?.name ?? a.sourceId,
      facilityId: a.facilityId,
      facilityName: facById.get(a.facilityId)?.name ?? a.facilityId,
      stream: a.stream,
      streamLabel: STREAMS[a.stream].label,
      pathway: a.pathway,
      pathwayShort: PATHWAYS[a.pathway].short,
      tonnes: a.tonnes,
      distanceKm: a.distanceKm,
      valueT: line.valueT,
      sharePct: 0,
    });
  }

  const total = rows.reduce((x, r) => x + r.valueT, 0);
  for (const r of rows) r.sharePct = total !== 0 ? (r.valueT / total) * 100 : 0;
  rows.sort((x, y) => Math.abs(y.valueT) - Math.abs(x.valueT));
  return rows;
}

/** The conditions the current numbers were produced under. */
export function modelBasis(
  state: NetworkState,
  result: OptimizationResult,
  version: number,
): ModelBasis {
  return {
    windowDays: state.assumptions.windowDays,
    asOf: state.asOf,
    version,
    objective: result.objective,
    suppliedT: result.totals.suppliedT,
    divertedT: result.totals.divertedT,
    strandedT: result.totals.strandedT,
    facilitiesOnline: state.facilities.filter((f) => f.status === 'online').length,
    facilitiesTotal: state.facilities.length,
    sourceCount: state.sources.length,
    assumptions: state.assumptions,
    supplyBasis:
      `Planning-window availability per source, generated from the crop calendar with a ` +
      `seeded weather shock. Not collected from the field.`,
    estateBasis:
      `The facility estate as currently configured, including any scenario mutations applied ` +
      `to this twin.`,
    resultBasis:
      `A forward-looking modelled estimate for one ${state.assumptions.windowDays}-day planning ` +
      `window. Not measured historical emissions, not verified, and not a carbon credit.`,
  };
}
