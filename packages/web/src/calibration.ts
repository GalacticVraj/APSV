/**
 * This model, held against published work.
 *
 * A carbon number is only as defensible as the constants behind it, and the
 * Evidence screen already says where each of ours came from. What it could not
 * say is whether we actually land where the literature lands. This module
 * answers that, by holding the engine's own values against a compiled reference
 * dataset of real, cited figures.
 *
 * Three rules:
 *
 *  1. **Nothing is changed to make the comparison flattering.** This reads the
 *     engine; it never writes to it. Where we sit outside a published band, the
 *     row says so. A calibration table that always says "agrees" is decoration.
 *  2. **The engine is the source of our side.** `permanenceFor` is called, not
 *     transcribed, so this cannot drift when the model changes.
 *  3. **Every row carries a link a reviewer can open.** An uncited comparison
 *     is just two numbers next to each other.
 *
 * The reference dataset is a compilation, not a primary source. It is right to
 * treat a disagreement here as "worth investigating", not as proof of an error
 * on either side — which is what `verdict: 'differs'` is for.
 */

import { permanenceFor } from '../../engine/src/carbon.ts';
import { EF, CARBON_MARKETS, ECONOMIC_BASELINES, DEFAULT_ASSUMPTIONS } from '../../engine/src/constants.ts';
import ref from './data/reference.json';

export type Verdict = 'agrees' | 'within' | 'differs' | 'method';

export interface CalibrationRow {
  key: string;
  parameter: string;
  /** what this model uses */
  ours: string;
  /** what the cited reference reports */
  published: string;
  verdict: Verdict;
  /** why the verdict is what it is, in one sentence */
  note: string;
  source: string;
}

export interface RealFacility {
  name: string;
  district: string;
  type: string;
  capacity: string;
  note: string;
  source: string;
}

const R = ref as unknown as {
  meta: { description: string; last_compiled: string };
  emission_factors: { ipcc_ar6_gwp100: { ch4_biogenic: number; source: string; notes: string } };
  biochar_permanence_model: {
    formula: string;
    reference_soil_temp_c: number;
    fperm_range_at_reference_temp: [number, number];
    hc_ratio_permanence_threshold: number;
    q10_correction: { q10_value: number; example_india_soil_temp_c: number };
    source: string;
  };
  economics: {
    carbon_price_inr_per_tonne_co2e: {
      ccts_early_2026_trading_price_approx: [number, number];
      recommended_default_for_macc_calculations: number;
      source: string;
      notes: string;
    };
    landfill_and_msw_cost_inr_per_tonne: {
      general_urban_local_body_range: [number, number];
      source: string;
    };
  };
  facilities: Array<{
    name: string;
    type: string;
    feedstock: string;
    district: string;
    capacity_t_cbg_per_day?: number;
    capacity_t_per_day?: number;
    notes: string;
    source: string;
  }>;
  state_level_context: {
    punjab_cbg_projects_allotted: number;
    punjab_cbg_total_capacity_t_per_day: number;
    punjab_annual_paddy_straw_consumption_projected_t: number;
    source: string;
  };
};

/** The char streams this model produces biochar from. */
const CHAR_STREAMS = ['paddy_straw', 'wheat_straw', 'cotton_stalk', 'rice_husk'] as const;

export function referenceMeta() {
  return { compiled: R.meta.last_compiled, description: R.meta.description };
}

export function buildCalibration(): CalibrationRow[] {
  const perm = R.biochar_permanence_model;
  const [lo, hi] = perm.fperm_range_at_reference_temp;

  // Our permanence at the SAME temperature the published band is quoted at.
  // Comparing our 26 °C figure against a 14.9 °C band would be the easy,
  // flattering mistake: warmer soil decays char faster, so it would drag our
  // number down into the band for the wrong reason.
  const atRef = CHAR_STREAMS.map((s) => permanenceFor(s, perm.reference_soil_temp_c).bc100);
  const refLo = Math.min(...atRef);
  const refHi = Math.max(...atRef);
  const inBand = refLo >= lo && refHi <= hi;

  const hcs = CHAR_STREAMS.map((s) => permanenceFor(s, DEFAULT_ASSUMPTIONS.soilTempC).hcOrgRatio);
  const ourQ10 = permanenceFor('paddy_straw', perm.q10_correction.example_india_soil_temp_c).q10;

  const price = R.economics.carbon_price_inr_per_tonne_co2e;
  const [cctsLo, cctsHi] = price.ccts_early_2026_trading_price_approx;
  const vcm = CARBON_MARKETS.avoidedEmission.price;

  const [tipLo, tipHi] = R.economics.landfill_and_msw_cost_inr_per_tonne.general_urban_local_body_range;
  const tip = ECONOMIC_BASELINES.landfillTippingFeeInrPerT;

  return [
    {
      key: 'ch4',
      parameter: 'CH₄ global warming potential, 100 yr, non-fossil',
      ours: `${EF.ch4Gwp.value} kgCO₂e/kg`,
      published: `${R.emission_factors.ipcc_ar6_gwp100.ch4_biogenic} kgCO₂e/kg`,
      verdict: 'agrees',
      note: 'Same IPCC AR6 figure; the reference rounds to two significant figures where this model carries the tabulated 27.2.',
      source: R.emission_factors.ipcc_ar6_gwp100.source,
    },
    {
      key: 'perm-model',
      parameter: 'Biochar permanence model form',
      ours: 'Two-pool first-order decay, parameterised by H/C(org)',
      published: perm.formula,
      verdict: 'method',
      note: 'Different model forms answering the same question. The published linear Fperm is a single-step estimate; this model integrates a two-pool decay to 100 years, so the two are not expected to return identical numbers.',
      source: perm.source,
    },
    {
      key: 'bc100',
      parameter: `BC₁₀₀ at the reference soil temperature (${perm.reference_soil_temp_c} °C)`,
      ours: `${(refLo * 100).toFixed(1)}–${(refHi * 100).toFixed(1)}%`,
      published: `${(lo * 100).toFixed(0)}–${(hi * 100).toFixed(0)}%`,
      verdict: inBand ? 'within' : 'differs',
      note: inBand
        ? 'This model sits inside the published range.'
        : 'This model sits above the published range. Its chars are more aromatic than the range midpoint, and the two-pool form retains more at 100 years than the single-step estimate. Worth investigating before any figure here is presented as conservative.',
      source: perm.source,
    },
    {
      key: 'hc',
      parameter: 'H/C(org) of the modelled char',
      ours: `${Math.min(...hcs).toFixed(2)}–${Math.max(...hcs).toFixed(2)}`,
      published: `durability threshold ${perm.hc_ratio_permanence_threshold}`,
      verdict: 'within',
      note: 'Lower is more stable. This model’s chars sit well below the threshold, which is consistent with slow pyrolysis and with the < 0.7 gate the EBC and Puro standards apply.',
      source: perm.source,
    },
    {
      key: 'q10',
      parameter: 'Q10 temperature correction',
      ours: `continuous, ${ourQ10.toFixed(2)} at ${perm.reference_soil_temp_c} → ${perm.q10_correction.example_india_soil_temp_c} °C`,
      published: `constant ${perm.q10_correction.q10_value}`,
      verdict: 'method',
      note: 'The reference uses the simplified constant Q10; this model uses the temperature-dependent relation from the same paper, which gives a smaller correction over this interval.',
      source: perm.source,
    },
    {
      key: 'carbon-price',
      parameter: 'Avoided-emission carbon price',
      ours: `₹${vcm.toLocaleString('en-IN')}/tCO₂e`,
      published: `₹${cctsLo}–${cctsHi}/tCO₂e (CCTS, early 2026)`,
      verdict: vcm >= cctsLo && vcm <= cctsHi ? 'within' : 'differs',
      note: `This model prices avoided emissions well below India's compliance market. That is deliberately conservative for carbon revenue, but it means the economics screens understate what these tonnes might fetch. The reference recommends ₹${price.recommended_default_for_macc_calculations} for abatement-cost work.`,
      source: price.source,
    },
    {
      key: 'tipping',
      parameter: 'Landfill / tipping cost baseline',
      ours: `₹${tip.toLocaleString('en-IN')}/t`,
      published: `₹${tipLo}–${tipHi}/t (urban local bodies)`,
      verdict: tip >= tipLo && tip <= tipHi ? 'within' : 'differs',
      note: 'At the top of the published range for general urban local bodies; metro all-in disposal costs are reported higher still.',
      source: R.economics.landfill_and_msw_cost_inr_per_tonne.source,
    },
  ];
}

/**
 * Real plants of these archetypes, operating in this region.
 *
 * The network in this product is synthetic. These are not — they are cited,
 * named facilities in the same districts running the same conversion routes,
 * which is the difference between "this could exist" and "this does".
 */
export function realFacilities(): RealFacility[] {
  return R.facilities.map((f) => ({
    name: f.name,
    district: f.district,
    type: f.type.replace(/_/g, ' '),
    capacity:
      f.capacity_t_cbg_per_day != null
        ? `${f.capacity_t_cbg_per_day} t CBG/day`
        : f.capacity_t_per_day != null
          ? `${f.capacity_t_per_day} t/day`
          : '—',
    note: f.notes,
    source: f.source,
  }));
}

export function stateContext() {
  const s = R.state_level_context;
  return {
    projects: s.punjab_cbg_projects_allotted,
    capacityTpd: s.punjab_cbg_total_capacity_t_per_day,
    annualStrawT: s.punjab_annual_paddy_straw_consumption_projected_t,
    source: s.source,
  };
}
