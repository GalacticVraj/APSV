/**
 * Conversion pathways.
 *
 * A pathway is defined by the *gates* it imposes on a feedstock and the products
 * it yields. Yields are computed from feedstock properties (see streams.ts), so a
 * pathway that is wrong for a feedstock produces a poor result rather than being
 * silently excluded — and the UI can show *why* it is poor.
 */

import type { PathwayDef, PathwayId, StreamProps, StreamId } from './types.ts';
import {
  STREAMS,
  dryFraction,
  vsPerWetTonne,
  biocharYieldDry,
  biocharCarbonPct,
} from './streams.ts';

export const PATHWAYS: Record<PathwayId, PathwayDef> = {
  pyrolysis_biochar: {
    id: 'pyrolysis_biochar',
    label: 'Slow pyrolysis → biochar',
    short: 'Biochar',
    primaryProduct: 'biochar',
    coProducts: ['electricity'],
    maxMoisturePct: 25, // drying a 70%-moisture feed costs more energy than the char is worth
    minMoisturePct: 0,
    maxAshPct: 30,
    minCnRatio: 0,
    maxCnRatio: 1000,
    parasiticKwhPerT: 55,
    processHeatMjPerT: 0, // autothermal: syngas combustion supplies process heat
    ch4SlipFraction: 0,
    producesDurableRemoval: true,
    maturity: 'Commercial; ~550 °C continuous screw/auger reactors',
    description:
      'The only pathway in the network that produces durable carbon removal. Feedstock carbon is converted to condensed aromatic carbon that resists microbial decay for centuries. Requires a dry, lignin-rich feed.',
  },
  anaerobic_digestion_cbg: {
    id: 'anaerobic_digestion_cbg',
    label: 'Anaerobic digestion → compressed bio-gas',
    short: 'Bio-CNG',
    primaryProduct: 'bio_cng',
    coProducts: ['digestate'],
    maxMoisturePct: 95,
    minMoisturePct: 55, // below this the digester needs dilution water it may not have
    maxAshPct: 25,
    minCnRatio: 15, // below 15 ammonia inhibition destabilises the digester
    maxCnRatio: 40, // above 40 nitrogen-limited, digestion stalls
    parasiticKwhPerT: 38,
    processHeatMjPerT: 210, // mesophilic digester heating
    ch4SlipFraction: 0.02, // 2% fugitive methane — counted against the pathway, honestly
    producesDurableRemoval: false,
    maturity: 'Commercial; SATAT programme, ~₹54/kg assured offtake',
    description:
      'Converts wet, nitrogen-balanced organics to vehicle-grade compressed bio-gas plus a fertiliser-grade digestate. Displaces fossil CNG. Methane slip is counted as an emission rather than ignored.',
  },
  pellet_cofiring: {
    id: 'pellet_cofiring',
    label: 'Densification → pellet co-firing',
    short: 'Pellets',
    primaryProduct: 'pellets',
    coProducts: [],
    maxMoisturePct: 18,
    minMoisturePct: 0,
    maxAshPct: 20, // high-silica paddy straw slags and fouls boiler tubes
    minCnRatio: 0,
    maxCnRatio: 1000,
    parasiticKwhPerT: 85, // densification is electricity-hungry
    processHeatMjPerT: 120,
    ch4SlipFraction: 0,
    producesDurableRemoval: false,
    maturity: 'Commercial; thermal-plant biomass co-firing mandate',
    description:
      'Densifies dry residue into pellets that displace coal in thermal power stations. High throughput and policy-backed offtake, but the carbon benefit is a one-off fossil displacement, not a removal.',
  },
  composting: {
    id: 'composting',
    label: 'Windrow composting',
    short: 'Compost',
    primaryProduct: 'compost',
    coProducts: [],
    maxMoisturePct: 90,
    minMoisturePct: 35,
    maxAshPct: 35,
    minCnRatio: 12,
    maxCnRatio: 45,
    parasiticKwhPerT: 12,
    processHeatMjPerT: 0,
    ch4SlipFraction: 0.012, // anaerobic pockets in the windrow
    producesDurableRemoval: false,
    maturity: 'Mature; lowest capital intensity in the network',
    description:
      'Cheapest and most robust pathway. Low value per tonne and only a small, low-durability soil carbon effect, but it absorbs feedstock nothing else can take and needs almost no capital.',
  },
  gasification_power: {
    id: 'gasification_power',
    label: 'Gasification → power',
    short: 'Power',
    primaryProduct: 'electricity',
    coProducts: ['biochar'],
    maxMoisturePct: 20,
    minMoisturePct: 0,
    maxAshPct: 16,
    minCnRatio: 0,
    maxCnRatio: 1000,
    parasiticKwhPerT: 95,
    processHeatMjPerT: 0,
    ch4SlipFraction: 0,
    producesDurableRemoval: true, // small char fraction, ~5% of feed
    maturity: 'Commercial at small scale; sensitive to ash and tar',
    description:
      'Converts dry residue to producer gas for on-site generation, displacing grid electricity. Yields a small char fraction as a by-product. Ash-sensitive, so high-silica feedstocks are excluded.',
  },
};

export const PATHWAY_IDS = Object.keys(PATHWAYS) as PathwayId[];

// ─────────────────────────────────────────────────────────────────────────────
// Suitability
// ─────────────────────────────────────────────────────────────────────────────

export interface SuitabilityResult {
  score: number; // 0 = infeasible, 1 = ideal
  feasible: boolean;
  gates: Array<{ gate: string; pass: boolean; detail: string }>;
  limitingFactor: string;
}

/**
 * Feedstock-to-pathway suitability.
 *
 * Hard gates make a combination infeasible (the optimiser never generates the arc).
 * Soft factors scale the score, which enters the optimiser objective as a quality
 * multiplier. Every gate returns a human-readable reason so the UI can explain an
 * empty result set instead of showing "no data".
 */
export function suitability(stream: StreamProps, pathway: PathwayDef): SuitabilityResult {
  const gates: Array<{ gate: string; pass: boolean; detail: string }> = [];
  let score = 1;
  let limiting = 'none';

  const moistureOk =
    stream.moisturePct <= pathway.maxMoisturePct &&
    stream.moisturePct >= pathway.minMoisturePct;
  gates.push({
    gate: 'Moisture',
    pass: moistureOk,
    detail: `${stream.moisturePct.toFixed(0)}% vs window ${pathway.minMoisturePct}–${pathway.maxMoisturePct}%`,
  });

  const ashOk = stream.ashPct <= pathway.maxAshPct;
  gates.push({
    gate: 'Ash',
    pass: ashOk,
    detail: `${stream.ashPct.toFixed(1)}% vs max ${pathway.maxAshPct}%`,
  });

  const cnOk = stream.cnRatio >= pathway.minCnRatio && stream.cnRatio <= pathway.maxCnRatio;
  gates.push({
    gate: 'C:N ratio',
    pass: cnOk,
    detail: `${stream.cnRatio.toFixed(0)}:1 vs window ${pathway.minCnRatio}–${pathway.maxCnRatio}`,
  });

  if (!moistureOk) limiting = 'moisture';
  else if (!ashOk) limiting = 'ash';
  else if (!cnOk) limiting = 'C:N ratio';

  const feasible = moistureOk && ashOk && cnOk;
  if (!feasible) return { score: 0, feasible: false, gates, limitingFactor: limiting };

  // Soft quality factors — how well suited, not merely permitted.
  if (pathway.id === 'pyrolysis_biochar') {
    // Lignin drives char yield and aromaticity; ash dilutes the product.
    const ligninScore = Math.min(1, stream.ligninPct / 20);
    const ashPenalty = Math.max(0.45, 1 - stream.ashPct / 40);
    score = 0.35 + 0.4 * ligninScore + 0.25 * ashPenalty;
    limiting = stream.ashPct > 15 ? 'ash dilution of char carbon' : 'lignin content';
  } else if (pathway.id === 'anaerobic_digestion_cbg') {
    // Digestibility peaks at C:N ~25 and falls with lignin.
    const cnScore = 1 - Math.min(1, Math.abs(stream.cnRatio - 25) / 25);
    const ligninPenalty = Math.max(0.3, 1 - stream.ligninPct / 25);
    const bmpScore = Math.min(1, stream.bmpM3PerTVs / 400);
    score = 0.2 * cnScore + 0.3 * ligninPenalty + 0.5 * bmpScore;
    limiting = stream.ligninPct > 15 ? 'lignin recalcitrance' : 'methane potential';
  } else if (pathway.id === 'pellet_cofiring') {
    const lhvScore = Math.min(1, stream.lhvMjPerKg / 18);
    const ashPenalty = Math.max(0.3, 1 - stream.ashPct / 14);
    score = 0.55 * lhvScore + 0.45 * ashPenalty;
    limiting = stream.ashPct > 8 ? 'boiler slagging risk' : 'heating value';
  } else if (pathway.id === 'composting') {
    const cnScore = 1 - Math.min(1, Math.abs(stream.cnRatio - 28) / 28);
    score = 0.45 + 0.55 * cnScore;
    limiting = 'C:N balance';
  } else if (pathway.id === 'gasification_power') {
    const lhvScore = Math.min(1, stream.lhvMjPerKg / 18);
    const ashPenalty = Math.max(0.3, 1 - stream.ashPct / 16);
    score = 0.5 * lhvScore + 0.5 * ashPenalty;
    limiting = 'ash and tar loading';
  }

  return { score: Math.max(0, Math.min(1, score)), feasible: true, gates, limitingFactor: limiting };
}

// ─────────────────────────────────────────────────────────────────────────────
// Product yields, per tonne of as-received feedstock
// ─────────────────────────────────────────────────────────────────────────────

export interface PathwayYield {
  /** tonnes of biochar per tonne wet feed */
  biocharT: number;
  /** kilograms of compressed bio-gas per tonne wet feed */
  cbgKg: number;
  /** cubic metres of CH4 produced per tonne wet feed (before slip and upgrading) */
  ch4M3: number;
  /** tonnes of pellets per tonne wet feed */
  pelletT: number;
  /** tonnes of compost per tonne wet feed */
  compostT: number;
  /** tonnes of digestate per tonne wet feed */
  digestateT: number;
  /** net kWh exported per tonne wet feed (after parasitic load) */
  netKwh: number;
  /** MJ of coal-equivalent thermal energy displaced per tonne wet feed */
  coalDisplacedMj: number;
}

/** Methane density at standard conditions, kg/m3. */
export const CH4_DENSITY_KG_PER_M3 = 0.716;
/** Fraction of raw biogas methane recovered as saleable CBG after upgrading. */
export const CBG_UPGRADING_RECOVERY = 0.96;
/** Gasifier cold-gas efficiency to net electricity. */
export const GASIFIER_ELECTRICAL_EFFICIENCY = 0.21;
/** Mass loss across pelletising (fines, drying). */
export const PELLET_MASS_LOSS = 0.06;
/** Indian thermal coal lower heating value, MJ/kg. */
export const COAL_LHV_MJ_PER_KG = 15.5;

export function pathwayYield(
  stream: StreamProps,
  pathwayId: PathwayId,
  efficiency: number,
): PathwayYield {
  const p = PATHWAYS[pathwayId];
  const dry = dryFraction(stream);
  const y: PathwayYield = {
    biocharT: 0,
    cbgKg: 0,
    ch4M3: 0,
    pelletT: 0,
    compostT: 0,
    digestateT: 0,
    netKwh: 0,
    coalDisplacedMj: 0,
  };

  if (pathwayId === 'pyrolysis_biochar') {
    y.biocharT = dry * biocharYieldDry(stream) * efficiency;
    // Syngas runs the process and exports a modest surplus.
    const syngasMj = dry * stream.lhvMjPerKg * 1000 * 0.45;
    const exportKwh = (syngasMj * 0.18) / 3.6;
    y.netKwh = exportKwh - p.parasiticKwhPerT;
  } else if (pathwayId === 'anaerobic_digestion_cbg') {
    y.ch4M3 = vsPerWetTonne(stream) * stream.bmpM3PerTVs * efficiency;
    const deliveredCh4 = y.ch4M3 * (1 - p.ch4SlipFraction) * CBG_UPGRADING_RECOVERY;
    y.cbgKg = deliveredCh4 * CH4_DENSITY_KG_PER_M3;
    y.digestateT = dry * 0.45 + 0.08; // solid fraction of digestate, field-ready
    y.netKwh = -p.parasiticKwhPerT;
  } else if (pathwayId === 'pellet_cofiring') {
    y.pelletT = dry * (1 - PELLET_MASS_LOSS) * efficiency;
    y.coalDisplacedMj = y.pelletT * 1000 * stream.lhvMjPerKg;
    y.netKwh = -p.parasiticKwhPerT;
  } else if (pathwayId === 'composting') {
    // ~45% mass loss as CO2 and water over a 60-day windrow.
    y.compostT = dry * 0.55 * efficiency + (1 - dry) * 0.1;
    y.netKwh = -p.parasiticKwhPerT;
  } else if (pathwayId === 'gasification_power') {
    const feedMj = dry * stream.lhvMjPerKg * 1000;
    const grossKwh = (feedMj * GASIFIER_ELECTRICAL_EFFICIENCY * efficiency) / 3.6;
    y.netKwh = grossKwh - p.parasiticKwhPerT;
    y.biocharT = dry * 0.05 * efficiency; // gasifier char by-product
  }

  return y;
}

/** Convenience: which pathways can physically take this stream at all. */
export function feasiblePathways(streamId: StreamId): PathwayId[] {
  const s = STREAMS[streamId];
  return PATHWAY_IDS.filter((p) => suitability(s, PATHWAYS[p]).feasible);
}
