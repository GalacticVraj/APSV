/**
 * Emission factors, prices and default assumptions.
 *
 * Everything a carbon or economics number depends on lives here, each with a
 * source string and a relative uncertainty. The UI reads these directly, so the
 * assumptions page is generated from the same objects the maths uses — it cannot
 * drift out of date relative to the model.
 */

import type { Assumptions, ProductId, VehicleType } from './types.ts';

export interface Factor {
  key: string;
  label: string;
  value: number;
  unit: string;
  /** relative 1-sigma, used by the Monte Carlo */
  uncertaintyPct: number;
  source: string;
  note?: string;
}

const f = (
  key: string,
  label: string,
  value: number,
  unit: string,
  uncertaintyPct: number,
  source: string,
  note?: string,
): Factor => ({ key, label, value, unit, uncertaintyPct, source, note });

// ─────────────────────────────────────────────────────────────────────────────
// Emission factors
// ─────────────────────────────────────────────────────────────────────────────

export const EF = {
  dieselCombustion: f(
    'dieselCombustion',
    'Diesel combustion',
    2.68,
    'kgCO₂e/litre',
    5,
    'DEFRA GHG Conversion Factors 2023 — diesel, 100% mineral, tank-to-wheel',
  ),
  dieselUpstream: f(
    'dieselUpstream',
    'Diesel well-to-tank',
    0.61,
    'kgCO₂e/litre',
    18,
    'DEFRA GHG Conversion Factors 2023 — WTT diesel',
    'Included so transport emissions are well-to-wheel, not tailpipe-only.',
  ),
  gridElectricity: f(
    'gridElectricity',
    'Indian grid electricity',
    0.716,
    'tCO₂e/MWh',
    8,
    'CEA CO₂ Baseline Database for the Indian Power Sector, weighted average operating margin',
  ),
  coal: f(
    'coal',
    'Indian thermal coal',
    96.1,
    'tCO₂/TJ',
    7,
    'IPCC 2006 GL Vol.2 Table 1.4 — sub-bituminous default',
  ),
  cngDisplaced: f(
    'cngDisplaced',
    'Fossil CNG displaced by bio-CNG',
    2.75,
    'kgCO₂e/kg CNG',
    9,
    'IPCC 2006 GL Vol.2 natural gas EF plus Indian upstream/compression',
  ),
  syntheticFertiliserN: f(
    'syntheticFertiliserN',
    'Synthetic nitrogen fertiliser displaced',
    5.6,
    'kgCO₂e/kg N',
    30,
    'IPCC 2006 GL Vol.4 Ch.11 direct/indirect N₂O plus urea manufacturing',
  ),
  ch4Gwp: f(
    'ch4Gwp',
    'CH₄ global warming potential (non-fossil, 100 yr)',
    27.2,
    'kgCO₂e/kg',
    0,
    'IPCC AR6 WG1 Ch.7 Table 7.15',
  ),
  n2oGwp: f(
    'n2oGwp',
    'N₂O global warming potential (100 yr)',
    273,
    'kgCO₂e/kg',
    0,
    'IPCC AR6 WG1 Ch.7 Table 7.15',
  ),
  baling: f(
    'baling',
    'Field aggregation (rake, bale, load)',
    3.9,
    'kgCO₂e/tonne',
    25,
    'Tractor diesel burn of ~1.45 L/t for straw baling at DEFRA diesel EF',
  ),
} as const;

export const EF_LIST: Factor[] = Object.values(EF);

/** Well-to-wheel diesel factor, kgCO2e per litre. */
export const DIESEL_WTW_KG_PER_L = EF.dieselCombustion.value + EF.dieselUpstream.value;

// ─────────────────────────────────────────────────────────────────────────────
// Product prices (INR)
// ─────────────────────────────────────────────────────────────────────────────

export interface PriceDef {
  product: ProductId;
  label: string;
  /** INR per unit */
  price: number;
  unit: string;
  perTonneBasis: string;
  uncertaintyPct: number;
  source: string;
}

export const PRICES: Record<ProductId, PriceDef> = {
  biochar: {
    product: 'biochar',
    label: 'Agricultural-grade biochar',
    price: 16000,
    unit: '₹/tonne',
    perTonneBasis: 'tonne of biochar',
    uncertaintyPct: 25,
    source: 'Indian agri-input biochar offtake range ₹14,000–25,000/t; conservative end used',
  },
  bio_cng: {
    product: 'bio_cng',
    label: 'Compressed bio-gas',
    price: 54,
    unit: '₹/kg',
    perTonneBasis: 'kg of CBG',
    uncertaintyPct: 8,
    source: 'MoPNG SATAT programme assured ex-plant price, ₹54/kg',
  },
  pellets: {
    product: 'pellets',
    label: 'Biomass pellets',
    price: 7000,
    unit: '₹/tonne',
    perTonneBasis: 'tonne of pellets',
    uncertaintyPct: 15,
    source: 'Thermal-plant biomass co-firing tender range ₹6,500–8,500/t',
  },
  compost: {
    product: 'compost',
    label: 'City compost / FOM',
    price: 4000,
    unit: '₹/tonne',
    perTonneBasis: 'tonne of compost',
    uncertaintyPct: 20,
    source: 'City-compost MRP net of market development assistance',
  },
  electricity: {
    product: 'electricity',
    label: 'Biomass power',
    price: 5.5,
    unit: '₹/kWh',
    perTonneBasis: 'kWh exported',
    uncertaintyPct: 12,
    source: 'CERC biomass generic tariff band',
  },
  digestate: {
    product: 'digestate',
    label: 'Fermented organic manure',
    price: 2500,
    unit: '₹/tonne',
    perTonneBasis: 'tonne of digestate',
    uncertaintyPct: 30,
    source: 'FOM realisation under the SATAT/GOBARdhan framework',
  },
};

export const PRICE_LIST = Object.values(PRICES);

// ─────────────────────────────────────────────────────────────────────────────
// Carbon markets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The two carbon products this network creates are NOT the same commodity and do
 * not clear at the same price. Durable removal (biochar CDR) trades roughly twenty
 * times higher than an avoided-emission credit. Conflating them is the most common
 * error in waste-to-carbon business cases, and the price gap is what makes the
 * Carbon First and Profit First optimisation modes diverge.
 */
export const CARBON_MARKETS = {
  durableCdr: {
    key: 'durableCdr',
    label: 'Durable CO₂ removal (biochar CORC)',
    price: 10800,
    unit: '₹/tCO₂e',
    uncertaintyPct: 22,
    source: 'Puro.earth biochar CORC clearing range, ~USD 130/t at ₹83/USD',
  },
  avoidedEmission: {
    key: 'avoidedEmission',
    label: 'Avoided emissions (voluntary market)',
    price: 520,
    unit: '₹/tCO₂e',
    uncertaintyPct: 45,
    source: 'Voluntary carbon market waste-sector avoidance credits, ~USD 6/t',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Economic Models & Baselines
// ─────────────────────────────────────────────────────────────────────────────

export const ECONOMIC_BASELINES = {
  /**
   * Societal Shadow Price of Carbon (SPC).
   * Used for public-economics evaluation, independent of market clearing prices.
   * Source: World Bank High-Level Commission on Carbon Prices (~$80/tCO2e at ₹83/USD).
   */
  shadowPriceCarbonInrPerT: 6640,
  
  /**
   * Average municipal landfill tipping fee + avoided environmental cost.
   * Serves as the Life Cycle Costing (LCC) baseline for MSW and mandi waste.
   */
  landfillTippingFeeInrPerT: 1500,
  
  /**
   * Standard Weighted Average Cost of Capital (WACC) for emerging market
   * infrastructure. Used as the discount rate for DCF and LCOP calculations.
   */
  discountRateWacc: 0.10,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Fleet
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Payload is min(mass capacity, deck volume x feedstock bulk density).
 *
 * For baled paddy straw at 0.15 t/m3, the 16-tonne truck below carries
 * 58 m3 x 0.15 = 8.7 t, not 16 t. Its cost and emissions per tonne are therefore
 * nearly double what a mass-only model would report. This constraint binds on every
 * crop-residue arc in the network and is the main reason haul distances are short.
 */
export const VEHICLES: VehicleType[] = [
  {
    id: 'tractor_trolley',
    label: 'Tractor + trolley',
    massCapacityT: 6,
    volumeM3: 22,
    dieselLPerKm: 0.19,
    costInrPerKm: 28,
    fixedCostInrPerTrip: 450,
    avgSpeedKmh: 22,
    shiftHours: 9,
    fleetSize: 120,
    allowedRoads: ['rural_road', 'state_highway', 'national_highway'],
  },
  {
    id: 'truck_16t',
    label: '16 t rigid truck',
    massCapacityT: 16,
    volumeM3: 58,
    dieselLPerKm: 0.28,
    costInrPerKm: 46,
    fixedCostInrPerTrip: 1400,
    avgSpeedKmh: 42,
    shiftHours: 11,
    fleetSize: 64,
    allowedRoads: ['state_highway', 'national_highway'],
  },
  {
    id: 'truck_25t_bulk',
    label: '25 t bulk trailer',
    massCapacityT: 25,
    volumeM3: 92,
    dieselLPerKm: 0.36,
    costInrPerKm: 62,
    fixedCostInrPerTrip: 2200,
    avgSpeedKmh: 46,
    shiftHours: 11,
    fleetSize: 28,
    allowedRoads: ['national_highway'],
  },
];

export const VEHICLE_BY_ID: Record<string, VehicleType> = Object.fromEntries(
  VEHICLES.map((v) => [v.id, v]),
);

// ─────────────────────────────────────────────────────────────────────────────
// Default assumptions
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  windowDays: 30,
  circuityFactor: 1.28,
  dieselPriceInrPerL: 92,
  cdrPriceInrPerT: CARBON_MARKETS.durableCdr.price,
  vcmPriceInrPerT: CARBON_MARKETS.avoidedEmission.price,
  gridEfTPerMwh: EF.gridElectricity.value,
  // Mean annual soil temperature for the Indo-Gangetic plain. The Puro/SLU
  // reference dataset is harmonised to 14.9 degC; using that European default here
  // would overstate biochar permanence.
  soilTempC: 26.0,
  maxHaulKm: 140,
  mcDraws: 2000,
  seed: 20260912,
};

export const ASSUMPTION_META: Record<
  keyof Assumptions,
  { label: string; unit: string; min: number; max: number; step: number; note: string }
> = {
  windowDays: {
    label: 'Planning window',
    unit: 'days',
    min: 7,
    max: 90,
    step: 1,
    note: 'Length of the operating period the optimiser allocates over.',
  },
  circuityFactor: {
    label: 'Road circuity factor',
    unit: '× crow-fly',
    min: 1.0,
    max: 1.6,
    step: 0.01,
    note: 'Road distance divided by great-circle distance. 1.28 is typical for Indian NH/SH inter-district pairs.',
  },
  dieselPriceInrPerL: {
    label: 'Diesel price',
    unit: '₹/litre',
    min: 60,
    max: 160,
    step: 1,
    note: 'Drives transport cost but not transport emissions.',
  },
  cdrPriceInrPerT: {
    label: 'Durable CDR price',
    unit: '₹/tCO₂e',
    min: 0,
    max: 25000,
    step: 100,
    note: 'Price for permanent removal. Only the pyrolysis and gasification pathways earn it.',
  },
  vcmPriceInrPerT: {
    label: 'Avoided-emission price',
    unit: '₹/tCO₂e',
    min: 0,
    max: 5000,
    step: 20,
    note: 'Voluntary market price for avoidance credits. Roughly twenty times below removal.',
  },
  gridEfTPerMwh: {
    label: 'Grid emission factor',
    unit: 'tCO₂e/MWh',
    min: 0.2,
    max: 1.1,
    step: 0.01,
    note: 'Applies to parasitic load and to displaced grid power.',
  },
  soilTempC: {
    label: 'Mean annual soil temperature',
    unit: '°C',
    min: 5,
    max: 35,
    step: 0.5,
    note: 'Drives the Q10 correction on biochar decay. Raising it lowers 100-year permanence.',
  },
  maxHaulKm: {
    label: 'Maximum haul distance',
    unit: 'km',
    min: 20,
    max: 400,
    step: 5,
    note: 'Hard cut-off beyond which an arc is never generated.',
  },
  mcDraws: {
    label: 'Monte Carlo draws',
    unit: 'samples',
    min: 200,
    max: 20000,
    step: 100,
    note: 'Sample count for the carbon uncertainty band.',
  },
  seed: {
    label: 'Random seed',
    unit: '',
    min: 1,
    max: 999999999,
    step: 1,
    note: 'Every stochastic element derives from this. Same seed, identical results.',
  },
};

/** Objective mode presentation metadata. */
export const OBJECTIVE_META = {
  carbon_first: {
    label: 'Carbon First',
    short: 'CARBON',
    description:
      'Maximise net tCO₂e. Accepts thin or negative margins where the carbon case is strong.',
  },
  profit_first: {
    label: 'Profit First',
    short: 'PROFIT',
    description:
      'Maximise operating margin. Drops carbon-positive but loss-making tonnage.',
  },
  balanced: {
    label: 'Balanced',
    short: 'BALANCED',
    description:
      'Scalarised trade-off between normalised carbon and normalised margin, with a diversion floor.',
  },
  logistics_first: {
    label: 'Logistics First',
    short: 'LOGISTICS',
    description:
      'Maximise carbon per tonne-kilometre. Favours short, dense, operationally simple hauls.',
  },
} as const;
