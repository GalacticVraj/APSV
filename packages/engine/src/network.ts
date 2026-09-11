/**
 * The seeded network: Punjab, Haryana and Chandigarh.
 *
 * This corridor is chosen deliberately. It is where India's most visible residue
 * problem lives — roughly 20 Mt of paddy straw a year in Punjab alone, with a
 * ~20-day window between the paddy harvest and wheat sowing, which is why burning
 * happens at all. It also contains every other feedstock class we want to model:
 * dairy at scale, rice mills, co-operative sugar mills, and urban organics.
 *
 * All entity names, volumes and capacities are SYNTHETIC and labelled as such in
 * the UI. District coordinates are real. No claim is made about any real company.
 */

import type {
  Facility,
  NetworkState,
  PathwayId,
  RoadClass,
  SourceKind,
  StreamId,
  WasteSource,
} from './types.ts';
import { DEFAULT_ASSUMPTIONS, VEHICLES } from './constants.ts';
import { hashString, makeRng } from './rng.ts';

interface District {
  name: string;
  state: 'Punjab' | 'Haryana' | 'Chandigarh';
  lat: number;
  lon: number;
}

/** Real district headquarters coordinates. */
export const DISTRICTS: District[] = [
  { name: 'Ludhiana', state: 'Punjab', lat: 30.901, lon: 75.857 },
  { name: 'Sangrur', state: 'Punjab', lat: 30.245, lon: 75.842 },
  { name: 'Patiala', state: 'Punjab', lat: 30.34, lon: 76.386 },
  { name: 'Bathinda', state: 'Punjab', lat: 30.211, lon: 74.945 },
  { name: 'Moga', state: 'Punjab', lat: 30.817, lon: 75.171 },
  { name: 'Barnala', state: 'Punjab', lat: 30.374, lon: 75.546 },
  { name: 'Firozpur', state: 'Punjab', lat: 30.925, lon: 74.613 },
  { name: 'Sri Muktsar Sahib', state: 'Punjab', lat: 30.474, lon: 74.516 },
  { name: 'Faridkot', state: 'Punjab', lat: 30.676, lon: 74.755 },
  { name: 'Jalandhar', state: 'Punjab', lat: 31.326, lon: 75.576 },
  { name: 'Kapurthala', state: 'Punjab', lat: 31.38, lon: 75.384 },
  { name: 'Amritsar', state: 'Punjab', lat: 31.634, lon: 74.872 },
  { name: 'Tarn Taran', state: 'Punjab', lat: 31.452, lon: 74.927 },
  { name: 'Hoshiarpur', state: 'Punjab', lat: 31.532, lon: 75.912 },
  { name: 'Fatehgarh Sahib', state: 'Punjab', lat: 30.644, lon: 76.396 },
  { name: 'Mansa', state: 'Punjab', lat: 29.988, lon: 75.393 },
  { name: 'Rupnagar', state: 'Punjab', lat: 30.966, lon: 76.527 },
  { name: 'Karnal', state: 'Haryana', lat: 29.686, lon: 76.99 },
  { name: 'Kaithal', state: 'Haryana', lat: 29.801, lon: 76.399 },
  { name: 'Kurukshetra', state: 'Haryana', lat: 29.97, lon: 76.878 },
  { name: 'Ambala', state: 'Haryana', lat: 30.378, lon: 76.777 },
  { name: 'Yamunanagar', state: 'Haryana', lat: 30.129, lon: 77.288 },
  { name: 'Hisar', state: 'Haryana', lat: 29.153, lon: 75.722 },
  { name: 'Sirsa', state: 'Haryana', lat: 29.535, lon: 75.028 },
  { name: 'Fatehabad', state: 'Haryana', lat: 29.512, lon: 75.456 },
  { name: 'Jind', state: 'Haryana', lat: 29.317, lon: 76.315 },
  { name: 'Panipat', state: 'Haryana', lat: 29.391, lon: 76.977 },
  { name: 'Chandigarh', state: 'Chandigarh', lat: 30.741, lon: 76.778 },
];

const DISTRICT_BY_NAME = new Map(DISTRICTS.map((d) => [d.name, d]));

// ─────────────────────────────────────────────────────────────────────────────
// Sources
// ─────────────────────────────────────────────────────────────────────────────

interface SourceSeed {
  id: string;
  name: string;
  district: string;
  stream: StreamId;
  kind: SourceKind;
  /** tonnes available in a 30-day window */
  availableT: number;
  access: RoadClass;
  clusterCount: number;
}

/**
 * 42 sources. Volumes are sized so that the network is *tight but feasible*:
 * total supply modestly exceeds total compatible processing capacity, which is
 * what makes allocation a real decision rather than a formality.
 */
const SOURCE_SEEDS: SourceSeed[] = [
  // ── Paddy straw: the main event, 13 aggregation clusters ──────────────────
  { id: 'SRC-PB-01', name: 'Dhuri CHC Straw Yard', district: 'Sangrur', stream: 'paddy_straw', kind: 'crop_residue', availableT: 3100, access: 'state_highway', clusterCount: 14 },
  { id: 'SRC-PB-02', name: 'Lehragaga FPO Baling Point', district: 'Sangrur', stream: 'paddy_straw', kind: 'crop_residue', availableT: 2450, access: 'rural_road', clusterCount: 11 },
  { id: 'SRC-PB-03', name: 'Jagraon Grain Belt Cluster', district: 'Ludhiana', stream: 'paddy_straw', kind: 'crop_residue', availableT: 2800, access: 'national_highway', clusterCount: 16 },
  { id: 'SRC-PB-04', name: 'Raikot Custom Hiring Centre', district: 'Ludhiana', stream: 'paddy_straw', kind: 'crop_residue', availableT: 1900, access: 'state_highway', clusterCount: 9 },
  { id: 'SRC-PB-05', name: 'Nabha Co-op Baling Yard', district: 'Patiala', stream: 'paddy_straw', kind: 'crop_residue', availableT: 2050, access: 'state_highway', clusterCount: 10 },
  { id: 'SRC-PB-06', name: 'Rajpura Roadside Aggregation', district: 'Patiala', stream: 'paddy_straw', kind: 'crop_residue', availableT: 1600, access: 'national_highway', clusterCount: 7 },
  { id: 'SRC-PB-07', name: 'Rampura Phul Straw Depot', district: 'Bathinda', stream: 'paddy_straw', kind: 'crop_residue', availableT: 1750, access: 'state_highway', clusterCount: 8 },
  { id: 'SRC-PB-08', name: 'Nihal Singh Wala Cluster', district: 'Moga', stream: 'paddy_straw', kind: 'crop_residue', availableT: 1480, access: 'rural_road', clusterCount: 6 },
  { id: 'SRC-PB-09', name: 'Tapa Mandi Baling Point', district: 'Barnala', stream: 'paddy_straw', kind: 'crop_residue', availableT: 1320, access: 'state_highway', clusterCount: 6 },
  { id: 'SRC-PB-10', name: 'Zira Block Aggregation', district: 'Firozpur', stream: 'paddy_straw', kind: 'crop_residue', availableT: 1250, access: 'rural_road', clusterCount: 5 },
  { id: 'SRC-HR-01', name: 'Nilokheri Straw Collection Yard', district: 'Karnal', stream: 'paddy_straw', kind: 'crop_residue', availableT: 2350, access: 'national_highway', clusterCount: 12 },
  { id: 'SRC-HR-02', name: 'Pehowa FPO Baling Centre', district: 'Kurukshetra', stream: 'paddy_straw', kind: 'crop_residue', availableT: 1880, access: 'state_highway', clusterCount: 9 },
  { id: 'SRC-HR-03', name: 'Guhla Block Straw Cluster', district: 'Kaithal', stream: 'paddy_straw', kind: 'crop_residue', availableT: 1640, access: 'rural_road', clusterCount: 7 },

  // ── Wheat straw: expensive because fodder competes ────────────────────────
  { id: 'SRC-PB-11', name: 'Phillaur Wheat Residue Yard', district: 'Jalandhar', stream: 'wheat_straw', kind: 'crop_residue', availableT: 920, access: 'national_highway', clusterCount: 5 },
  { id: 'SRC-PB-12', name: 'Sultanpur Lodhi Cluster', district: 'Kapurthala', stream: 'wheat_straw', kind: 'crop_residue', availableT: 760, access: 'state_highway', clusterCount: 4 },
  { id: 'SRC-HR-04', name: 'Narwana Wheat Straw Depot', district: 'Jind', stream: 'wheat_straw', kind: 'crop_residue', availableT: 1050, access: 'state_highway', clusterCount: 6 },
  { id: 'SRC-HR-05', name: 'Tohana Residue Aggregation', district: 'Fatehabad', stream: 'wheat_straw', kind: 'crop_residue', availableT: 880, access: 'rural_road', clusterCount: 4 },
  { id: 'SRC-PB-13', name: 'Patti Block Wheat Cluster', district: 'Tarn Taran', stream: 'wheat_straw', kind: 'crop_residue', availableT: 690, access: 'rural_road', clusterCount: 4 },

  // ── Cotton stalk: the best biochar and pellet feedstock in the network ────
  { id: 'SRC-HR-06', name: 'Sirsa Cotton Belt Cluster', district: 'Sirsa', stream: 'cotton_stalk', kind: 'crop_residue', availableT: 1420, access: 'state_highway', clusterCount: 8 },
  { id: 'SRC-HR-07', name: 'Hisar Stalk Shredding Yard', district: 'Hisar', stream: 'cotton_stalk', kind: 'crop_residue', availableT: 1180, access: 'national_highway', clusterCount: 6 },
  { id: 'SRC-PB-14', name: 'Maur Cotton Residue Point', district: 'Bathinda', stream: 'cotton_stalk', kind: 'crop_residue', availableT: 960, access: 'state_highway', clusterCount: 5 },
  { id: 'SRC-PB-15', name: 'Malout Stalk Aggregation', district: 'Sri Muktsar Sahib', stream: 'cotton_stalk', kind: 'crop_residue', availableT: 840, access: 'rural_road', clusterCount: 4 },

  // ── Dairy: dense, wet, mass-limited in transport ──────────────────────────
  { id: 'SRC-PB-16', name: 'Khanna Dairy Cluster', district: 'Ludhiana', stream: 'cattle_dung', kind: 'dairy', availableT: 2100, access: 'national_highway', clusterCount: 42 },
  { id: 'SRC-PB-17', name: 'Samrala Cattle Belt', district: 'Ludhiana', stream: 'cattle_dung', kind: 'dairy', availableT: 1550, access: 'state_highway', clusterCount: 31 },
  { id: 'SRC-PB-18', name: 'Bhogpur Dairy Collective', district: 'Jalandhar', stream: 'cattle_dung', kind: 'dairy', availableT: 1380, access: 'state_highway', clusterCount: 26 },
  { id: 'SRC-HR-08', name: 'Gharaunda Dairy Belt', district: 'Karnal', stream: 'cattle_dung', kind: 'dairy', availableT: 1720, access: 'national_highway', clusterCount: 35 },
  { id: 'SRC-HR-09', name: 'Hansi Cattle Cluster', district: 'Hisar', stream: 'cattle_dung', kind: 'dairy', availableT: 1240, access: 'state_highway', clusterCount: 22 },
  { id: 'SRC-PB-19', name: 'Ajnala Dairy Collective', district: 'Amritsar', stream: 'cattle_dung', kind: 'dairy', availableT: 1010, access: 'rural_road', clusterCount: 18 },

  // ── Agro-processing: concentrated at the mill gate ────────────────────────
  { id: 'SRC-PB-20', name: 'Khanna Rice Mill Belt', district: 'Ludhiana', stream: 'rice_husk', kind: 'agro_processing', availableT: 980, access: 'national_highway', clusterCount: 12 },
  { id: 'SRC-HR-10', name: 'Taraori Rice Mill Cluster', district: 'Karnal', stream: 'rice_husk', kind: 'agro_processing', availableT: 860, access: 'national_highway', clusterCount: 10 },
  { id: 'SRC-PB-21', name: 'Jalalabad Mill Group', district: 'Firozpur', stream: 'rice_husk', kind: 'agro_processing', availableT: 620, access: 'state_highway', clusterCount: 7 },
  { id: 'SRC-HR-11', name: 'Yamunanagar Sugar Mill', district: 'Yamunanagar', stream: 'press_mud', kind: 'agro_processing', availableT: 2150, access: 'national_highway', clusterCount: 1 },
  { id: 'SRC-PB-22', name: 'Bhogpur Co-op Sugar Mill', district: 'Jalandhar', stream: 'press_mud', kind: 'agro_processing', availableT: 1480, access: 'state_highway', clusterCount: 1 },

  // ── Municipal organics: negative gate price, landfill counterfactual ──────
  { id: 'SRC-PB-23', name: 'Ludhiana MC Wet Waste Station', district: 'Ludhiana', stream: 'msw_organic', kind: 'municipal', availableT: 1850, access: 'national_highway', clusterCount: 4 },
  { id: 'SRC-CH-01', name: 'Chandigarh Dadumajra Transfer', district: 'Chandigarh', stream: 'msw_organic', kind: 'municipal', availableT: 1320, access: 'national_highway', clusterCount: 3 },
  { id: 'SRC-PB-24', name: 'Amritsar MC Segregation Yard', district: 'Amritsar', stream: 'msw_organic', kind: 'municipal', availableT: 1100, access: 'state_highway', clusterCount: 3 },
  { id: 'SRC-HR-12', name: 'Panipat MC Wet Waste Point', district: 'Panipat', stream: 'msw_organic', kind: 'municipal', availableT: 640, access: 'national_highway', clusterCount: 2 },

  // ── Markets: free feedstock with the best methane potential ───────────────
  { id: 'SRC-PB-25', name: 'Ludhiana Sabzi Mandi', district: 'Ludhiana', stream: 'mandi_waste', kind: 'market', availableT: 1120, access: 'national_highway', clusterCount: 1 },
  { id: 'SRC-PB-26', name: 'Jalandhar Fruit & Veg Market', district: 'Jalandhar', stream: 'mandi_waste', kind: 'market', availableT: 840, access: 'state_highway', clusterCount: 1 },
  { id: 'SRC-HR-13', name: 'Ambala Cantt Mandi', district: 'Ambala', stream: 'mandi_waste', kind: 'market', availableT: 610, access: 'national_highway', clusterCount: 1 },

  // ── Poultry litter: C:N of 9 puts it outside every pathway gate ───────────
  { id: 'SRC-HR-14', name: 'Barwala Poultry Belt', district: 'Hisar', stream: 'poultry_litter', kind: 'dairy', availableT: 520, access: 'state_highway', clusterCount: 19 },
  { id: 'SRC-PB-27', name: 'Nawanshahr Poultry Cluster', district: 'Hoshiarpur', stream: 'poultry_litter', kind: 'dairy', availableT: 310, access: 'rural_road', clusterCount: 11 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Facilities
// ─────────────────────────────────────────────────────────────────────────────

interface FacilitySeed {
  id: string;
  name: string;
  operator: string;
  district: string;
  pathway: PathwayId;
  capacityTpd: number;
  minFeedTpd: number;
  efficiency: number;
  opexInrPerT: number;
  capexAmortInrPerT: number;
  commissioned: number;
  powerSource: 'grid' | 'captive_biomass';
  /** which streams this plant is permitted to accept; omitted = all compatible */
  acceptedStreams?: StreamId[];
}

const FACILITY_SEEDS: FacilitySeed[] = [
  // ── Pyrolysis / biochar — the only durable-removal assets in the network ──
  { id: 'FAC-BC-01', name: 'Sangrur Biochar Works', operator: 'Trisala Carbon', district: 'Sangrur', pathway: 'pyrolysis_biochar', capacityTpd: 60, minFeedTpd: 22, efficiency: 1.02, opexInrPerT: 1800, capexAmortInrPerT: 1200, commissioned: 2023, powerSource: 'captive_biomass' },
  { id: 'FAC-BC-02', name: 'Bathinda Carbon Unit', operator: 'Malwa Biocarbon', district: 'Bathinda', pathway: 'pyrolysis_biochar', capacityTpd: 45, minFeedTpd: 18, efficiency: 0.95, opexInrPerT: 1950, capexAmortInrPerT: 1320, commissioned: 2024, powerSource: 'captive_biomass' },
  { id: 'FAC-BC-03', name: 'Karnal Pyrolysis Complex', operator: 'Indus Char Systems', district: 'Karnal', pathway: 'pyrolysis_biochar', capacityTpd: 70, minFeedTpd: 26, efficiency: 1.06, opexInrPerT: 1720, capexAmortInrPerT: 1150, commissioned: 2022, powerSource: 'captive_biomass' },
  { id: 'FAC-BC-04', name: 'Sirsa Stalk Carbonisation', operator: 'Agni Carbon Rural', district: 'Sirsa', pathway: 'pyrolysis_biochar', capacityTpd: 30, minFeedTpd: 12, efficiency: 0.92, opexInrPerT: 2100, capexAmortInrPerT: 1400, commissioned: 2025, powerSource: 'grid' },

  // ── Compressed bio-gas (SATAT) ────────────────────────────────────────────
  { id: 'FAC-CB-01', name: 'Yamunanagar CBG Plant', operator: 'Saraswati Bioenergy', district: 'Yamunanagar', pathway: 'anaerobic_digestion_cbg', capacityTpd: 120, minFeedTpd: 55, efficiency: 1.04, opexInrPerT: 1400, capexAmortInrPerT: 1100, commissioned: 2022, powerSource: 'grid' },
  { id: 'FAC-CB-02', name: 'Khanna Bio-CNG Facility', operator: 'Doaba Green Fuels', district: 'Ludhiana', pathway: 'anaerobic_digestion_cbg', capacityTpd: 100, minFeedTpd: 45, efficiency: 1.0, opexInrPerT: 1450, capexAmortInrPerT: 1150, commissioned: 2023, powerSource: 'grid' },
  { id: 'FAC-CB-03', name: 'Bhogpur CBG Unit', operator: 'Doaba Green Fuels', district: 'Jalandhar', pathway: 'anaerobic_digestion_cbg', capacityTpd: 70, minFeedTpd: 32, efficiency: 0.97, opexInrPerT: 1520, capexAmortInrPerT: 1240, commissioned: 2024, powerSource: 'grid' },
  { id: 'FAC-CB-04', name: 'Gharaunda Biomethane Plant', operator: 'Haryana Bioenergy Corp', district: 'Karnal', pathway: 'anaerobic_digestion_cbg', capacityTpd: 80, minFeedTpd: 36, efficiency: 1.01, opexInrPerT: 1430, capexAmortInrPerT: 1180, commissioned: 2023, powerSource: 'grid' },
  { id: 'FAC-CB-05', name: 'Mohali Urban Digester', operator: 'Tricity Organics', district: 'Chandigarh', pathway: 'anaerobic_digestion_cbg', capacityTpd: 60, minFeedTpd: 28, efficiency: 0.99, opexInrPerT: 1560, capexAmortInrPerT: 1260, commissioned: 2024, powerSource: 'grid', acceptedStreams: ['msw_organic', 'mandi_waste'] },

  // ── Pellet / densification for thermal co-firing ──────────────────────────
  { id: 'FAC-PL-01', name: 'Jagraon Pellet Plant', operator: 'Satluj Biomass', district: 'Ludhiana', pathway: 'pellet_cofiring', capacityTpd: 180, minFeedTpd: 70, efficiency: 1.0, opexInrPerT: 1100, capexAmortInrPerT: 450, commissioned: 2023, powerSource: 'grid' },
  { id: 'FAC-PL-02', name: 'Kaithal Densification Unit', operator: 'Haryana Biomass Pellets', district: 'Kaithal', pathway: 'pellet_cofiring', capacityTpd: 120, minFeedTpd: 50, efficiency: 0.96, opexInrPerT: 1180, capexAmortInrPerT: 500, commissioned: 2024, powerSource: 'grid' },
  { id: 'FAC-PL-03', name: 'Panipat Co-firing Feed Plant', operator: 'North Thermal Fuels', district: 'Panipat', pathway: 'pellet_cofiring', capacityTpd: 200, minFeedTpd: 85, efficiency: 1.03, opexInrPerT: 1050, capexAmortInrPerT: 420, commissioned: 2022, powerSource: 'grid' },

  // ── Composting — cheapest, most robust, lowest value ──────────────────────
  { id: 'FAC-CP-01', name: 'Ludhiana Windrow Site', operator: 'Ludhiana Municipal Corp', district: 'Ludhiana', pathway: 'composting', capacityTpd: 140, minFeedTpd: 30, efficiency: 0.98, opexInrPerT: 550, capexAmortInrPerT: 180, commissioned: 2021, powerSource: 'grid' },
  { id: 'FAC-CP-02', name: 'Patiala Compost Yard', operator: 'Patiala Nagar Nigam', district: 'Patiala', pathway: 'composting', capacityTpd: 90, minFeedTpd: 20, efficiency: 0.94, opexInrPerT: 600, capexAmortInrPerT: 200, commissioned: 2020, powerSource: 'grid' },
  { id: 'FAC-CP-03', name: 'Hisar Organic Compost Unit', operator: 'Bharat Agri Organics', district: 'Hisar', pathway: 'composting', capacityTpd: 110, minFeedTpd: 25, efficiency: 1.0, opexInrPerT: 570, capexAmortInrPerT: 190, commissioned: 2022, powerSource: 'grid' },
  { id: 'FAC-CP-04', name: 'Ambala Windrow Facility', operator: 'Ambala Municipal Council', district: 'Ambala', pathway: 'composting', capacityTpd: 70, minFeedTpd: 16, efficiency: 0.93, opexInrPerT: 620, capexAmortInrPerT: 210, commissioned: 2021, powerSource: 'grid' },

  // ── Gasification to power — ash-sensitive, small ──────────────────────────
  { id: 'FAC-GP-01', name: 'Barnala Gasifier Station', operator: 'Punjab Rural Power', district: 'Barnala', pathway: 'gasification_power', capacityTpd: 35, minFeedTpd: 15, efficiency: 0.98, opexInrPerT: 1300, capexAmortInrPerT: 900, commissioned: 2023, powerSource: 'captive_biomass' },
  { id: 'FAC-GP-02', name: 'Fatehabad Biomass Power', operator: 'Aravalli Renewables', district: 'Fatehabad', pathway: 'gasification_power', capacityTpd: 25, minFeedTpd: 11, efficiency: 0.9, opexInrPerT: 1420, capexAmortInrPerT: 980, commissioned: 2025, powerSource: 'captive_biomass' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Assembly
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Entities are jittered off their district headquarters by a deterministic,
 * seed-derived offset so the map shows a realistically dispersed network rather
 * than a stack of pins on 28 points. The jitter is reproducible.
 */
function jitter(id: string, base: District, spreadDeg: number): { lat: number; lon: number } {
  const rng = makeRng(hashString(id));
  const angle = rng() * Math.PI * 2;
  const radius = Math.sqrt(rng()) * spreadDeg;
  return {
    lat: base.lat + Math.sin(angle) * radius,
    lon: base.lon + (Math.cos(angle) * radius) / Math.cos((base.lat * Math.PI) / 180),
  };
}

export function buildSources(): WasteSource[] {
  return SOURCE_SEEDS.map((seed) => {
    const d = DISTRICT_BY_NAME.get(seed.district);
    if (!d) throw new Error(`Unknown district in source seed: ${seed.district}`);
    const pos = jitter(seed.id, d, seed.kind === 'crop_residue' ? 0.22 : 0.1);
    const rng = makeRng(hashString(seed.id + ':meta'));
    return {
      id: seed.id,
      name: seed.name,
      district: d.name,
      state: d.state,
      lat: pos.lat,
      lon: pos.lon,
      stream: seed.stream,
      kind: seed.kind,
      availableT: seed.availableT,
      annualT: Math.round(seed.availableT * (seed.kind === 'crop_residue' ? 2.4 : 12.2)),
      access: seed.access,
      clusterCount: seed.clusterCount,
      telemetryAgeH: Math.round(rng() * 20) / 2,
    };
  });
}

export function buildFacilities(): Facility[] {
  return FACILITY_SEEDS.map((seed) => {
    const d = DISTRICT_BY_NAME.get(seed.district);
    if (!d) throw new Error(`Unknown district in facility seed: ${seed.district}`);
    const pos = jitter(seed.id + ':fac', d, 0.08);
    return {
      id: seed.id,
      name: seed.name,
      operator: seed.operator,
      district: d.name,
      state: d.state,
      lat: pos.lat,
      lon: pos.lon,
      pathway: seed.pathway,
      capacityTpd: seed.capacityTpd,
      minFeedTpd: seed.minFeedTpd,
      availability: 1,
      status: 'online',
      acceptedStreams: seed.acceptedStreams ?? [],
      efficiency: seed.efficiency,
      opexInrPerT: seed.opexInrPerT,
      capexAmortInrPerT: seed.capexAmortInrPerT,
      commissioned: seed.commissioned,
      powerSource: seed.powerSource,
    };
  });
}

export function buildNetwork(): NetworkState {
  return {
    sources: buildSources(),
    facilities: buildFacilities(),
    vehicles: VEHICLES.map((v) => ({ ...v })),
    assumptions: { ...DEFAULT_ASSUMPTIONS },
    asOf: '2026-11-08',
    appliedScenarios: [],
    blockedArcs: [],
  };
}

/** Deep clone so scenario mutations never leak into the base network. */
export function cloneNetwork(n: NetworkState): NetworkState {
  return {
    sources: n.sources.map((s) => ({ ...s })),
    facilities: n.facilities.map((f) => ({ ...f, acceptedStreams: [...f.acceptedStreams] })),
    vehicles: n.vehicles.map((v) => ({ ...v, allowedRoads: [...v.allowedRoads] })),
    assumptions: { ...n.assumptions },
    asOf: n.asOf,
    appliedScenarios: n.appliedScenarios.map((s) => ({ ...s, params: { ...s.params } })),
    blockedArcs: n.blockedArcs.map((b) => ({ ...b })),
  };
}
