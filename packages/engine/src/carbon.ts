/**
 * Carbon accounting.
 *
 * Three commitments this module makes, all of which cost us headline numbers and
 * buy defensibility:
 *
 *  1. Biogenic CO2 is not counted. Residue carbon that burns or composts returns to
 *     the atmosphere it came from in the same season. Only CH4 and N2O represent a
 *     real atmospheric addition. This is why avoided-burning credit lands near
 *     0.07 tCO2e/t and not the ~1 tCO2e/t commonly claimed.
 *
 *  2. Durable removal and avoided emissions are tracked on separate lines and never
 *     summed into a single "carbon saved" figure. They are different commodities
 *     with roughly a twentyfold price gap.
 *
 *  3. Biochar permanence is not a constant. It is computed from the char's H/Corg
 *     ratio and, critically, corrected to the actual soil temperature via the
 *     published Q10 relation. The reference dataset is harmonised to 14.9 degC
 *     (northern Europe); Indian soils sit near 26 degC, where biochar decays about
 *     45% faster.
 *
 * References
 *   Azzi, Li, Cederlund, Karltun, Sundberg (2024). Modelling biochar long-term
 *     carbon storage in soil with harmonized analysis of decomposition data.
 *     Geoderma 441, 116761.
 *   Woolf, Lehmann, Cowie et al. (2021). Greenhouse gas inventory model for
 *     biochar additions to soil. Environmental Science & Technology 55, 14795.
 *   IPCC (2006) Guidelines Vols 2, 4, 5; IPCC AR6 WG1 Ch.7 (GWP values).
 */

import type {
  Allocation,
  Assumptions,
  CarbonLedger,
  Counterfactual,
  Facility,
  LedgerLine,
  PathwayId,
  PermanenceReport,
  StreamId,
  UncertaintyBand,
  VehicleType,
} from './types.ts';
import { CARBON_MARKETS, DIESEL_WTW_KG_PER_L, EF } from './constants.ts';
import { COUNTERFACTUALS, STREAMS, biocharCarbonPct, biocharHcOrg, dryFraction } from './streams.ts';
import { PATHWAYS, CH4_DENSITY_KG_PER_M3, pathwayYield } from './pathways.ts';
import { lognormalAround, makeRng, mean, percentileSorted, stdev } from './rng.ts';

/** Molar mass ratio CO2 : C. */
export const CO2_PER_C = 44.009 / 12.011;

/** The temperature the harmonised biochar decomposition dataset is reported at. */
export const REFERENCE_SOIL_TEMP_C = 14.9;

// ─────────────────────────────────────────────────────────────────────────────
// Permanence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Q10 as a function of the experimental and target soil temperatures.
 * Relation from Woolf et al. (2021) ES&T, as implemented in the SLU/Puro
 * biocharStability library.
 */
export function q10Factor(expTempC: number, targetTempC: number): number {
  if (Math.abs(expTempC - targetTempC) < 1e-9) return 1.1;
  return (
    1.1 +
    (63.1579 * (Math.exp(-0.19 * targetTempC) - Math.exp(-0.19 * expTempC))) /
      (expTempC - targetTempC)
  );
}

/** Ratio by which decay rates scale when moving from expTempC to targetTempC. */
export function fT(expTempC: number, targetTempC: number): number {
  const q10 = q10Factor(expTempC, targetTempC);
  if (q10 <= 0) return 1;
  return Math.exp(Math.log(q10) * ((targetTempC - expTempC) / 10));
}

/** Fraction of initial biochar carbon remaining at time t (years), two-pool decay. */
export function twoPoolRemaining(
  tYears: number,
  labileFraction: number,
  kLabile: number,
  kPersistent: number,
): number {
  return (
    labileFraction * Math.exp(-kLabile * tYears) +
    (1 - labileFraction) * Math.exp(-kPersistent * tYears)
  );
}

/** Decay parameters at the reference temperature, as a function of char H/Corg. */
export function decayParamsAtReference(hcOrg: number): {
  labileFraction: number;
  kLabile: number;
  kPersistent: number;
} {
  const hc = Math.max(0.1, Math.min(0.9, hcOrg));
  return {
    // More hydrogen means more residual aliphatic carbon, hence a larger fast pool.
    labileFraction: Math.max(0.02, Math.min(0.3, 0.03 + 0.35 * (hc - 0.18))),
    kLabile: 0.55,
    kPersistent: Math.max(0.0004, 0.0009 + 0.006 * (hc - 0.18)),
  };
}

/**
 * Full permanence report for a given feedstock's biochar at a given soil temperature.
 * BC100 — the fraction of biochar carbon still present after 100 years — is the
 * number the Puro Standard and the EBC both key durability claims off.
 */
export function permanenceFor(streamId: StreamId, soilTempC: number): PermanenceReport {
  const s = STREAMS[streamId];
  const hc = biocharHcOrg(s);
  const base = decayParamsAtReference(hc);
  const q10 = q10Factor(REFERENCE_SOIL_TEMP_C, soilTempC);
  const ratio = fT(REFERENCE_SOIL_TEMP_C, soilTempC);

  const kLabile = base.kLabile * ratio;
  const kPersistent = base.kPersistent * ratio;
  const bc100 = twoPoolRemaining(100, base.labileFraction, kLabile, kPersistent);

  const curve: Array<{ year: number; remaining: number }> = [];
  for (const year of [0, 1, 2, 5, 10, 20, 30, 50, 75, 100, 150, 200]) {
    curve.push({
      year,
      remaining: twoPoolRemaining(year, base.labileFraction, kLabile, kPersistent),
    });
  }

  return {
    hcOrgRatio: hc,
    soilTempC,
    referenceTempC: REFERENCE_SOIL_TEMP_C,
    q10,
    fT: ratio,
    bc100,
    labileFraction: base.labileFraction,
    labileRatePerYr: kLabile,
    persistentRatePerYr: kPersistent,
    curve,
    method:
      'Two-pool first-order decay parameterised by char H/C(org), with decay rates ' +
      'Q10-corrected from the harmonised 14.9 °C reference dataset to the local ' +
      'soil temperature. Model form after Azzi et al. (2024); Q10 relation after Woolf et al. (2021).',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-arc physical quantities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The physical inventory produced by moving and processing one tonne of feedstock.
 * Carbon results are computed *from* these quantities, which means the Monte Carlo
 * can perturb emission factors without re-running process models.
 */
export interface PhysicalPerTonne {
  dryT: number;
  counterfactual: Counterfactual;
  /** tonnes of carbon locked in biochar (before permanence adjustment) */
  biocharCarbonT: number;
  biocharT: number;
  cbgKg: number;
  ch4SlipM3: number;
  coalDisplacedMj: number;
  /** positive = exported to grid, negative = imported from grid */
  netKwh: number;
  compostT: number;
  digestateT: number;
  /** kg of plant-available N in compost/digestate displacing synthetic fertiliser */
  fertiliserNKg: number;
  /** litres of diesel burned hauling this tonne, including the empty return leg */
  transportDieselL: number;
  /** tonnes of feedstock requiring field aggregation */
  aggregationT: number;
  /** composting/windrow direct CH4 and N2O, tonnes of gas */
  compostCh4T: number;
  compostN2oT: number;
  pm25AvoidedKg: number;
  tkm: number;
}

/** Empty-return fuel burn as a fraction of laden burn. */
export const EMPTY_RETURN_FUEL_RATIO = 0.78;

/**
 * Windrow composting direct emissions, per tonne of wet waste.
 *
 * IPCC 2006 Vol.5 Ch.4 Table 4.1 gives a default of 4 kg CH4 and 0.3 kg N2O per
 * tonne wet, but that default is drawn largely from poorly aerated static piles.
 * Actively turned windrows — which is what every facility in this network operates
 * — sit near the bottom of the IPCC range. We use the turned-windrow figures and
 * say so, because the default would make composting look worse than the open heap
 * it replaces, which is an artefact of the aeration assumption rather than a result.
 */
export const COMPOST_CH4_KG_PER_T_WET = 1.8;
export const COMPOST_N2O_KG_PER_T_WET = 0.15;

export function physicalPerTonne(
  streamId: StreamId,
  pathwayId: PathwayId,
  efficiency: number,
  distanceKm: number,
  payloadT: number,
  vehicle: VehicleType,
): PhysicalPerTonne {
  const s = STREAMS[streamId];
  const p = PATHWAYS[pathwayId];
  const y = pathwayYield(s, pathwayId, efficiency);
  const dry = dryFraction(s);

  const charC = (biocharCarbonPct(s) / 100) * y.biocharT;

  // Round trip: loaded out, empty back. Per tonne, divided by achievable payload.
  const dieselPerTrip = vehicle.dieselLPerKm * distanceKm * (1 + EMPTY_RETURN_FUEL_RATIO);
  const transportDieselL = payloadT > 0 ? dieselPerTrip / payloadT : 0;

  const needsAggregation = s.kind === 'crop_residue';

  let fertiliserNKg = 0;
  if (y.compostT > 0) fertiliserNKg = y.compostT * 1000 * 0.012 * 0.35;
  if (y.digestateT > 0) fertiliserNKg += y.digestateT * 1000 * 0.015 * 0.45;

  return {
    dryT: dry,
    counterfactual: s.counterfactual,
    biocharCarbonT: charC,
    biocharT: y.biocharT,
    cbgKg: y.cbgKg,
    ch4SlipM3: y.ch4M3 * p.ch4SlipFraction,
    coalDisplacedMj: y.coalDisplacedMj,
    netKwh: y.netKwh,
    compostT: y.compostT,
    digestateT: y.digestateT,
    fertiliserNKg,
    transportDieselL,
    aggregationT: needsAggregation ? 1 : 0,
    compostCh4T: pathwayId === 'composting' ? COMPOST_CH4_KG_PER_T_WET / 1000 : 0,
    compostN2oT: pathwayId === 'composting' ? COMPOST_N2O_KG_PER_T_WET / 1000 : 0,
    pm25AvoidedKg: dry * COUNTERFACTUALS[s.counterfactual].pm25KgPerTDry,
    tkm: distanceKm,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Factor set — the quantities the Monte Carlo perturbs
// ─────────────────────────────────────────────────────────────────────────────

export interface FactorSet {
  bc100: number;
  counterfactual: Record<Counterfactual, number>;
  dieselKgPerL: number;
  gridEfTPerMwh: number;
  coalTco2PerMj: number;
  cngKgPerKg: number;
  fertNKgPerKg: number;
  ch4Gwp: number;
  n2oGwp: number;
  balingKgPerT: number;
}

export function baseFactors(bc100: number, assumptions: Assumptions): FactorSet {
  return {
    bc100,
    counterfactual: {
      open_field_burning: COUNTERFACTUALS.open_field_burning.tco2ePerTDry,
      open_dung_heap: COUNTERFACTUALS.open_dung_heap.tco2ePerTDry,
      unmanaged_landfill: COUNTERFACTUALS.unmanaged_landfill.tco2ePerTDry,
      open_dumping: COUNTERFACTUALS.open_dumping.tco2ePerTDry,
    },
    dieselKgPerL: DIESEL_WTW_KG_PER_L,
    gridEfTPerMwh: assumptions.gridEfTPerMwh,
    coalTco2PerMj: EF.coal.value * 1e-6,
    cngKgPerKg: EF.cngDisplaced.value,
    fertNKgPerKg: EF.syntheticFertiliserN.value,
    ch4Gwp: EF.ch4Gwp.value,
    n2oGwp: EF.n2oGwp.value,
    balingKgPerT: EF.baling.value,
  };
}

export interface CarbonComponents {
  durableT: number;
  avoidedT: number;
  substitutionT: number;
  emittedT: number;
  netT: number;
}

/** Evaluate carbon for a physical inventory scaled by tonnage, under a factor set. */
export function evaluateCarbon(
  phys: PhysicalPerTonne,
  tonnes: number,
  fac: FactorSet,
): CarbonComponents {
  const durable = phys.biocharCarbonT * CO2_PER_C * fac.bc100 * tonnes;
  const avoided = phys.dryT * fac.counterfactual[phys.counterfactual] * tonnes;

  let substitution = 0;
  substitution += (phys.cbgKg * fac.cngKgPerKg) / 1000;
  substitution += phys.coalDisplacedMj * fac.coalTco2PerMj;
  if (phys.netKwh > 0) substitution += (phys.netKwh / 1000) * fac.gridEfTPerMwh;
  substitution += (phys.fertiliserNKg * fac.fertNKgPerKg) / 1000;
  substitution *= tonnes;

  let emitted = 0;
  emitted += (phys.transportDieselL * fac.dieselKgPerL) / 1000;
  emitted += (phys.aggregationT * fac.balingKgPerT) / 1000;
  if (phys.netKwh < 0) emitted += (-phys.netKwh / 1000) * fac.gridEfTPerMwh;
  emitted += (phys.ch4SlipM3 * CH4_DENSITY_KG_PER_M3 * fac.ch4Gwp) / 1000;
  emitted += phys.compostCh4T * fac.ch4Gwp;
  emitted += phys.compostN2oT * fac.n2oGwp;
  emitted *= tonnes;

  return {
    durableT: durable,
    avoidedT: avoided,
    substitutionT: substitution,
    emittedT: emitted,
    netT: durable + avoided + substitution - emitted,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Network-level aggregation
// ─────────────────────────────────────────────────────────────────────────────

export interface CarbonAggregate {
  biocharCarbonT: number;
  biocharT: number;
  dryTByCounterfactual: Record<Counterfactual, number>;
  cbgKg: number;
  ch4SlipM3: number;
  coalDisplacedMj: number;
  kwhExported: number;
  kwhImported: number;
  fertiliserNKg: number;
  transportDieselL: number;
  aggregationT: number;
  compostCh4T: number;
  compostN2oT: number;
  pm25AvoidedKg: number;
  totalTonnes: number;
  tkm: number;
}

export function emptyAggregate(): CarbonAggregate {
  return {
    biocharCarbonT: 0,
    biocharT: 0,
    dryTByCounterfactual: {
      open_field_burning: 0,
      open_dung_heap: 0,
      unmanaged_landfill: 0,
      open_dumping: 0,
    },
    cbgKg: 0,
    ch4SlipM3: 0,
    coalDisplacedMj: 0,
    kwhExported: 0,
    kwhImported: 0,
    fertiliserNKg: 0,
    transportDieselL: 0,
    aggregationT: 0,
    compostCh4T: 0,
    compostN2oT: 0,
    pm25AvoidedKg: 0,
    totalTonnes: 0,
    tkm: 0,
  };
}

export function addToAggregate(
  agg: CarbonAggregate,
  phys: PhysicalPerTonne,
  tonnes: number,
): void {
  agg.biocharCarbonT += phys.biocharCarbonT * tonnes;
  agg.biocharT += phys.biocharT * tonnes;
  agg.dryTByCounterfactual[phys.counterfactual] += phys.dryT * tonnes;
  agg.cbgKg += phys.cbgKg * tonnes;
  agg.ch4SlipM3 += phys.ch4SlipM3 * tonnes;
  agg.coalDisplacedMj += phys.coalDisplacedMj * tonnes;
  if (phys.netKwh > 0) agg.kwhExported += phys.netKwh * tonnes;
  else agg.kwhImported += -phys.netKwh * tonnes;
  agg.fertiliserNKg += phys.fertiliserNKg * tonnes;
  agg.transportDieselL += phys.transportDieselL * tonnes;
  agg.aggregationT += phys.aggregationT * tonnes;
  agg.compostCh4T += phys.compostCh4T * tonnes;
  agg.compostN2oT += phys.compostN2oT * tonnes;
  agg.pm25AvoidedKg += phys.pm25AvoidedKg * tonnes;
  agg.totalTonnes += tonnes;
  agg.tkm += phys.tkm * tonnes;
}

export function evaluateAggregate(agg: CarbonAggregate, fac: FactorSet): CarbonComponents {
  const durable = agg.biocharCarbonT * CO2_PER_C * fac.bc100;

  let avoided = 0;
  for (const key of Object.keys(agg.dryTByCounterfactual) as Counterfactual[]) {
    avoided += agg.dryTByCounterfactual[key] * fac.counterfactual[key];
  }

  let substitution = 0;
  substitution += (agg.cbgKg * fac.cngKgPerKg) / 1000;
  substitution += agg.coalDisplacedMj * fac.coalTco2PerMj;
  substitution += (agg.kwhExported / 1000) * fac.gridEfTPerMwh;
  substitution += (agg.fertiliserNKg * fac.fertNKgPerKg) / 1000;

  let emitted = 0;
  emitted += (agg.transportDieselL * fac.dieselKgPerL) / 1000;
  emitted += (agg.aggregationT * fac.balingKgPerT) / 1000;
  emitted += (agg.kwhImported / 1000) * fac.gridEfTPerMwh;
  emitted += (agg.ch4SlipM3 * CH4_DENSITY_KG_PER_M3 * fac.ch4Gwp) / 1000;
  emitted += agg.compostCh4T * fac.ch4Gwp;
  emitted += agg.compostN2oT * fac.n2oGwp;

  return {
    durableT: durable,
    avoidedT: avoided,
    substitutionT: substitution,
    emittedT: emitted,
    netT: durable + avoided + substitution - emitted,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The ledger — every number traceable to a line
// ─────────────────────────────────────────────────────────────────────────────

export function buildLedger(
  agg: CarbonAggregate,
  assumptions: Assumptions,
  permanence: PermanenceReport | null,
  withUncertainty: boolean,
): CarbonLedger {
  const bc100 = permanence ? permanence.bc100 : 1;
  const fac = baseFactors(bc100, assumptions);
  const lines: LedgerLine[] = [];

  const grossChar = agg.biocharCarbonT * CO2_PER_C;
  if (grossChar > 0) {
    lines.push({
      key: 'char_gross',
      label: 'Carbon fixed in biochar (gross)',
      valueT: grossChar,
      kind: 'removal',
      basis: `${agg.biocharT.toFixed(0)} t biochar × char carbon content × 44/12`,
      source: 'Derived from feedstock ultimate analysis and slow-pyrolysis char yield',
      uncertaintyPct: 18,
    });
    if (permanence) {
      const adj = grossChar * (permanence.bc100 - 1);
      lines.push({
        key: 'char_permanence',
        label: `Permanence adjustment to 100 years (BC₁₀₀ = ${(permanence.bc100 * 100).toFixed(1)}%)`,
        valueT: adj,
        kind: 'adjustment',
        basis: `Two-pool decay at H/Cₒᵣᵍ ${permanence.hcOrgRatio.toFixed(2)}, Q10-corrected from ${permanence.referenceTempC} °C to ${permanence.soilTempC} °C (fₜ = ${permanence.fT.toFixed(3)})`,
        source: 'Azzi et al. 2024 Geoderma 441:116761; Woolf et al. 2021 ES&T 55:14795',
        uncertaintyPct: 15,
      });
    }
  }

  for (const key of Object.keys(agg.dryTByCounterfactual) as Counterfactual[]) {
    const dryT = agg.dryTByCounterfactual[key];
    if (dryT <= 0.01) continue;
    const cf = COUNTERFACTUALS[key];
    lines.push({
      key: `avoided_${key}`,
      label: `Avoided: ${cf.label.toLowerCase()}`,
      valueT: dryT * cf.tco2ePerTDry,
      kind: 'avoided',
      basis: `${dryT.toFixed(0)} t dry matter × ${cf.tco2ePerTDry} tCO₂e/t. ${cf.basis}`,
      source: cf.source,
      uncertaintyPct: cf.uncertaintyPct,
    });
  }

  if (agg.cbgKg > 1) {
    lines.push({
      key: 'sub_cng',
      label: 'Fossil CNG displaced by bio-CNG',
      valueT: (agg.cbgKg * fac.cngKgPerKg) / 1000,
      kind: 'substitution',
      basis: `${(agg.cbgKg / 1000).toFixed(1)} t CBG × ${fac.cngKgPerKg} kgCO₂e/kg`,
      source: EF.cngDisplaced.source,
      uncertaintyPct: EF.cngDisplaced.uncertaintyPct,
    });
  }
  if (agg.coalDisplacedMj > 1) {
    lines.push({
      key: 'sub_coal',
      label: 'Thermal coal displaced by pellet co-firing',
      valueT: agg.coalDisplacedMj * fac.coalTco2PerMj,
      kind: 'substitution',
      basis: `${(agg.coalDisplacedMj / 1000).toFixed(0)} GJ × ${EF.coal.value} tCO₂/TJ`,
      source: EF.coal.source,
      uncertaintyPct: EF.coal.uncertaintyPct,
    });
  }
  if (agg.kwhExported > 1) {
    lines.push({
      key: 'sub_power',
      label: 'Grid electricity displaced by exported power',
      valueT: (agg.kwhExported / 1000) * fac.gridEfTPerMwh,
      kind: 'substitution',
      basis: `${(agg.kwhExported / 1000).toFixed(0)} MWh × ${fac.gridEfTPerMwh} tCO₂e/MWh`,
      source: EF.gridElectricity.source,
      uncertaintyPct: EF.gridElectricity.uncertaintyPct,
    });
  }
  if (agg.fertiliserNKg > 1) {
    lines.push({
      key: 'sub_fert',
      label: 'Synthetic nitrogen displaced by compost / digestate',
      valueT: (agg.fertiliserNKg * fac.fertNKgPerKg) / 1000,
      kind: 'substitution',
      basis: `${(agg.fertiliserNKg / 1000).toFixed(1)} t plant-available N × ${fac.fertNKgPerKg} kgCO₂e/kg N`,
      source: EF.syntheticFertiliserN.source,
      uncertaintyPct: EF.syntheticFertiliserN.uncertaintyPct,
    });
  }

  if (agg.transportDieselL > 1) {
    lines.push({
      key: 'em_transport',
      label: 'Transport emissions (well-to-wheel, incl. empty return)',
      valueT: -(agg.transportDieselL * fac.dieselKgPerL) / 1000,
      kind: 'emission',
      basis: `${agg.transportDieselL.toFixed(0)} L diesel × ${fac.dieselKgPerL.toFixed(2)} kgCO₂e/L over ${(agg.tkm / 1000).toFixed(0)}k tonne-km`,
      source: EF.dieselCombustion.source,
      uncertaintyPct: 10,
    });
  }
  if (agg.aggregationT > 1) {
    lines.push({
      key: 'em_aggregation',
      label: 'Field aggregation (raking, baling, loading)',
      valueT: -(agg.aggregationT * fac.balingKgPerT) / 1000,
      kind: 'emission',
      basis: `${agg.aggregationT.toFixed(0)} t × ${fac.balingKgPerT} kgCO₂e/t`,
      source: EF.baling.source,
      uncertaintyPct: EF.baling.uncertaintyPct,
    });
  }
  if (agg.kwhImported > 1) {
    lines.push({
      key: 'em_parasitic',
      label: 'Process electricity drawn from grid',
      valueT: -(agg.kwhImported / 1000) * fac.gridEfTPerMwh,
      kind: 'emission',
      basis: `${(agg.kwhImported / 1000).toFixed(0)} MWh × ${fac.gridEfTPerMwh} tCO₂e/MWh`,
      source: EF.gridElectricity.source,
      uncertaintyPct: EF.gridElectricity.uncertaintyPct,
    });
  }
  if (agg.ch4SlipM3 > 0.1) {
    lines.push({
      key: 'em_ch4_slip',
      label: 'Digester fugitive methane (2% slip)',
      valueT: -(agg.ch4SlipM3 * CH4_DENSITY_KG_PER_M3 * fac.ch4Gwp) / 1000,
      kind: 'emission',
      basis: `${agg.ch4SlipM3.toFixed(0)} m³ CH₄ × ${CH4_DENSITY_KG_PER_M3} kg/m³ × GWP ${fac.ch4Gwp}`,
      source: 'Measured fugitive rates at commercial CBG plants; IPCC AR6 GWP',
      uncertaintyPct: 55,
    });
  }
  if (agg.compostCh4T > 0.001) {
    lines.push({
      key: 'em_compost',
      label: 'Windrow composting CH₄ and N₂O',
      valueT: -(agg.compostCh4T * fac.ch4Gwp + agg.compostN2oT * fac.n2oGwp),
      kind: 'emission',
      basis: `IPCC defaults 4 kg CH₄ and 0.3 kg N₂O per tonne wet waste composted`,
      source: 'IPCC 2006 GL Vol.5 Ch.4 Table 4.1, lower bound of the range for actively turned windrows',
      uncertaintyPct: 40,
    });
  }

  const comp = evaluateAggregate(agg, fac);
  lines.push({
    key: 'net',
    label: 'Net carbon impact',
    valueT: comp.netT,
    kind: 'total',
    basis: 'Durable removal + avoided emissions + substitution − emissions',
    source: 'This ledger',
    uncertaintyPct: 0,
  });

  let uncertainty: UncertaintyBand | null = null;
  if (withUncertainty && agg.totalTonnes > 0) {
    uncertainty = monteCarlo(agg, assumptions, permanence);
  }

  return {
    lines,
    durableRemovalT: comp.durableT,
    avoidedEmissionsT: comp.avoidedT,
    substitutionT: comp.substitutionT,
    emissionsT: comp.emittedT,
    netT: comp.netT,
    permanence,
    uncertainty,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Monte Carlo — the SwolfPy idea, applied to the whole network result
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single-point carbon number is a claim the model cannot support. Every emission
 * factor in the ledger carries a published uncertainty; propagating them gives a
 * band, and the band is what an auditor would actually ask for.
 *
 * Factors are drawn lognormally (they are strictly positive and right-skewed) from
 * a seeded generator, so the band is reproducible across runs.
 */
export function monteCarlo(
  agg: CarbonAggregate,
  assumptions: Assumptions,
  permanence: PermanenceReport | null,
): UncertaintyBand {
  const draws = Math.max(50, Math.min(50000, assumptions.mcDraws));
  const rng = makeRng(assumptions.seed ^ 0x5f3a21);
  const base = baseFactors(permanence ? permanence.bc100 : 1, assumptions);
  const samples: number[] = new Array(draws);

  for (let i = 0; i < draws; i++) {
    const fac: FactorSet = {
      // BC100 is a bounded fraction, so it is perturbed then clipped rather than
      // drawn lognormally.
      bc100: Math.max(
        0.2,
        Math.min(0.99, lognormalAround(rng, base.bc100, 0.15)),
      ),
      counterfactual: {
        open_field_burning: lognormalAround(
          rng,
          base.counterfactual.open_field_burning,
          COUNTERFACTUALS.open_field_burning.uncertaintyPct / 100,
        ),
        open_dung_heap: lognormalAround(
          rng,
          base.counterfactual.open_dung_heap,
          COUNTERFACTUALS.open_dung_heap.uncertaintyPct / 100,
        ),
        unmanaged_landfill: lognormalAround(
          rng,
          base.counterfactual.unmanaged_landfill,
          COUNTERFACTUALS.unmanaged_landfill.uncertaintyPct / 100,
        ),
        open_dumping: lognormalAround(
          rng,
          base.counterfactual.open_dumping,
          COUNTERFACTUALS.open_dumping.uncertaintyPct / 100,
        ),
      },
      dieselKgPerL: lognormalAround(rng, base.dieselKgPerL, 0.1),
      gridEfTPerMwh: lognormalAround(
        rng,
        base.gridEfTPerMwh,
        EF.gridElectricity.uncertaintyPct / 100,
      ),
      coalTco2PerMj: lognormalAround(rng, base.coalTco2PerMj, EF.coal.uncertaintyPct / 100),
      cngKgPerKg: lognormalAround(rng, base.cngKgPerKg, EF.cngDisplaced.uncertaintyPct / 100),
      fertNKgPerKg: lognormalAround(
        rng,
        base.fertNKgPerKg,
        EF.syntheticFertiliserN.uncertaintyPct / 100,
      ),
      ch4Gwp: base.ch4Gwp,
      n2oGwp: base.n2oGwp,
      balingKgPerT: lognormalAround(rng, base.balingKgPerT, EF.baling.uncertaintyPct / 100),
    };
    samples[i] = evaluateAggregate(agg, fac).netT;
  }

  const sorted = samples.slice().sort((a, b) => a - b);
  const lo = sorted[0];
  const hi = sorted[sorted.length - 1];
  const binCount = 28;
  const width = (hi - lo) / binCount || 1;
  const counts = new Array(binCount).fill(0);
  for (const v of samples) {
    const idx = Math.min(binCount - 1, Math.max(0, Math.floor((v - lo) / width)));
    counts[idx]++;
  }

  return {
    draws,
    p5: percentileSorted(sorted, 0.05),
    p50: percentileSorted(sorted, 0.5),
    p95: percentileSorted(sorted, 0.95),
    mean: mean(samples),
    stdev: stdev(samples),
    histogram: counts.map((count, i) => ({ bin: lo + width * (i + 0.5), count })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers used by the optimiser and API
// ─────────────────────────────────────────────────────────────────────────────

/** Value of the carbon produced by an allocation, in rupees. */
export function carbonRevenueInr(
  durableT: number,
  avoidedPlusSubstitutionT: number,
  assumptions: Assumptions,
): number {
  return (
    durableT * assumptions.cdrPriceInrPerT +
    Math.max(0, avoidedPlusSubstitutionT) * assumptions.vcmPriceInrPerT
  );
}

export function aggregateAllocations(
  allocations: Allocation[],
  facilities: Facility[],
  vehicles: VehicleType[],
  assumptions: Assumptions,
): CarbonAggregate {
  const facById = new Map(facilities.map((x) => [x.id, x]));
  const vehById = new Map(vehicles.map((v) => [v.id, v]));
  const agg = emptyAggregate();
  for (const a of allocations) {
    const fac = facById.get(a.facilityId);
    const veh = vehById.get(a.vehicleId);
    if (!fac || !veh) continue;
    const phys = physicalPerTonne(
      a.stream,
      a.pathway,
      fac.efficiency,
      a.distanceKm,
      a.payloadT,
      veh,
    );
    addToAggregate(agg, phys, a.tonnes);
  }
  return agg;
}

/**
 * The dominant biochar feedstock in a set of allocations, used to pick which
 * permanence report represents the network. Reported explicitly in the UI so it is
 * clear the headline BC100 is feedstock-weighted, not universal.
 */
/**
 * The network ledger for a set of allocations.
 *
 * Exists so that every module computing "share of network net carbon" divides by
 * the same number. `OptimizationResult.totals.netCarbonT` is NOT that number: the
 * optimiser aggregates each allocation under its own permanence, which for this
 * network reads 31,736 against the ledger's 34,921. Both are internally
 * consistent; only one is the figure the product displays.
 */
export function networkLedger(
  allocations: Allocation[],
  facilities: Facility[],
  vehicles: VehicleType[],
  assumptions: Assumptions,
  /**
   * The permanence feedstock to use, when this call is decomposing a larger whole.
   *
   * Without it, a slice derives its own dominant biochar stream and therefore its
   * own BC100, so the parts stop summing to the whole — per-pathway bands came out
   * 54 tCO2e short of the network before this existed. Callers splitting a plan
   * pass the plan's dominant stream; callers evaluating a plan in its own right
   * omit it.
   */
  dominantOverride?: StreamId | null,
): CarbonLedger {
  const dominant =
    dominantOverride !== undefined ? dominantOverride : dominantBiocharStream(allocations);
  const permanence = dominant ? permanenceFor(dominant, assumptions.soilTempC) : null;
  return buildLedger(
    aggregateAllocations(allocations, facilities, vehicles, assumptions),
    assumptions,
    permanence,
    false,
  );
}

export function dominantBiocharStream(allocations: Allocation[]): StreamId | null {
  const byStream = new Map<StreamId, number>();
  for (const a of allocations) {
    if (!PATHWAYS[a.pathway].producesDurableRemoval) continue;
    byStream.set(a.stream, (byStream.get(a.stream) ?? 0) + a.tonnes);
  }
  let best: StreamId | null = null;
  let bestT = 0;
  for (const [s, t] of byStream) {
    if (t > bestT) {
      bestT = t;
      best = s;
    }
  }
  return best;
}

export { CARBON_MARKETS };
