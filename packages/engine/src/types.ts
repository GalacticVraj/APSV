/**
 * TERRAFLUX — Circular Carbon Network Operating System
 * Core domain types.
 *
 * Written for Node's native TypeScript type-stripping: no enums, no namespaces,
 * no parameter properties. Union types + const objects only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Feedstock
// ─────────────────────────────────────────────────────────────────────────────

export type StreamId =
  | 'paddy_straw'
  | 'wheat_straw'
  | 'cotton_stalk'
  | 'rice_husk'
  | 'press_mud'
  | 'cattle_dung'
  | 'poultry_litter'
  | 'mandi_waste'
  | 'msw_organic';

export type SourceKind =
  | 'crop_residue'
  | 'dairy'
  | 'agro_processing'
  | 'municipal'
  | 'market';

/**
 * Proximate + ultimate analysis of a feedstock, dry basis unless stated.
 * These properties drive pathway yields, so pathway performance is derived
 * rather than looked up from a flat table.
 */
export interface StreamProps {
  id: StreamId;
  label: string;
  kind: SourceKind;
  /** as-received moisture, % wet basis */
  moisturePct: number;
  /** ash, % dry basis */
  ashPct: number;
  /** carbon, % dry basis */
  carbonPct: number;
  /** hydrogen, % dry basis */
  hydrogenPct: number;
  /** nitrogen, % dry basis */
  nitrogenPct: number;
  /** lignin, % dry basis — drives biochar yield and AD recalcitrance */
  ligninPct: number;
  /** carbon:nitrogen ratio */
  cnRatio: number;
  /** lower heating value, MJ/kg dry */
  lhvMjPerKg: number;
  /** as-handled bulk density, t/m3 — the binding logistics constraint */
  bulkDensityTPerM3: number;
  /** volatile solids as fraction of total solids — drives biomethane potential */
  vsFraction: number;
  /** biochemical methane potential, m3 CH4 per t volatile solids */
  bmpM3PerTVs: number;
  /** counterfactual fate if the network does not take it */
  counterfactual: Counterfactual;
  /** field/gate aggregation cost, INR per tonne (baling, loading, shredding) */
  aggregationCostInrPerT: number;
  /** price paid to the generator, INR per tonne */
  gatePriceInrPerT: number;
  notes: string;
}

export type Counterfactual =
  | 'open_field_burning'
  | 'open_dung_heap'
  | 'unmanaged_landfill'
  | 'open_dumping';

// ─────────────────────────────────────────────────────────────────────────────
// Conversion pathways
// ─────────────────────────────────────────────────────────────────────────────

export type PathwayId =
  | 'pyrolysis_biochar'
  | 'anaerobic_digestion_cbg'
  | 'pellet_cofiring'
  | 'composting'
  | 'gasification_power';

export type ProductId =
  | 'biochar'
  | 'bio_cng'
  | 'pellets'
  | 'compost'
  | 'electricity'
  | 'digestate';

export interface PathwayDef {
  id: PathwayId;
  label: string;
  short: string;
  /** which product line the plant sells */
  primaryProduct: ProductId;
  coProducts: ProductId[];
  /** feedstock gates the pathway imposes */
  maxMoisturePct: number;
  minMoisturePct: number;
  maxAshPct: number;
  minCnRatio: number;
  maxCnRatio: number;
  /** electricity drawn per tonne of wet feed, kWh/t */
  parasiticKwhPerT: number;
  /** thermal fuel drawn per tonne of wet feed, MJ/t (0 = autothermal) */
  processHeatMjPerT: number;
  /** fugitive CH4 as fraction of CH4 produced (AD only, else 0) */
  ch4SlipFraction: number;
  /** does the pathway produce durable carbon removal? */
  producesDurableRemoval: boolean;
  /** technology readiness / operating maturity note shown in UI */
  maturity: string;
  description: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Network entities
// ─────────────────────────────────────────────────────────────────────────────

export interface GeoPoint {
  lat: number;
  lon: number;
}

export type RoadClass = 'national_highway' | 'state_highway' | 'rural_road';

export interface WasteSource {
  id: string;
  name: string;
  district: string;
  state: string;
  lat: number;
  lon: number;
  stream: StreamId;
  kind: SourceKind;
  /** tonnes available in the current planning window */
  availableT: number;
  /** tonnes generated per year */
  annualT: number;
  /** road class of the last-mile link — sets speed and circuity */
  access: RoadClass;
  /** number of aggregation points feeding this node (affects collection cost) */
  clusterCount: number;
  /** hours since last supply telemetry update */
  telemetryAgeH: number;
}

export type FacilityStatus = 'online' | 'offline' | 'derated' | 'commissioning';

export interface Facility {
  id: string;
  name: string;
  operator: string;
  district: string;
  state: string;
  lat: number;
  lon: number;
  pathway: PathwayId;
  /** nameplate throughput, tonnes of wet feed per day */
  capacityTpd: number;
  /** minimum viable throughput for the plant to run at all, t/day */
  minFeedTpd: number;
  /** fraction of nameplate currently available (derating) */
  availability: number;
  status: FacilityStatus;
  /** streams the plant is permitted and equipped to accept */
  acceptedStreams: StreamId[];
  /** conversion efficiency multiplier vs. the reference design, 0.8–1.1 */
  efficiency: number;
  /** operating cost excluding feedstock and transport, INR per tonne */
  opexInrPerT: number;
  /** amortised capital charge, INR per tonne at nameplate */
  capexAmortInrPerT: number;
  /** year the plant entered service */
  commissioned: number;
  /** grid/captive power source for parasitic load */
  powerSource: 'grid' | 'captive_biomass';
}

export interface VehicleType {
  id: string;
  label: string;
  /** gross payload, tonnes */
  massCapacityT: number;
  /** usable deck volume, m3 */
  volumeM3: number;
  /** fuel burn, litres diesel per km, laden average */
  dieselLPerKm: number;
  /** hire cost, INR per km */
  costInrPerKm: number;
  /** fixed cost per trip, INR (loading, driver, tolls) */
  fixedCostInrPerTrip: number;
  /** average road speed, km/h */
  avgSpeedKmh: number;
  /** vehicles available in the fleet */
  fleetSize: number;
  /** productive hours per vehicle per day */
  shiftHours: number;
  /** road classes this vehicle can use */
  allowedRoads: RoadClass[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Optimisation
// ─────────────────────────────────────────────────────────────────────────────

export type ObjectiveMode = 'carbon_first' | 'profit_first' | 'balanced' | 'logistics_first';

/** A candidate source → facility arc, priced before optimisation. */
export interface Arc {
  sourceId: string;
  facilityId: string;
  pathway: PathwayId;
  stream: StreamId;
  /** road distance, km */
  distanceKm: number;
  /** straight-line distance, km */
  crowKm: number;
  /** payload actually achievable on this arc, t — min(mass, volume × density) */
  payloadT: number;
  /** vehicle selected for this arc */
  vehicleId: string;
  /** net tCO2e per tonne of feedstock moved on this arc (durable + avoided − emitted) */
  netCarbonPerT: number;
  /** durable removal component, tCO2e/t */
  durablePerT: number;
  /** avoided emissions component, tCO2e/t */
  avoidedPerT: number;
  /** gross emissions caused by the arc, tCO2e/t */
  emittedPerT: number;
  /** operating margin, INR per tonne */
  marginInrPerT: number;
  /** tonne-kilometres per tonne moved (i.e. loaded km + empty return share) */
  tkmPerT: number;
  /** feedstock-pathway suitability 0–1 */
  suitability: number;
}

export interface Allocation {
  sourceId: string;
  facilityId: string;
  pathway: PathwayId;
  stream: StreamId;
  tonnes: number;
  distanceKm: number;
  vehicleId: string;
  trips: number;
  payloadT: number;
  netCarbonT: number;
  durableT: number;
  avoidedT: number;
  emittedT: number;
  marginInr: number;
  revenueInr: number;
  costInr: number;
  tkm: number;
}

export interface SolverTelemetry {
  arcsGenerated: number;
  arcsFeasible: number;
  arcsRejected: Record<string, number>;
  candidateConfigurations: number;
  bnbNodesExplored: number;
  bnbNodesPruned: number;
  mcfIterations: number;
  /** LP relaxation objective (upper bound for a maximisation) */
  lpBound: number;
  /** best integer-feasible objective found */
  incumbent: number;
  /** relative optimality gap, 0 = proven optimal */
  gapPct: number;
  provenOptimal: boolean;
  solveMs: number;
  stages: SolveStage[];
}

export interface SolveStage {
  label: string;
  detail: string;
  ms: number;
}

export interface ShadowPrice {
  facilityId: string;
  facilityName: string;
  /** marginal objective value of one additional tonne per day of capacity */
  valuePerExtraTonne: number;
  unit: string;
  /** marginal tCO2e per additional tonne of capacity — measured, not inferred */
  carbonPerExtraTonne: number;
  /** marginal rupees per additional tonne of capacity */
  marginPerExtraTonne: number;
  binding: boolean;
  utilisationPct: number;
}

export interface OptimizationResult {
  objective: ObjectiveMode;
  allocations: Allocation[];
  openFacilities: string[];
  idleFacilities: string[];
  totals: NetworkTotals;
  telemetry: SolverTelemetry;
  shadowPrices: ShadowPrice[];
  rejectedAlternatives: RejectedAlternative[];
  windowDays: number;
  seed: number;
}

export interface RejectedAlternative {
  label: string;
  objectiveValue: number;
  deltaVsBest: number;
  reason: string;
}

export interface NetworkTotals {
  suppliedT: number;
  divertedT: number;
  strandedT: number;
  divertedPct: number;
  durableRemovalT: number;
  avoidedEmissionsT: number;
  transportEmissionsT: number;
  processEmissionsT: number;
  netCarbonT: number;
  revenueInr: number;
  feedstockCostInr: number;
  transportCostInr: number;
  processingCostInr: number;
  carbonRevenueInr: number;
  marginInr: number;
  tkm: number;
  vehicleTrips: number;
  vehicleDaysUsed: number;
  fleetUtilisationPct: number;
  marginPerTonneInr: number;
  abatementCostInrPerTco2e: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Carbon ledger
// ─────────────────────────────────────────────────────────────────────────────

export interface LedgerLine {
  key: string;
  label: string;
  /** tCO2e — positive = benefit, negative = charge against the network */
  valueT: number;
  kind: 'removal' | 'avoided' | 'substitution' | 'emission' | 'adjustment' | 'total';
  basis: string;
  source: string;
  uncertaintyPct: number;
}

export interface CarbonLedger {
  lines: LedgerLine[];
  durableRemovalT: number;
  avoidedEmissionsT: number;
  substitutionT: number;
  emissionsT: number;
  netT: number;
  permanence: PermanenceReport | null;
  uncertainty: UncertaintyBand | null;
}

export interface PermanenceReport {
  /** H/Corg molar ratio of the biochar produced */
  hcOrgRatio: number;
  /** mean annual soil temperature used, deg C */
  soilTempC: number;
  /** reference temperature the decay data was harmonised to, deg C */
  referenceTempC: number;
  q10: number;
  /** ratio of decay rate at soil temp vs reference temp */
  fT: number;
  /** fraction of biochar C remaining at 100 years */
  bc100: number;
  labileFraction: number;
  labileRatePerYr: number;
  persistentRatePerYr: number;
  /** the curve, for plotting */
  curve: Array<{ year: number; remaining: number }>;
  method: string;
}

export interface UncertaintyBand {
  draws: number;
  p5: number;
  p50: number;
  p95: number;
  mean: number;
  stdev: number;
  /** the full sorted sample, thinned for plotting */
  histogram: Array<{ bin: number; count: number }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Forecasting
// ─────────────────────────────────────────────────────────────────────────────

export interface ForecastPoint {
  weekIndex: number;
  /** ISO date of the week start */
  date: string;
  actual: number | null;
  predicted: number;
  lower: number;
  upper: number;
}

export interface SourceForecast {
  sourceId: string;
  stream: StreamId;
  horizonWeeks: number;
  points: ForecastPoint[];
  /** walk-forward backtest mean absolute percentage error */
  backtestMapePct: number;
  /** in-sample coefficient of determination */
  r2: number;
  featureNames: string[];
  coefficients: number[];
  model: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Routing
// ─────────────────────────────────────────────────────────────────────────────

export interface RouteStop {
  sourceId: string;
  name: string;
  lat: number;
  lon: number;
  tonnesPicked: number;
  cumulativeLoadT: number;
}

export interface VehicleRoute {
  id: string;
  facilityId: string;
  facilityName: string;
  vehicleId: string;
  vehicleLabel: string;
  stops: RouteStop[];
  /** ordered polyline including the return leg to the facility */
  polyline: GeoPoint[];
  distanceKm: number;
  durationH: number;
  loadT: number;
  payloadT: number;
  utilisationPct: number;
  limitedBy: 'mass' | 'volume';
  costInr: number;
  emissionsT: number;
}

export interface RoutingResult {
  routes: VehicleRoute[];
  totalDistanceKm: number;
  directHaulDistanceKm: number;
  consolidationSavingPct: number;
  totalTrips: number;
  vehicleDaysUsed: number;
  fleetCapacityDays: number;
  infeasibleTonnes: number;
  improvementPasses: number;
  /** trips that would be needed if payload were limited by mass rating alone */
  massEquivalentTrips: number;
  /** additional trips caused by low bulk density filling the deck before the axle */
  extraTripsFromVolume: number;
  /** share of moved tonnage travelling on volume-limited loads */
  volumeLimitedSharePct: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottlenecks and resilience
// ─────────────────────────────────────────────────────────────────────────────

export type BottleneckKind =
  | 'facility_capacity'
  | 'stranded_supply'
  | 'fleet_capacity'
  | 'pathway_mismatch'
  | 'haul_uneconomic'
  | 'min_feed_unmet';

export type Severity = 'critical' | 'high' | 'moderate' | 'low';

export interface Bottleneck {
  id: string;
  kind: BottleneckKind;
  severity: Severity;
  title: string;
  detail: string;
  /** what is lost because of it, in tCO2e over the window */
  carbonAtRiskT: number;
  valueAtRiskInr: number;
  entityIds: string[];
  recommendation: string;
  quantifiedUpside: string;
}

export interface StrandedLot {
  sourceId: string;
  name: string;
  stream: StreamId;
  tonnes: number;
  reason: BottleneckKind;
  reasonText: string;
  nearestFacilityKm: number | null;
  counterfactualEmissionsT: number;
}

export interface ResilienceReport {
  score: number;
  grade: string;
  /** worst single-facility contingency */
  worstCaseFacilityId: string;
  worstCaseFacilityName: string;
  worstCaseLossPct: number;
  meanLossPct: number;
  n1Results: Array<{
    facilityId: string;
    facilityName: string;
    lossPct: number;
    strandedT: number;
    absorbedBy: string[];
  }>;
  components: Array<{ label: string; value: number; weight: number; note: string }>;
  method: string;
}

export interface OpportunityScore {
  sourceId: string;
  name: string;
  stream: StreamId;
  score: number;
  tonnes: number;
  components: {
    volume: number;
    proximity: number;
    carbonPotential: number;
    conversionValue: number;
    transportBurden: number;
    facilityAvailability: number;
  };
  bestPathway: PathwayId;
  bestFacilityId: string | null;
  headroomT: number;
  note: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenarios
// ─────────────────────────────────────────────────────────────────────────────

export type ScenarioKind =
  | 'facility_offline'
  | 'facility_derate'
  | 'supply_surge'
  | 'supply_shortage'
  | 'fleet_shortage'
  | 'diesel_price'
  | 'carbon_price'
  | 'processing_cost'
  | 'road_disruption'
  | 'new_facility'
  | 'seasonal_shift'
  | 'objective_change';

export interface ScenarioParamDef {
  key: string;
  label: string;
  type: 'entity' | 'number' | 'choice';
  entityType?: 'facility' | 'source' | 'district' | 'stream';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  choices?: Array<{ value: string; label: string }>;
  defaultValue: string | number;
}

export interface ScenarioDef {
  kind: ScenarioKind;
  label: string;
  category: 'disruption' | 'market' | 'supply' | 'strategy';
  description: string;
  params: ScenarioParamDef[];
  /** headline used in the demo script */
  demoHeadline: string;
}

export interface ScenarioInstance {
  kind: ScenarioKind;
  params: Record<string, string | number>;
}

export interface ScenarioDelta {
  key: string;
  label: string;
  unit: string;
  before: number;
  after: number;
  delta: number;
  deltaPct: number;
  /** is a rise good? */
  higherIsBetter: boolean;
}

export interface FlowChange {
  sourceId: string;
  sourceName: string;
  fromFacilityId: string | null;
  fromFacilityName: string | null;
  toFacilityId: string | null;
  toFacilityName: string | null;
  tonnes: number;
  changeType: 'rerouted' | 'added' | 'dropped' | 'increased' | 'decreased';
  distanceDeltaKm: number;
  carbonDeltaT: number;
}

export interface ScenarioResult {
  scenario: ScenarioInstance;
  label: string;
  narrative: string[];
  before: OptimizationResult;
  after: OptimizationResult;
  deltas: ScenarioDelta[];
  flowChanges: FlowChange[];
  newBottlenecks: Bottleneck[];
  resolvedBottleneckIds: string[];
  affectedEntityIds: string[];
  computeStages: SolveStage[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Digital twin state
// ─────────────────────────────────────────────────────────────────────────────

export interface Assumptions {
  /** planning window length, days */
  windowDays: number;
  /** road circuity multiplier applied to great-circle distance */
  circuityFactor: number;
  /** diesel price, INR per litre */
  dieselPriceInrPerL: number;
  /** durable CDR price, INR per tCO2e */
  cdrPriceInrPerT: number;
  /** avoided-emission credit price, INR per tCO2e */
  vcmPriceInrPerT: number;
  /** Indian grid emission factor, tCO2e per MWh */
  gridEfTPerMwh: number;
  /** mean annual soil temperature for permanence, deg C */
  soilTempC: number;
  /** maximum economic haul distance, km */
  maxHaulKm: number;
  /** Monte Carlo draws */
  mcDraws: number;
  /** deterministic seed */
  seed: number;
}

export interface NetworkState {
  sources: WasteSource[];
  facilities: Facility[];
  vehicles: VehicleType[];
  assumptions: Assumptions;
  /** ISO date the state represents */
  asOf: string;
  /** which scenario mutations are currently applied */
  appliedScenarios: ScenarioInstance[];
  blockedArcs: Array<{ sourceId: string; facilityId: string }>;
}

export interface NetworkEvent {
  id: string;
  ts: string;
  kind: 'optimization' | 'scenario' | 'alert' | 'forecast' | 'system';
  severity: Severity | 'info';
  title: string;
  detail: string;
  entityIds: string[];
}
