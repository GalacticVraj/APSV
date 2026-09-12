/**
 * Traceability: where a carbon number came from.
 *
 * The Carbon Ledger has to answer "where exactly did this number come from" all
 * the way down to one truckload. The temptation is to write a second, simpler
 * carbon calculation for the trace view. That would be the worst thing this
 * module could do — two calculations drift, and the moment they disagree the
 * product's central claim is gone.
 *
 * So the trace is built from the same three functions the network ledger uses:
 *
 *     physicalPerTonne()  →  addToAggregate()  →  buildLedger()
 *
 * The only difference is that the aggregate contains one allocation instead of
 * several hundred. A single-allocation ledger therefore has the same line keys,
 * the same bases and the same citations as the network ledger, and the traced
 * lines sum into the network lines by construction rather than by agreement.
 *
 * Provenance works the same way. Rather than restating factors in prose, each row
 * names the physical input actually consumed by the line, the factor actually
 * applied, and that factor's published source — read from the same constants the
 * solver used. Nothing here is a second opinion about the carbon.
 */

import {
  addToAggregate,
  aggregateAllocations,
  baseFactors,
  buildLedger,
  dominantBiocharStream,
  emptyAggregate,
  networkLedger,
  permanenceFor,
  physicalPerTonne,
  CO2_PER_C,
  EMPTY_RETURN_FUEL_RATIO,
  type PhysicalPerTonne,
} from './carbon.ts';
import { COUNTERFACTUALS, STREAMS } from './streams.ts';
import { PATHWAYS } from './pathways.ts';
import { DIESEL_WTW_KG_PER_L, EF, VEHICLE_BY_ID } from './constants.ts';
import { haversineKm } from './geo.ts';
import type {
  Allocation,
  CarbonLedger,
  Counterfactual,
  NetworkState,
  OptimizationResult,
  PathwayId,
  StreamId,
} from './types.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Provenance
// ─────────────────────────────────────────────────────────────────────────────

export interface ProvenanceRow {
  /** the physical quantity the line consumed */
  input: string;
  value: number;
  unit: string;
  /** the factor applied to it, as value and unit */
  factor: string | null;
  factorSource: string | null;
  uncertaintyPct: number | null;
  /** 'modelled' everywhere today; the field exists so a measured input can say so */
  status: 'modelled';
}

/** Aggregate shape, restated locally so this module does not re-export carbon.ts. */
type Agg = ReturnType<typeof emptyAggregate>;

function f(
  input: string,
  value: number,
  unit: string,
  factor: string | null = null,
  factorSource: string | null = null,
  uncertaintyPct: number | null = null,
): ProvenanceRow {
  return { input, value, unit, factor, factorSource, uncertaintyPct, status: 'modelled' };
}

/**
 * Inputs behind each ledger line, keyed by that line's key.
 *
 * Only lines the aggregate actually produced get an entry, so a caller can tell
 * the difference between "this line has no provenance recorded" and "this line
 * did not occur in this plan" — they are different problems and the UI says so.
 */
export function provenanceFor(
  agg: Agg,
  soilTempC: number,
  gridEfTPerMwh: number,
  biocharStream: StreamId | null,
): Record<string, ProvenanceRow[]> {
  const out: Record<string, ProvenanceRow[]> = {};

  if (agg.biocharCarbonT > 0) {
    out.char_gross = [
      f('Biochar produced', agg.biocharT, 't'),
      f('Carbon locked in char', agg.biocharCarbonT, 't C'),
      f(
        'Molar mass ratio CO₂:C',
        CO2_PER_C,
        'ratio',
        '44.009 / 12.011',
        'Stoichiometric constant',
        0,
      ),
    ];
    if (biocharStream) {
      const perm = permanenceFor(biocharStream, soilTempC);
      out.char_permanence = [
        f('H/C(org) molar ratio of char', perm.hcOrgRatio, 'ratio'),
        f('Mean annual soil temperature', perm.soilTempC, '°C'),
        f(
          'Q10 temperature correction',
          perm.fT,
          'rate multiplier',
          `Q10 = ${perm.q10}, referenced to ${perm.referenceTempC} °C`,
          'Woolf et al. 2021 ES&T 55:14795',
          15,
        ),
        f(
          'Fraction remaining at 100 years (BC₁₀₀)',
          perm.bc100,
          'fraction',
          perm.method,
          'Azzi et al. 2024 Geoderma 441:116761',
          15,
        ),
      ];
    }
  }

  for (const key of Object.keys(agg.dryTByCounterfactual) as Counterfactual[]) {
    const dryT = agg.dryTByCounterfactual[key];
    if (dryT <= 0.01) continue;
    const cf = COUNTERFACTUALS[key];
    out[`avoided_${key}`] = [
      f('Dry matter diverted from this fate', dryT, 't DM'),
      f(
        'Counterfactual emission factor',
        cf.tco2ePerTDry,
        'tCO₂e/t DM',
        cf.basis,
        cf.source,
        cf.uncertaintyPct,
      ),
    ];
  }

  if (agg.cbgKg > 0) {
    out.sub_cng = [
      f('Bio-CNG delivered', agg.cbgKg, 'kg'),
      f(
        'Fossil CNG displaced',
        EF.cngDisplaced.value,
        EF.cngDisplaced.unit,
        EF.cngDisplaced.label,
        EF.cngDisplaced.source,
        EF.cngDisplaced.uncertaintyPct,
      ),
    ];
  }
  if (agg.coalDisplacedMj > 0) {
    out.sub_coal = [
      // GJ and MWh rather than MJ and kWh: the ledger's own basis string quotes
      // these scales, and a provenance row that contradicts the line above it is
      // worse than no provenance row.
      f('Thermal energy delivered to the boiler', agg.coalDisplacedMj / 1000, 'GJ'),
      f(
        'Coal emission factor',
        EF.coal.value,
        EF.coal.unit,
        EF.coal.label,
        EF.coal.source,
        EF.coal.uncertaintyPct,
      ),
    ];
  }
  if (agg.kwhExported > 0) {
    out.sub_power = [
      f('Electricity exported to grid', agg.kwhExported / 1000, 'MWh'),
      f(
        'Indian grid emission factor',
        gridEfTPerMwh,
        'tCO₂e/MWh',
        EF.gridElectricity.label,
        EF.gridElectricity.source,
        EF.gridElectricity.uncertaintyPct,
      ),
    ];
  }
  if (agg.fertiliserNKg > 0) {
    out.sub_fert = [
      f('Plant-available nitrogen in product', agg.fertiliserNKg, 'kg N'),
      f(
        'Synthetic nitrogen displaced',
        EF.syntheticFertiliserN.value,
        EF.syntheticFertiliserN.unit,
        EF.syntheticFertiliserN.label,
        EF.syntheticFertiliserN.source,
        EF.syntheticFertiliserN.uncertaintyPct,
      ),
    ];
  }

  if (agg.transportDieselL > 0) {
    out.em_transport = [
      f('Diesel burned, laden and empty return', agg.transportDieselL, 'litres'),
      f('Tonne-kilometres hauled', agg.tkm, 't·km'),
      f(
        'Diesel well-to-wheel',
        DIESEL_WTW_KG_PER_L,
        'kgCO₂e/litre',
        `${EF.dieselCombustion.value} combustion + ${EF.dieselUpstream.value} upstream`,
        EF.dieselCombustion.source,
        EF.dieselCombustion.uncertaintyPct,
      ),
      f(
        'Empty-return fuel ratio',
        EMPTY_RETURN_FUEL_RATIO,
        'of laden burn',
        'Return legs run empty; fuel burn does not fall to zero',
        'Modelling assumption, stated at point of use',
        null,
      ),
    ];
  }
  if (agg.aggregationT > 0) {
    out.em_aggregation = [
      f('Feedstock requiring field aggregation', agg.aggregationT, 't'),
      f(
        'Raking, baling and loading',
        EF.baling.value,
        EF.baling.unit,
        EF.baling.label,
        EF.baling.source,
        EF.baling.uncertaintyPct,
      ),
    ];
  }
  if (agg.kwhImported > 0) {
    out.em_parasitic = [
      f('Process electricity drawn from grid', agg.kwhImported / 1000, 'MWh'),
      f(
        'Indian grid emission factor',
        gridEfTPerMwh,
        'tCO₂e/MWh',
        EF.gridElectricity.label,
        EF.gridElectricity.source,
        EF.gridElectricity.uncertaintyPct,
      ),
    ];
  }
  if (agg.ch4SlipM3 > 0) {
    out.em_ch4_slip = [
      f('Fugitive methane from digester', agg.ch4SlipM3, 'm³ CH₄'),
      f(
        'CH₄ global warming potential',
        EF.ch4Gwp.value,
        EF.ch4Gwp.unit,
        EF.ch4Gwp.label,
        EF.ch4Gwp.source,
        EF.ch4Gwp.uncertaintyPct,
      ),
    ];
  }
  if (agg.compostCh4T > 0 || agg.compostN2oT > 0) {
    out.em_compost = [
      f('Direct CH₄ from windrow', agg.compostCh4T, 't CH₄'),
      f('Direct N₂O from windrow', agg.compostN2oT, 't N₂O'),
      f(
        'CH₄ / N₂O global warming potential',
        EF.ch4Gwp.value,
        `${EF.ch4Gwp.unit} / ${EF.n2oGwp.value}`,
        'AR6 GWP₁₀₀, turned-windrow rates rather than the static-pile default',
        EF.ch4Gwp.source,
        EF.ch4Gwp.uncertaintyPct,
      ),
    ];
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Following one contribution
// ─────────────────────────────────────────────────────────────────────────────

export interface TraceStage {
  key: 'waste' | 'source' | 'route' | 'facility' | 'pathway' | 'processing' | 'outcome';
  label: string;
  /** the quantity that moves at this stage */
  headline: string;
  detail: string;
  /** carbon booked at this stage, tCO2e; null where no carbon event occurs */
  carbonT: number | null;
  carbonLabel: string | null;
  kind: 'removal' | 'avoided' | 'substitution' | 'emission' | 'adjustment' | null;
}

export interface TraceCandidate {
  key: string;
  sourceId: string;
  sourceName: string;
  facilityId: string;
  facilityName: string;
  stream: StreamId;
  streamLabel: string;
  pathway: PathwayId;
  pathwayLabel: string;
  tonnes: number;
  distanceKm: number;
  netCarbonT: number;
  /** share of the network's net carbon, % */
  sharePct: number;
}

export interface AllocationTrace extends TraceCandidate {
  allocation: Allocation;
  source: {
    id: string;
    name: string;
    district: string;
    state: string;
    lat: number;
    lon: number;
    availableT: number;
    /** hours since the last supply telemetry update — the only freshness signal we hold */
    telemetryAgeH: number;
    access: string;
  };
  facility: {
    id: string;
    name: string;
    operator: string;
    district: string;
    lat: number;
    lon: number;
    capacityTpd: number;
    efficiency: number;
    powerSource: string;
    commissioned: number;
  };
  vehicle: { id: string; label: string; payloadT: number; trips: number };
  route: {
    roadKm: number;
    straightKm: number;
    circuity: number;
    tkm: number;
    dieselL: number;
  };
  pathwayDef: {
    id: PathwayId;
    label: string;
    short: string;
    maturity: string;
    producesDurableRemoval: boolean;
  };
  counterfactual: { id: Counterfactual; label: string; basis: string; source: string };
  /** physical inventory for one tonne, and the same scaled to the allocation */
  perTonne: PhysicalPerTonne;
  /** the ledger for this allocation alone, built by the network's own builder */
  ledger: CarbonLedger;
  provenance: Record<string, ProvenanceRow[]>;
  stages: TraceStage[];
  /** plain explanation, composed from the numbers above */
  why: string;
}

/** Allocations worth offering as a trace, largest carbon contribution first. */
export function traceCandidates(
  state: NetworkState,
  result: OptimizationResult,
  limit = 40,
): TraceCandidate[] {
  const srcName = new Map(state.sources.map((s) => [s.id, s.name]));
  const facName = new Map(state.facilities.map((x) => [x.id, x.name]));
  // Divided by the ledger's net, not `totals.netCarbonT`: the optimiser's
  // aggregate uses per-arc permanence and is a different figure from the one the
  // product displays, so shares against it would not total 100%.
  const netTotal =
    Math.abs(
      networkLedger(result.allocations, state.facilities, state.vehicles, state.assumptions)
        .netT,
    ) || 1;

  // Each candidate's figure is that allocation's own ledger, not
  // `Allocation.netCarbonT`. The optimiser's field uses per-arc permanence, so a
  // row in this list would read 2,290 while the trace it opens reads 2,771 — the
  // list and the detail disagreeing about the same haul.
  const dominant = dominantBiocharStream(result.allocations);
  const permanence = dominant
    ? permanenceFor(dominant, state.assumptions.soilTempC)
    : null;
  const ledgerNetFor = (a: Allocation) =>
    buildLedger(
      aggregateAllocations([a], state.facilities, state.vehicles, state.assumptions),
      state.assumptions,
      permanence,
      false,
    ).netT;

  return result.allocations
    .map((a) => ({
      key: `${a.sourceId}::${a.facilityId}`,
      sourceId: a.sourceId,
      sourceName: srcName.get(a.sourceId) ?? a.sourceId,
      facilityId: a.facilityId,
      facilityName: facName.get(a.facilityId) ?? a.facilityId,
      stream: a.stream,
      streamLabel: STREAMS[a.stream].label,
      pathway: a.pathway,
      pathwayLabel: PATHWAYS[a.pathway].short,
      tonnes: a.tonnes,
      distanceKm: a.distanceKm,
      netCarbonT: ledgerNetFor(a),
      sharePct: (ledgerNetFor(a) / netTotal) * 100,
    }))
    .sort((x, y) => Math.abs(y.netCarbonT) - Math.abs(x.netCarbonT))
    .slice(0, limit);
}

/**
 * The full trace for one allocation.
 *
 * Returns null when the pair does not appear in the current plan, which is a real
 * answer rather than an error: the material may have been stranded, or the plan
 * may have moved since the caller last looked.
 */
export function traceAllocation(
  state: NetworkState,
  result: OptimizationResult,
  sourceId: string,
  facilityId: string,
): AllocationTrace | null {
  const a = result.allocations.find(
    (x) => x.sourceId === sourceId && x.facilityId === facilityId,
  );
  if (!a) return null;

  const source = state.sources.find((s) => s.id === sourceId);
  const facility = state.facilities.find((x) => x.id === facilityId);
  const vehicle = VEHICLE_BY_ID[a.vehicleId];
  if (!source || !facility || !vehicle) return null;

  const stream = STREAMS[a.stream];
  const pathway = PATHWAYS[a.pathway];

  // Exactly the call the optimiser and the network ledger make.
  const perTonne = physicalPerTonne(
    a.stream,
    a.pathway,
    facility.efficiency,
    a.distanceKm,
    a.payloadT,
    vehicle,
  );

  const agg = emptyAggregate();
  addToAggregate(agg, perTonne, a.tonnes);

  // Permanence comes from the NETWORK's dominant biochar feedstock, not this
  // allocation's own. Using the allocation's own stream would give a marginally
  // better estimate for this load — and would make the traced lines stop summing
  // to the network ledger, which is the whole point of the trace. A trace has to
  // explain the number the network actually computed, not a better one.
  const biocharStream = dominantBiocharStream(result.allocations);
  const permanence = biocharStream
    ? permanenceFor(biocharStream, state.assumptions.soilTempC)
    : null;
  const ledger = buildLedger(agg, state.assumptions, permanence, false);

  const provenance = provenanceFor(
    agg,
    state.assumptions.soilTempC,
    state.assumptions.gridEfTPerMwh,
    biocharStream,
  );

  const straightKm = haversineKm(source, facility);
  const cf = COUNTERFACTUALS[perTonne.counterfactual];
  // Divided by the ledger's net, not `totals.netCarbonT`: the optimiser's
  // aggregate uses per-arc permanence and is a different figure from the one the
  // product displays, so shares against it would not total 100%.
  const netTotal =
    Math.abs(
      networkLedger(result.allocations, state.facilities, state.vehicles, state.assumptions)
        .netT,
    ) || 1;

  const stages = buildStages(a, stream.label, facility.name, pathway.short, perTonne, ledger, cf.label);

  return {
    key: `${a.sourceId}::${a.facilityId}`,
    sourceId,
    sourceName: source.name,
    facilityId,
    facilityName: facility.name,
    stream: a.stream,
    streamLabel: stream.label,
    pathway: a.pathway,
    pathwayLabel: pathway.short,
    tonnes: a.tonnes,
    distanceKm: a.distanceKm,
    netCarbonT: a.netCarbonT,
    sharePct: (a.netCarbonT / netTotal) * 100,
    allocation: a,
    source: {
      id: source.id,
      name: source.name,
      district: source.district,
      state: source.state,
      lat: source.lat,
      lon: source.lon,
      availableT: source.availableT,
      telemetryAgeH: source.telemetryAgeH,
      access: source.access,
    },
    facility: {
      id: facility.id,
      name: facility.name,
      operator: facility.operator,
      district: facility.district,
      lat: facility.lat,
      lon: facility.lon,
      capacityTpd: facility.capacityTpd,
      efficiency: facility.efficiency,
      powerSource: facility.powerSource,
      commissioned: facility.commissioned,
    },
    vehicle: { id: vehicle.id, label: vehicle.label, payloadT: a.payloadT, trips: a.trips },
    route: {
      roadKm: a.distanceKm,
      straightKm,
      circuity: straightKm > 0 ? a.distanceKm / straightKm : 1,
      tkm: a.tkm,
      dieselL: perTonne.transportDieselL * a.tonnes,
    },
    pathwayDef: {
      id: pathway.id,
      label: pathway.label,
      short: pathway.short,
      maturity: pathway.maturity,
      producesDurableRemoval: pathway.producesDurableRemoval,
    },
    counterfactual: {
      id: cf.id,
      label: cf.label,
      basis: cf.basis,
      source: cf.source,
    },
    perTonne,
    ledger,
    provenance,
    stages,
    why: composeWhy(a, stream.label, facility.name, pathway.short, ledger, cf.label),
  };
}

/**
 * The chain, stage by stage.
 *
 * Carbon is booked at the stage that physically causes it, and the stages that
 * move material without a carbon event say so rather than carrying a zero.
 */
function buildStages(
  a: Allocation,
  streamLabel: string,
  facilityName: string,
  pathwayShort: string,
  phys: PhysicalPerTonne,
  ledger: CarbonLedger,
  counterfactualLabel: string,
): TraceStage[] {
  const line = (key: string) => ledger.lines.find((l) => l.key === key)?.valueT ?? 0;
  const sum = (pred: (k: string) => boolean) =>
    ledger.lines.filter((l) => pred(l.key)).reduce((x, l) => x + l.valueT, 0);

  const avoided = sum((k) => k.startsWith('avoided_'));
  const substitution = sum((k) => k.startsWith('sub_'));
  const removal = line('char_gross');
  const permanence = line('char_permanence');
  const transport = line('em_transport') + line('em_aggregation');
  const processing = sum(
    (k) => k.startsWith('em_') && k !== 'em_transport' && k !== 'em_aggregation',
  );

  const t1 = (v: number) => `${v.toLocaleString('en-IN', { maximumFractionDigits: 1 })}`;

  const stages: TraceStage[] = [
    {
      key: 'waste',
      label: 'Waste',
      headline: `${t1(a.tonnes)} t ${streamLabel.toLowerCase()}`,
      detail: `${t1(phys.dryT * a.tonnes)} t dry matter after moisture`,
      carbonT: null,
      carbonLabel: null,
      kind: null,
    },
    {
      key: 'source',
      // The avoided credit is booked here because collection is the act that
      // causes it: the material stops being burned the moment it is taken. The
      // raking and baling emission is NOT described here — it is charged under
      // transport, and a stage must not narrate a cost it does not carry.
      label: 'Collection',
      headline: `Diverted from ${counterfactualLabel.toLowerCase()}`,
      detail: `${t1(phys.dryT * a.tonnes)} t dry matter that would otherwise have met that fate`,
      carbonT: avoided !== 0 ? avoided : null,
      carbonLabel: avoided !== 0 ? `Avoided: ${counterfactualLabel.toLowerCase()}` : null,
      kind: avoided !== 0 ? 'avoided' : null,
    },
    {
      key: 'route',
      label: 'Transport',
      headline: `${t1(a.distanceKm)} km · ${a.trips} trips`,
      detail: `${t1(a.payloadT)} t per load, ${t1(phys.transportDieselL * a.tonnes)} L diesel including empty returns`,
      carbonT: transport !== 0 ? transport : null,
      carbonLabel: transport !== 0 ? 'Transport and aggregation emissions' : null,
      kind: transport !== 0 ? 'emission' : null,
    },
    {
      key: 'facility',
      label: 'Facility',
      headline: facilityName,
      detail: `Receives the load and runs it through the ${pathwayShort.toLowerCase()} line`,
      carbonT: null,
      carbonLabel: null,
      kind: null,
    },
    {
      key: 'pathway',
      label: 'Pathway',
      headline: pathwayShort,
      detail: productDetail(phys),
      carbonT: substitution !== 0 ? substitution : null,
      carbonLabel: substitution !== 0 ? 'Fossil energy and fertiliser displaced' : null,
      kind: substitution !== 0 ? 'substitution' : null,
    },
    {
      key: 'processing',
      label: 'Processing',
      headline: processing !== 0 ? 'Plant emissions booked' : 'No plant emissions',
      detail:
        processing !== 0
          ? 'Parasitic grid draw, digester slip and windrow losses'
          : 'This pathway draws no grid power and vents no process gas',
      carbonT: processing !== 0 ? processing : null,
      carbonLabel: processing !== 0 ? 'Processing emissions' : null,
      kind: processing !== 0 ? 'emission' : null,
    },
    {
      key: 'outcome',
      label: 'Carbon outcome',
      headline: `${t1(ledger.netT)} tCO₂e net`,
      detail:
        removal > 0
          ? `${t1(removal)} tCO₂e fixed in char, ${t1(Math.abs(permanence))} written back for 100-year permanence`
          : 'No durable removal on this pathway; the benefit is avoidance and displacement',
      carbonT: removal > 0 ? removal + permanence : null,
      carbonLabel: removal > 0 ? 'Durable removal after permanence' : null,
      kind: removal > 0 ? 'removal' : null,
    },
  ];

  return stages;
}

function productDetail(phys: PhysicalPerTonne): string {
  const bits: string[] = [];
  const n = (v: number, dp = 1) => v.toLocaleString('en-IN', { maximumFractionDigits: dp });
  if (phys.biocharT > 0) bits.push(`${n(phys.biocharT * 1000, 0)} kg biochar per tonne`);
  if (phys.cbgKg > 0) bits.push(`${n(phys.cbgKg)} kg bio-CNG per tonne`);
  if (phys.coalDisplacedMj > 0) bits.push(`${n(phys.coalDisplacedMj, 0)} MJ to the boiler per tonne`);
  if (phys.netKwh > 0) bits.push(`${n(phys.netKwh)} kWh exported per tonne`);
  if (phys.compostT > 0) bits.push(`${n(phys.compostT * 1000, 0)} kg compost per tonne`);
  if (phys.digestateT > 0) bits.push(`${n(phys.digestateT * 1000, 0)} kg digestate per tonne`);
  return bits.length ? bits.join(' · ') : 'No saleable product recorded for this pathway';
}

/**
 * The plain answer to "why is this number what it is".
 *
 * Built from the trace's own figures: the dominant benefit, the largest charge
 * against it, and the physical reason that charge exists.
 */
function composeWhy(
  a: Allocation,
  streamLabel: string,
  facilityName: string,
  pathwayShort: string,
  ledger: CarbonLedger,
  counterfactualLabel: string,
): string {
  const n = (v: number) =>
    Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: Math.abs(v) < 10 ? 1 : 0 });

  const benefits = ledger.lines.filter((l) => l.valueT > 0 && l.kind !== 'total');
  const charges = ledger.lines.filter((l) => l.valueT < 0 && l.kind !== 'total');
  benefits.sort((x, y) => y.valueT - x.valueT);
  charges.sort((x, y) => x.valueT - y.valueT);

  const lead = benefits[0];
  const charge = charges[0];

  let s = `${n(a.tonnes)} t of ${streamLabel.toLowerCase()} travelled ${n(a.distanceKm)} km to ${facilityName} and was processed via ${pathwayShort.toLowerCase()}, giving ${n(ledger.netT)} tCO₂e net.`;

  if (lead) {
    s += ` Most of the benefit — ${n(lead.valueT)} tCO₂e — comes from ${lead.label.toLowerCase()}`;
    if (lead.key.startsWith('avoided_')) {
      s += `, because the material would otherwise have gone to ${counterfactualLabel.toLowerCase()}`;
    }
    s += '.';
  }
  if (charge) {
    s += ` Against that, ${n(charge.valueT)} tCO₂e is charged for ${charge.label.toLowerCase()}`;
    if (charge.key === 'em_transport') s += `, which is what the ${n(a.distanceKm)} km haul costs`;
    s += '.';
  }
  return s;
}
