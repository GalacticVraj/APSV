/**
 * Feedstock characterisation.
 *
 * Every pathway yield in TERRAFLUX is *derived* from these properties rather than
 * read out of a flat (waste type → factor) lookup table. That is the single
 * biggest modelling difference between this and a typical waste dashboard: when
 * you change a feedstock's lignin or ash content, biochar yield, char carbon
 * content, methane potential and truck payload all move accordingly.
 *
 * Property ranges are typical published values for Indian agricultural and urban
 * organic residues. All demo data is synthetic; the *property values* are drawn
 * from the literature cited per line.
 */

import type { StreamId, StreamProps, Counterfactual } from './types.ts';

export const STREAMS: Record<StreamId, StreamProps> = {
  paddy_straw: {
    id: 'paddy_straw',
    label: 'Paddy straw',
    kind: 'crop_residue',
    moisturePct: 13,
    ashPct: 18.7, // high silica — the reason paddy straw is a poor boiler fuel
    carbonPct: 38.2,
    hydrogenPct: 5.1,
    nitrogenPct: 0.64,
    ligninPct: 12.0,
    cnRatio: 60,
    lhvMjPerKg: 14.6,
    bulkDensityTPerM3: 0.15, // round-baled; loose straw is ~0.04
    vsFraction: 0.81,
    bmpM3PerTVs: 205, // silica + lignin suppress digestibility
    counterfactual: 'open_field_burning',
    aggregationCostInrPerT: 1100, // rake, bale, load — the dominant cost in Punjab
    gatePriceInrPerT: 600,
    notes:
      'The emblematic Indian residue problem. ~20 Mt/yr in Punjab alone with a ~20-day window between paddy harvest and wheat sowing. High silica makes combustion troublesome but pyrolysis attractive.',
  },
  wheat_straw: {
    id: 'wheat_straw',
    label: 'Wheat straw',
    kind: 'crop_residue',
    moisturePct: 10,
    ashPct: 7.4,
    carbonPct: 43.2,
    hydrogenPct: 5.6,
    nitrogenPct: 0.52,
    ligninPct: 17.0,
    cnRatio: 85,
    lhvMjPerKg: 16.5,
    bulkDensityTPerM3: 0.16,
    vsFraction: 0.9,
    bmpM3PerTVs: 265,
    counterfactual: 'open_field_burning',
    aggregationCostInrPerT: 900,
    gatePriceInrPerT: 1400, // competes directly with fodder demand — genuinely expensive
    notes:
      'Competes with the fodder market, so the gate price is high and the network should generally not outbid cattle feed. The optimiser reflects this and usually leaves most wheat straw alone.',
  },
  cotton_stalk: {
    id: 'cotton_stalk',
    label: 'Cotton stalk',
    kind: 'crop_residue',
    moisturePct: 12,
    ashPct: 5.1,
    carbonPct: 45.0,
    hydrogenPct: 5.7,
    nitrogenPct: 0.72,
    ligninPct: 22.0,
    cnRatio: 63,
    lhvMjPerKg: 17.2,
    bulkDensityTPerM3: 0.12, // woody, awkward, needs shredding
    vsFraction: 0.92,
    bmpM3PerTVs: 160,
    counterfactual: 'open_field_burning',
    aggregationCostInrPerT: 1300,
    gatePriceInrPerT: 500,
    notes:
      'High lignin and low ash — the best biochar feedstock in the network. Low bulk density makes it volume-limited in transport.',
  },
  rice_husk: {
    id: 'rice_husk',
    label: 'Rice husk',
    kind: 'agro_processing',
    moisturePct: 9,
    ashPct: 21.5, // ~90% amorphous silica
    carbonPct: 38.5,
    hydrogenPct: 5.0,
    nitrogenPct: 0.48,
    ligninPct: 20.0,
    cnRatio: 80,
    lhvMjPerKg: 13.9,
    bulkDensityTPerM3: 0.11,
    vsFraction: 0.78,
    bmpM3PerTVs: 110,
    counterfactual: 'open_dumping',
    aggregationCostInrPerT: 300, // already concentrated at the mill gate
    gatePriceInrPerT: 1800, // already a traded boiler fuel — an existing market to beat
    notes:
      'Already concentrated at rice mills and already traded as boiler fuel, so the network must outbid an existing buyer. Its biochar is silica-rich and lower in carbon.',
  },
  press_mud: {
    id: 'press_mud',
    label: 'Sugar mill press mud',
    kind: 'agro_processing',
    moisturePct: 70,
    ashPct: 12.0,
    carbonPct: 32.5,
    hydrogenPct: 4.5,
    nitrogenPct: 1.8,
    cnRatio: 18,
    ligninPct: 9.5,
    lhvMjPerKg: 12.1,
    bulkDensityTPerM3: 0.62,
    vsFraction: 0.82,
    bmpM3PerTVs: 290,
    counterfactual: 'open_dumping',
    aggregationCostInrPerT: 250,
    gatePriceInrPerT: 200,
    notes:
      'The backbone feedstock of India’s SATAT compressed-biogas programme. Wet, dense, seasonal with the crushing season, and far too wet to pyrolyse.',
  },
  cattle_dung: {
    id: 'cattle_dung',
    label: 'Cattle dung',
    kind: 'dairy',
    moisturePct: 80,
    ashPct: 16.0,
    carbonPct: 37.8,
    hydrogenPct: 5.0,
    nitrogenPct: 1.5,
    cnRatio: 25,
    ligninPct: 12.0,
    lhvMjPerKg: 13.0,
    bulkDensityTPerM3: 0.85,
    vsFraction: 0.8,
    bmpM3PerTVs: 210,
    counterfactual: 'open_dung_heap',
    aggregationCostInrPerT: 400,
    gatePriceInrPerT: 300,
    notes:
      'Dense and wet: mass-limited rather than volume-limited in transport, the opposite of straw. Avoided open-heap methane is modest per tonne but the volumes are very large.',
  },
  poultry_litter: {
    id: 'poultry_litter',
    label: 'Poultry litter',
    kind: 'dairy',
    moisturePct: 30,
    ashPct: 20.0,
    carbonPct: 35.0,
    hydrogenPct: 4.8,
    nitrogenPct: 4.0,
    cnRatio: 9, // ammonia inhibition risk in mono-digestion
    ligninPct: 11.0,
    lhvMjPerKg: 12.8,
    bulkDensityTPerM3: 0.55,
    vsFraction: 0.75,
    bmpM3PerTVs: 255,
    counterfactual: 'open_dumping',
    aggregationCostInrPerT: 350,
    gatePriceInrPerT: 400,
    notes:
      'Nitrogen-rich. Its C:N of 9 sits below the stable window for mono-digestion, so the pathway gate in pathways.ts rejects it for AD unless co-digested.',
  },
  mandi_waste: {
    id: 'mandi_waste',
    label: 'Mandi / vegetable market waste',
    kind: 'market',
    moisturePct: 82,
    ashPct: 10.0,
    carbonPct: 42.0,
    hydrogenPct: 6.0,
    nitrogenPct: 2.5,
    cnRatio: 17,
    ligninPct: 7.0,
    lhvMjPerKg: 15.0,
    bulkDensityTPerM3: 0.55,
    vsFraction: 0.86,
    bmpM3PerTVs: 400, // highly digestible
    counterfactual: 'unmanaged_landfill',
    aggregationCostInrPerT: 500,
    gatePriceInrPerT: 0, // a disposal liability, not a commodity
    notes:
      'Highest methane potential in the network and effectively free at the gate, because today it is a disposal liability for the market committee.',
  },
  msw_organic: {
    id: 'msw_organic',
    label: 'Segregated municipal organics',
    kind: 'municipal',
    moisturePct: 65,
    ashPct: 18.0,
    carbonPct: 40.0,
    hydrogenPct: 5.5,
    nitrogenPct: 2.2,
    cnRatio: 20,
    ligninPct: 10.0,
    lhvMjPerKg: 14.2,
    bulkDensityTPerM3: 0.5,
    vsFraction: 0.78,
    bmpM3PerTVs: 330,
    counterfactual: 'unmanaged_landfill',
    aggregationCostInrPerT: 450,
    gatePriceInrPerT: -400, // the ULB pays a tipping fee to have it taken away
    notes:
      'Carries a negative gate price: the urban local body pays a tipping fee. Combined with an unmanaged-landfill counterfactual worth ~1 tCO₂e/t, it is the highest-value avoided-emission feedstock in the network.',
  },
};

export const STREAM_IDS = Object.keys(STREAMS) as StreamId[];

// ─────────────────────────────────────────────────────────────────────────────
// Counterfactual emission factors
// ─────────────────────────────────────────────────────────────────────────────

export interface CounterfactualFactor {
  id: Counterfactual;
  label: string;
  /** tCO2e avoided per tonne of *dry matter* diverted (non-CO2 GHG only) */
  tco2ePerTDry: number;
  /** relative 1-sigma uncertainty */
  uncertaintyPct: number;
  /** PM2.5 avoided, kg per tonne of dry matter — a health co-benefit, NOT CO2e */
  pm25KgPerTDry: number;
  basis: string;
  source: string;
}

/**
 * Note on what is and is not counted.
 *
 * Biogenic CO2 released by burning or composting residue is NOT counted: the carbon
 * was taken out of the atmosphere in the same growing season and returns to it. Only
 * the non-CO2 greenhouse gases (CH4, N2O) represent a genuine atmospheric addition.
 *
 * This is why avoided-burning credit is ~0.07 tCO2e per tonne and not the ~1 tCO2e
 * per tonne frequently claimed for stubble diversion. Getting this right costs us a
 * big headline number and buys a defensible one.
 */
export const COUNTERFACTUALS: Record<Counterfactual, CounterfactualFactor> = {
  open_field_burning: {
    id: 'open_field_burning',
    label: 'Open in-field burning',
    // CH4 2.7 g/kg dm and N2O 0.07 g/kg dm at a combustion factor of 0.89,
    // valued at AR6 GWP100 (CH4 non-fossil 27.2, N2O 273).
    tco2ePerTDry: 0.0824,
    uncertaintyPct: 35,
    pm25KgPerTDry: 7.4,
    basis:
      'CH₄ 2.7 g/kg DM + N₂O 0.07 g/kg DM, combustion factor 0.89, AR6 GWP₁₀₀. Biogenic CO₂ excluded.',
    source: 'IPCC 2006 GL Vol.4 Ch.2 Tables 2.5/2.6; IPCC AR6 WG1 Ch.7 GWP values',
  },
  open_dung_heap: {
    id: 'open_dung_heap',
    label: 'Uncovered solid-storage dung heap',
    // VS-based: B0 0.13 m3 CH4/kg VS, MCF 5% (warm climate solid storage),
    // plus direct N2O at EF3 = 0.005 kg N2O-N/kg N.
    tco2ePerTDry: 0.175,
    uncertaintyPct: 45,
    pm25KgPerTDry: 0,
    basis:
      'B₀ 0.13 m³ CH₄/kg VS × MCF 5% (warm-climate solid storage) + direct N₂O at EF₃ 0.005 kg N₂O-N/kg N.',
    source: 'IPCC 2006 GL Vol.4 Ch.10 (Manure Management), 2019 Refinement',
  },
  unmanaged_landfill: {
    id: 'unmanaged_landfill',
    label: 'Unmanaged deep landfill',
    // First-order decay, integrated: DOC_f 0.5, MCF 0.8, F 0.5, no gas capture,
    // no oxidation layer. Expressed per tonne of dry matter.
    tco2ePerTDry: 3.1,
    uncertaintyPct: 40,
    pm25KgPerTDry: 0,
    basis:
      'IPCC first-order decay, DOCₑ 0.5, MCF 0.8 (unmanaged deep), F 0.5, no capture, no oxidation. Emitted over decades; credited at diversion per standard practice.',
    source: 'IPCC 2006 GL Vol.5 Ch.3 (Solid Waste Disposal)',
  },
  open_dumping: {
    id: 'open_dumping',
    label: 'Open dumping / uncontrolled heap',
    tco2ePerTDry: 1.05,
    uncertaintyPct: 50,
    pm25KgPerTDry: 0,
    basis:
      'IPCC first-order decay with MCF 0.4 for shallow uncontrolled disposal; substantially aerobic, so far below deep landfill.',
    source: 'IPCC 2006 GL Vol.5 Ch.3, MCF for uncategorised shallow sites',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Derived feedstock quantities
// ─────────────────────────────────────────────────────────────────────────────

export function dryFraction(s: StreamProps): number {
  return 1 - s.moisturePct / 100;
}

/** Tonnes of volatile solids per tonne of as-received feedstock. */
export function vsPerWetTonne(s: StreamProps): number {
  return dryFraction(s) * s.vsFraction;
}

/**
 * Biochar mass yield as a fraction of dry feedstock, for slow pyrolysis at ~550 degC.
 *
 * Char yield rises with lignin (the aromatic fraction that survives) and with ash
 * (which is inert and reports entirely to the char). The linear form below is a
 * regression over published slow-pyrolysis yields for agricultural residues; it is
 * intentionally simple and intentionally visible, so a reviewer can argue with it.
 */
export function biocharYieldDry(s: StreamProps): number {
  return 0.2 + 0.0055 * s.ligninPct + 0.0045 * s.ashPct;
}

/** Fraction of feedstock carbon retained in the char at ~550 degC slow pyrolysis. */
export const CARBON_RETENTION_IN_CHAR = 0.5;

/**
 * Carbon content of the resulting biochar, % of char mass.
 * Derived, not assumed: high-ash feedstocks such as rice husk necessarily produce a
 * lower-carbon char because the silica dilutes it.
 */
export function biocharCarbonPct(s: StreamProps): number {
  const yieldDry = biocharYieldDry(s);
  if (yieldDry <= 0) return 0;
  return Math.min(92, (s.carbonPct * CARBON_RETENTION_IN_CHAR) / yieldDry);
}

/**
 * Molar H/C(org) ratio of the biochar — the property both the European Biochar
 * Certificate and the Puro Standard use to gate durability (< 0.7 required).
 *
 * Hydrogen is preferentially driven off during pyrolysis; residual H scales with the
 * feedstock's original H:C and falls with lignin aromaticity.
 */
export function biocharHcOrg(s: StreamProps): number {
  const feedHc = (s.hydrogenPct / 1.008) / (s.carbonPct / 12.011);
  const aromatisation = 0.19 - 0.0022 * s.ligninPct;
  return Math.max(0.18, Math.min(0.68, feedHc * aromatisation));
}

/** Cubic metres occupied by one tonne as handled — drives truck volume limits. */
export function m3PerTonne(s: StreamProps): number {
  return 1 / s.bulkDensityTPerM3;
}
