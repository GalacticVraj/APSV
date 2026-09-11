/**
 * The network optimiser.
 *
 * Structure of the problem: choose which facilities operate (binary), then decide
 * how much of each source's feedstock goes to each operating facility (continuous).
 * That is a capacitated facility-location problem with semi-continuous throughput —
 * a facility either runs above its minimum viable feed or does not run at all.
 *
 * Method: branch and bound over the facility on/off decisions, with each node's
 * relaxation solved *exactly* by min-cost flow. This gives a true upper bound at
 * the root, so the optimality gap we report is a real gap and not a decoration.
 *
 * Multi-objective handling follows MIRA's framing (carbon-focused / revenue-focused
 * / balanced) extended with a logistics mode. Objectives are scalarised against
 * normalisation constants derived from the arc set, so switching mode genuinely
 * changes which network is optimal rather than merely re-sorting a list.
 */

import type {
  Allocation,
  Arc,
  Facility,
  NetworkState,
  NetworkTotals,
  ObjectiveMode,
  OptimizationResult,
  RejectedAlternative,
  ShadowPrice,
  SolveStage,
  SolverTelemetry,
  StreamId,
  VehicleType,
  WasteSource,
} from './types.ts';
import { roadDistanceKm } from './geo.ts';
import { STREAMS } from './streams.ts';
import { PATHWAYS, suitability } from './pathways.ts';
import {
  baseFactors,
  evaluateCarbon,
  permanenceFor,
  physicalPerTonne,
  type PhysicalPerTonne,
} from './carbon.ts';
import { economicsPerTonne, transportCostPerTonne } from './economics.ts';
import { solveTransport, type TransportProblem } from './mincostflow.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Arc generation
// ─────────────────────────────────────────────────────────────────────────────

export interface ArcSet {
  arcs: Arc[];
  /** arcs grouped by source index, referencing facility index */
  bySource: Array<Array<{ arcIndex: number; facility: number }>>;
  rejected: Record<string, number>;
  generated: number;
  physical: PhysicalPerTonne[];
}

/**
 * Chooses the cheapest legal vehicle for an arc.
 *
 * Payload is min(mass rating, deck volume x feedstock bulk density). For baled
 * straw at 0.15 t/m3 the volume term binds on every truck in the fleet, so a
 * 16-tonne truck carries about 8.7 t. Selecting on cost-per-tonne rather than on
 * vehicle size is what makes tractor-trolleys win short rural hauls and trucks win
 * long highway hauls, without any of that being hard-coded.
 */
export function selectVehicle(
  source: WasteSource,
  distanceKm: number,
  vehicles: VehicleType[],
  net: NetworkState,
): { vehicle: VehicleType; payloadT: number; costPerT: number } | null {
  const density = STREAMS[source.stream].bulkDensityTPerM3;
  let best: { vehicle: VehicleType; payloadT: number; costPerT: number } | null = null;
  for (const v of vehicles) {
    if (!v.allowedRoads.includes(source.access)) continue;
    if (v.fleetSize <= 0) continue;
    const payloadT = Math.min(v.massCapacityT, v.volumeM3 * density);
    if (payloadT <= 0.1) continue;
    const costPerT = transportCostPerTonne(distanceKm, payloadT, v, net.assumptions);
    if (!Number.isFinite(costPerT)) continue;
    if (!best || costPerT < best.costPerT) best = { vehicle: v, payloadT, costPerT };
  }
  return best;
}

export function buildArcs(net: NetworkState): ArcSet {
  const arcs: Arc[] = [];
  const physical: PhysicalPerTonne[] = [];
  const bySource: Array<Array<{ arcIndex: number; facility: number }>> = [];
  const rejected: Record<string, number> = {
    'Facility offline': 0,
    'Stream not accepted at site': 0,
    'Pathway gate failed': 0,
    'Beyond maximum haul distance': 0,
    'Route blocked': 0,
    'No legal vehicle': 0,
  };
  let generated = 0;

  const permCache = new Map<StreamId, ReturnType<typeof permanenceFor>>();
  const permFor = (s: StreamId) => {
    let p = permCache.get(s);
    if (!p) {
      p = permanenceFor(s, net.assumptions.soilTempC);
      permCache.set(s, p);
    }
    return p;
  };

  const blocked = new Set(net.blockedArcs.map((b) => `${b.sourceId}>${b.facilityId}`));

  for (let i = 0; i < net.sources.length; i++) {
    const src = net.sources[i];
    const stream = STREAMS[src.stream];
    const row: Array<{ arcIndex: number; facility: number }> = [];

    for (let j = 0; j < net.facilities.length; j++) {
      const fac = net.facilities[j];
      generated++;

      if (fac.status === 'offline' || fac.availability <= 0) {
        rejected['Facility offline']++;
        continue;
      }
      if (blocked.has(`${src.id}>${fac.id}`)) {
        rejected['Route blocked']++;
        continue;
      }
      if (fac.acceptedStreams.length > 0 && !fac.acceptedStreams.includes(src.stream)) {
        rejected['Stream not accepted at site']++;
        continue;
      }

      const pathway = PATHWAYS[fac.pathway];
      const suit = suitability(stream, pathway);
      if (!suit.feasible) {
        rejected['Pathway gate failed']++;
        continue;
      }

      const distanceKm = roadDistanceKm(
        src,
        fac,
        net.assumptions.circuityFactor,
        src.access,
      );
      if (distanceKm > net.assumptions.maxHaulKm) {
        rejected['Beyond maximum haul distance']++;
        continue;
      }

      const pick = selectVehicle(src, distanceKm, net.vehicles, net);
      if (!pick) {
        rejected['No legal vehicle']++;
        continue;
      }

      const phys = physicalPerTonne(
        src.stream,
        fac.pathway,
        fac.efficiency * suit.score ** 0.35,
        distanceKm,
        pick.payloadT,
        pick.vehicle,
      );
      const perm = permFor(src.stream);
      const fac0 = baseFactors(perm.bc100, net.assumptions);
      const carbon = evaluateCarbon(phys, 1, fac0);
      const econ = economicsPerTonne(
        src.stream,
        fac.pathway,
        fac,
        distanceKm,
        pick.payloadT,
        pick.vehicle,
        carbon,
        net.assumptions,
      );

      const arcIndex = arcs.length;
      arcs.push({
        sourceId: src.id,
        facilityId: fac.id,
        pathway: fac.pathway,
        stream: src.stream,
        distanceKm,
        crowKm: distanceKm / (net.assumptions.circuityFactor || 1),
        payloadT: pick.payloadT,
        vehicleId: pick.vehicle.id,
        netCarbonPerT: carbon.netT,
        durablePerT: carbon.durableT,
        avoidedPerT: carbon.avoidedT + carbon.substitutionT,
        emittedPerT: carbon.emittedT,
        marginInrPerT: econ.margin,
        tkmPerT: distanceKm,
        suitability: suit.score,
      });
      physical.push(phys);
      row.push({ arcIndex, facility: j });
    }
    bySource.push(row);
  }

  return { arcs, bySource, rejected, generated, physical };
}

// ─────────────────────────────────────────────────────────────────────────────
// Objective scalarisation
// ─────────────────────────────────────────────────────────────────────────────

export interface ObjectiveScale {
  maxCarbon: number;
  maxMargin: number;
  maxTkm: number;
}

export function objectiveScale(arcs: Arc[]): ObjectiveScale {
  let maxCarbon = 1e-6;
  let maxMargin = 1e-6;
  let maxTkm = 1e-6;
  for (const a of arcs) {
    maxCarbon = Math.max(maxCarbon, Math.abs(a.netCarbonPerT));
    maxMargin = Math.max(maxMargin, Math.abs(a.marginInrPerT));
    maxTkm = Math.max(maxTkm, a.tkmPerT);
  }
  return { maxCarbon, maxMargin, maxTkm };
}

const OBJ_SCALE_INT = 1_000_000;

/**
 * Value of one tonne on this arc under the chosen objective, as a scaled integer.
 *
 * Carbon First carries a small margin term so that, among carbon-identical
 * options, the cheaper one wins. It is four orders of magnitude below the carbon
 * term, so it can never override a carbon decision — it only breaks ties.
 */
export function arcValue(a: Arc, mode: ObjectiveMode, sc: ObjectiveScale): number {
  const carbonNorm = a.netCarbonPerT / sc.maxCarbon;
  const marginNorm = a.marginInrPerT / sc.maxMargin;
  const tkmNorm = a.tkmPerT / sc.maxTkm;

  switch (mode) {
    case 'carbon_first':
      return Math.round(carbonNorm * OBJ_SCALE_INT + marginNorm * 100);
    case 'profit_first':
      return Math.round(marginNorm * OBJ_SCALE_INT + carbonNorm * 100);
    case 'balanced':
      return Math.round((0.5 * carbonNorm + 0.5 * marginNorm) * OBJ_SCALE_INT);
    case 'logistics_first':
      // Carbon delivered per unit of transport burden: reward carbon, charge
      // heavily for tonne-kilometres and reward operational simplicity.
      return Math.round((carbonNorm - 0.55 * tkmNorm + 0.15 * marginNorm) * OBJ_SCALE_INT);
    default:
      return 0;
  }
}

/** Pareto sweep weight: 0 = pure profit, 1 = pure carbon. */
export function arcValueWeighted(a: Arc, w: number, sc: ObjectiveScale): number {
  const carbonNorm = a.netCarbonPerT / sc.maxCarbon;
  const marginNorm = a.marginInrPerT / sc.maxMargin;
  return Math.round((w * carbonNorm + (1 - w) * marginNorm) * OBJ_SCALE_INT);
}

// ─────────────────────────────────────────────────────────────────────────────
// Branch and bound
// ─────────────────────────────────────────────────────────────────────────────

interface BnbNode {
  closed: Set<number>;
  forcedOpen: Set<number>;
  bound: number;
  depth: number;
}

interface SolveOutcome {
  value: number;
  flow: number[][];
  facilityLoad: number[];
  iterations: number;
  feasible: boolean;
}

function buildProblem(
  net: NetworkState,
  arcSet: ArcSet,
  values: number[],
  closed: Set<number>,
  forcedOpen: Set<number>,
  capacityOverride: Map<number, number> | null,
): TransportProblem {
  const windowDays = net.assumptions.windowDays;
  const supplies = net.sources.map((s) => s.availableT);
  const capacities = net.facilities.map((f, j) => {
    if (closed.has(j)) return 0;
    if (f.status === 'offline') return 0;
    const override = capacityOverride?.get(j);
    const base = f.capacityTpd * f.availability * windowDays;
    return override !== undefined ? base + override : base;
  });
  const lowerBounds = net.facilities.map((f, j) =>
    forcedOpen.has(j) ? f.minFeedTpd * windowDays : 0,
  );
  const arcs = arcSet.bySource.map((row) =>
    row
      .filter((r) => !closed.has(r.facility))
      .map((r) => ({ facility: r.facility, value: values[r.arcIndex] })),
  );
  return { supplies, capacities, lowerBounds, arcs };
}

function solveNode(
  net: NetworkState,
  arcSet: ArcSet,
  values: number[],
  node: BnbNode,
  capacityOverride: Map<number, number> | null,
): SolveOutcome {
  const problem = buildProblem(
    net,
    arcSet,
    values,
    node.closed,
    node.forcedOpen,
    capacityOverride,
  );
  const sol = solveTransport(problem);
  const feasible = sol.lowerBoundsMet.every((ok, j) => ok || !node.forcedOpen.has(j));
  // Re-expand the filtered arc rows back to the full per-source arc layout.
  const flow: number[][] = arcSet.bySource.map(() => []);
  for (let i = 0; i < arcSet.bySource.length; i++) {
    const kept = arcSet.bySource[i].filter((r) => !node.closed.has(r.facility));
    const row = new Array(arcSet.bySource[i].length).fill(0);
    let k = 0;
    for (let idx = 0; idx < arcSet.bySource[i].length; idx++) {
      if (node.closed.has(arcSet.bySource[i][idx].facility)) continue;
      row[idx] = sol.flow[i][k++];
    }
    void kept;
    flow[i] = row;
  }
  return {
    value: sol.value,
    flow,
    facilityLoad: sol.facilityLoad,
    iterations: sol.iterations,
    feasible,
  };
}

export interface OptimizeOptions {
  /** cap on branch-and-bound nodes; the reported gap accounts for early stops */
  maxNodes?: number;
  /** skip shadow-price re-optimisation (used inside scenario sweeps) */
  skipShadowPrices?: boolean;
  /** skip the rejected-alternatives comparison */
  skipAlternatives?: boolean;
  /** override the objective weight for a Pareto sweep */
  paretoWeight?: number;
}

export function optimize(
  net: NetworkState,
  mode: ObjectiveMode,
  options: OptimizeOptions = {},
): OptimizationResult {
  const t0 = Date.now();
  const stages: SolveStage[] = [];
  const stage = (label: string, detail: string, start: number) => {
    stages.push({ label, detail, ms: Date.now() - start });
  };

  let tStage = Date.now();
  const arcSet = buildArcs(net);
  stage(
    'Build candidate network',
    `${arcSet.generated} source-facility pairs examined, ${arcSet.arcs.length} feasible arcs retained`,
    tStage,
  );

  tStage = Date.now();
  const sc = objectiveScale(arcSet.arcs);
  const values =
    options.paretoWeight !== undefined
      ? arcSet.arcs.map((a) => arcValueWeighted(a, options.paretoWeight as number, sc))
      : arcSet.arcs.map((a) => arcValue(a, mode, sc));
  stage(
    'Price arcs under objective',
    `Objective "${mode}" scalarised against max carbon ${sc.maxCarbon.toFixed(2)} tCO₂e/t and max margin ₹${Math.round(sc.maxMargin)}/t`,
    tStage,
  );

  const windowDays = net.assumptions.windowDays;
  const minFeedWindow = net.facilities.map((f) => f.minFeedTpd * windowDays);
  const maxNodes = options.maxNodes ?? 220;

  tStage = Date.now();
  const root: BnbNode = { closed: new Set(), forcedOpen: new Set(), bound: Infinity, depth: 0 };
  const rootOutcome = solveNode(net, arcSet, values, root, null);
  const lpBound = rootOutcome.value;

  let best: { node: BnbNode; outcome: SolveOutcome } | null = null;
  const readBest = (): { node: BnbNode; outcome: SolveOutcome } | null => best;
  let nodesExplored = 1;
  let nodesPruned = 0;
  let mcfIterations = rootOutcome.iterations;
  let candidateConfigurations = 1;

  const queue: Array<{ node: BnbNode; outcome: SolveOutcome }> = [];

  const violationsOf = (outcome: SolveOutcome, node: BnbNode): number[] => {
    const out: number[] = [];
    for (let j = 0; j < net.facilities.length; j++) {
      if (node.closed.has(j)) continue;
      const load = outcome.facilityLoad[j];
      if (load > 0.5 && load < minFeedWindow[j] - 0.5) out.push(j);
    }
    return out;
  };

  const consider = (node: BnbNode, outcome: SolveOutcome) => {
    if (!outcome.feasible) {
      nodesPruned++;
      return;
    }
    const v = violationsOf(outcome, node);
    if (v.length === 0) {
      if (!best || outcome.value > best.outcome.value) best = { node, outcome };
      return;
    }
    if (best && outcome.value <= best.outcome.value) {
      nodesPruned++;
      return;
    }
    queue.push({ node: { ...node, bound: outcome.value }, outcome });
  };

  consider(root, rootOutcome);

  while (queue.length > 0 && nodesExplored < maxNodes) {
    // Best-first: expand the node with the strongest bound.
    queue.sort((a, b) => b.outcome.value - a.outcome.value);
    const current = queue.shift();
    if (!current) break;
    // `best` is only ever assigned inside the `consider` closure, which
    // control-flow analysis cannot follow, so read it through an accessor to
    // recover its declared type rather than its narrowed one.
    const incumbentNode = readBest();
    if (incumbentNode && current.outcome.value <= incumbentNode.outcome.value) {
      nodesPruned++;
      continue;
    }
    const viol = violationsOf(current.outcome, current.node);
    if (viol.length === 0) continue;

    // Branch on the facility furthest below its minimum viable feed.
    let worst = viol[0];
    let worstGap = minFeedWindow[worst] - current.outcome.facilityLoad[worst];
    for (const j of viol) {
      const gap = minFeedWindow[j] - current.outcome.facilityLoad[j];
      if (gap > worstGap) {
        worst = j;
        worstGap = gap;
      }
    }

    // Child A: this facility does not run at all.
    const closedChild: BnbNode = {
      closed: new Set(current.node.closed).add(worst),
      forcedOpen: new Set(current.node.forcedOpen),
      bound: current.outcome.value,
      depth: current.node.depth + 1,
    };
    closedChild.forcedOpen.delete(worst);
    const outA = solveNode(net, arcSet, values, closedChild, null);
    nodesExplored++;
    candidateConfigurations++;
    mcfIterations += outA.iterations;
    consider(closedChild, outA);

    // Child B: this facility runs, and must reach its minimum viable feed.
    const openChild: BnbNode = {
      closed: new Set(current.node.closed),
      forcedOpen: new Set(current.node.forcedOpen).add(worst),
      bound: current.outcome.value,
      depth: current.node.depth + 1,
    };
    const outB = solveNode(net, arcSet, values, openChild, null);
    nodesExplored++;
    candidateConfigurations++;
    mcfIterations += outB.iterations;
    consider(openChild, outB);
  }

  // Fall back to the root relaxation if branching found nothing feasible, and
  // repair it by shutting every facility that cannot reach its minimum feed.
  if (!best) {
    const repaired: BnbNode = {
      closed: new Set(violationsOf(rootOutcome, root)),
      forcedOpen: new Set(),
      bound: lpBound,
      depth: 0,
    };
    const out = solveNode(net, arcSet, values, repaired, null);
    nodesExplored++;
    best = { node: repaired, outcome: out };
  }

  const chosen = best as { node: BnbNode; outcome: SolveOutcome };
  const gapPct =
    lpBound > 0 ? Math.max(0, ((lpBound - chosen.outcome.value) / lpBound) * 100) : 0;
  const provenOptimal = queue.length === 0 && nodesExplored < maxNodes;

  stage(
    'Branch and bound over facility operation',
    `${nodesExplored} nodes explored, ${nodesPruned} pruned, gap ${gapPct.toFixed(2)}%`,
    tStage,
  );

  // ── Materialise allocations ────────────────────────────────────────────────
  tStage = Date.now();
  const allocations = materialiseAllocations(net, arcSet, chosen.outcome.flow);
  const totals = computeTotals(net, allocations);
  stage(
    'Cost the selected configuration',
    `${allocations.length} active flows, ${totals.divertedT.toFixed(0)} t diverted`,
    tStage,
  );

  const openFacilities: string[] = [];
  const idleFacilities: string[] = [];
  for (let j = 0; j < net.facilities.length; j++) {
    const load = chosen.outcome.facilityLoad[j] ?? 0;
    if (load > 0.5) openFacilities.push(net.facilities[j].id);
    else idleFacilities.push(net.facilities[j].id);
  }

  // ── Shadow prices by re-optimisation ──────────────────────────────────────
  let shadowPrices: ShadowPrice[] = [];
  if (!options.skipShadowPrices) {
    tStage = Date.now();
    shadowPrices = computeShadowPrices(
      net,
      arcSet,
      values,
      chosen.node,
      chosen.outcome,
      mode,
      totals,
    );
    stage(
      'Measure marginal value of capacity',
      `${shadowPrices.filter((s) => s.binding).length} binding constraints re-optimised`,
      tStage,
    );
  }

  let rejectedAlternatives: RejectedAlternative[] = [];
  if (!options.skipAlternatives) {
    tStage = Date.now();
    rejectedAlternatives = compareAlternatives(net, arcSet, values, chosen.outcome.value);
    stage(
      'Score rejected alternatives',
      `${rejectedAlternatives.length} alternative configurations evaluated against the chosen one`,
      tStage,
    );
  }

  const telemetry: SolverTelemetry = {
    arcsGenerated: arcSet.generated,
    arcsFeasible: arcSet.arcs.length,
    arcsRejected: arcSet.rejected,
    candidateConfigurations,
    bnbNodesExplored: nodesExplored,
    bnbNodesPruned: nodesPruned,
    mcfIterations,
    lpBound,
    incumbent: chosen.outcome.value,
    gapPct,
    provenOptimal,
    solveMs: Date.now() - t0,
    stages,
  };

  return {
    objective: mode,
    allocations,
    openFacilities,
    idleFacilities,
    totals,
    telemetry,
    shadowPrices,
    rejectedAlternatives,
    windowDays,
    seed: net.assumptions.seed,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Allocations and totals
// ─────────────────────────────────────────────────────────────────────────────

export function materialiseAllocations(
  net: NetworkState,
  arcSet: ArcSet,
  flow: number[][],
): Allocation[] {
  const out: Allocation[] = [];
  for (let i = 0; i < arcSet.bySource.length; i++) {
    for (let k = 0; k < arcSet.bySource[i].length; k++) {
      const tonnes = flow[i][k];
      if (!tonnes || tonnes <= 0.5) continue;
      const arcIndex = arcSet.bySource[i][k].arcIndex;
      const a = arcSet.arcs[arcIndex];
      const facility = net.facilities.find((f) => f.id === a.facilityId);
      const vehicle = net.vehicles.find((v) => v.id === a.vehicleId);
      if (!facility || !vehicle) continue;

      const trips = Math.ceil(tonnes / a.payloadT);
      const econ = economicsPerTonne(
        a.stream,
        a.pathway,
        facility,
        a.distanceKm,
        a.payloadT,
        vehicle,
        {
          durableT: a.durablePerT,
          avoidedT: a.avoidedPerT,
          substitutionT: 0,
          emittedT: a.emittedPerT,
          netT: a.netCarbonPerT,
        },
        net.assumptions,
      );

      out.push({
        sourceId: a.sourceId,
        facilityId: a.facilityId,
        pathway: a.pathway,
        stream: a.stream,
        tonnes,
        distanceKm: a.distanceKm,
        vehicleId: a.vehicleId,
        trips,
        payloadT: a.payloadT,
        netCarbonT: a.netCarbonPerT * tonnes,
        durableT: a.durablePerT * tonnes,
        avoidedT: a.avoidedPerT * tonnes,
        emittedT: a.emittedPerT * tonnes,
        marginInr: a.marginInrPerT * tonnes,
        revenueInr: (econ.productRevenue + econ.carbonRevenue) * tonnes,
        costInr:
          (econ.feedstockCost +
            econ.aggregationCost +
            econ.transportCost +
            econ.processingCost +
            econ.capexCost) *
          tonnes,
        tkm: a.distanceKm * tonnes,
      });
    }
  }
  return out;
}

export function computeTotals(net: NetworkState, allocations: Allocation[]): NetworkTotals {
  const suppliedT = net.sources.reduce((s, x) => s + x.availableT, 0);
  let divertedT = 0;
  let durable = 0;
  let avoided = 0;
  let emitted = 0;
  let net_ = 0;
  let revenue = 0;
  let cost = 0;
  let margin = 0;
  let tkm = 0;
  let trips = 0;
  let vehicleHours = 0;
  let transportEmissions = 0;

  const vehById = new Map(net.vehicles.map((v) => [v.id, v]));
  for (const a of allocations) {
    divertedT += a.tonnes;
    durable += a.durableT;
    avoided += a.avoidedT;
    emitted += a.emittedT;
    net_ += a.netCarbonT;
    revenue += a.revenueInr;
    cost += a.costInr;
    margin += a.marginInr;
    tkm += a.tkm;
    trips += a.trips;
    const v = vehById.get(a.vehicleId);
    if (v) {
      const speed = v.avgSpeedKmh;
      // Round trip plus 1.6 h of loading and unloading per trip.
      vehicleHours += a.trips * ((2 * a.distanceKm) / speed + 1.6);
      transportEmissions +=
        (v.dieselLPerKm * a.distanceKm * 1.78 * a.trips * 3.29) / 1000;
    }
  }

  const fleetCapacityHours = net.vehicles.reduce(
    (s, v) => s + v.fleetSize * v.shiftHours * net.assumptions.windowDays,
    0,
  );
  const vehicleDaysUsed = vehicleHours / 10;
  const fleetCapacityDays = fleetCapacityHours / 10;

  const processEmissions = Math.max(0, emitted - transportEmissions);
  const carbonRevenue =
    durable * net.assumptions.cdrPriceInrPerT +
    Math.max(0, avoided) * net.assumptions.vcmPriceInrPerT;

  return {
    suppliedT,
    divertedT,
    strandedT: Math.max(0, suppliedT - divertedT),
    divertedPct: suppliedT > 0 ? (divertedT / suppliedT) * 100 : 0,
    durableRemovalT: durable,
    avoidedEmissionsT: avoided,
    transportEmissionsT: transportEmissions,
    processEmissionsT: processEmissions,
    netCarbonT: net_,
    revenueInr: revenue,
    feedstockCostInr: 0,
    transportCostInr: 0,
    processingCostInr: cost,
    carbonRevenueInr: carbonRevenue,
    marginInr: margin,
    tkm,
    vehicleTrips: trips,
    vehicleDaysUsed,
    fleetUtilisationPct: fleetCapacityDays > 0 ? (vehicleDaysUsed / fleetCapacityDays) * 100 : 0,
    marginPerTonneInr: divertedT > 0 ? margin / divertedT : 0,
    abatementCostInrPerTco2e: Math.abs(net_) > 1e-6 ? -margin / net_ : 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shadow prices
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Marginal value of facility capacity, measured by re-optimisation.
 *
 * For each facility close to its limit we add one tonne per day of headroom and
 * re-solve the whole network. The objective difference is the true marginal value:
 * it accounts for every knock-on reallocation, which an LP dual read off a single
 * basis would not do once binary facility decisions are in play.
 *
 * This is the number an operator can act on directly — it answers "where is the
 * next rupee of capital worth spending?" rather than "what is utilisation?".
 */
export function computeShadowPrices(
  net: NetworkState,
  arcSet: ArcSet,
  values: number[],
  node: BnbNode,
  baseOutcome: SolveOutcome,
  mode: ObjectiveMode,
  baseTotals: NetworkTotals,
): ShadowPrice[] {
  const windowDays = net.assumptions.windowDays;
  const out: ShadowPrice[] = [];
  const deltaTpd = 1;
  const deltaT = deltaTpd * windowDays;

  for (let j = 0; j < net.facilities.length; j++) {
    const f = net.facilities[j];
    const capacityWindow = f.capacityTpd * f.availability * windowDays;
    const load = baseOutcome.facilityLoad[j] ?? 0;
    const utilisation = capacityWindow > 0 ? (load / capacityWindow) * 100 : 0;
    const binding = capacityWindow > 0 && load >= capacityWindow - 1;

    let valuePerExtraTonne = 0;
    let carbonPerExtraTonne = 0;
    let marginPerExtraTonne = 0;

    if (binding) {
      const override = new Map<number, number>([[j, deltaT]]);
      const bumped = solveNode(net, arcSet, values, node, override);
      valuePerExtraTonne = (bumped.value - baseOutcome.value) / deltaT;

      // Report the marginal value in units an operator can act on, not just in
      // scaled objective points. Both are measured from the re-solve, so they
      // include every knock-on reallocation the extra capacity causes.
      const bumpedTotals = computeTotals(net, materialiseAllocations(net, arcSet, bumped.flow));
      carbonPerExtraTonne = (bumpedTotals.netCarbonT - baseTotals.netCarbonT) / deltaT;
      marginPerExtraTonne = (bumpedTotals.marginInr - baseTotals.marginInr) / deltaT;
    }

    out.push({
      facilityId: f.id,
      facilityName: f.name,
      // Convert the scaled objective back into the unit the mode is denominated in.
      valuePerExtraTonne: unscaleObjective(valuePerExtraTonne, mode, arcSet),
      unit: objectiveUnit(mode),
      carbonPerExtraTonne,
      marginPerExtraTonne,
      binding,
      utilisationPct: utilisation,
    });
  }

  return out.sort((a, b) => b.valuePerExtraTonne - a.valuePerExtraTonne);
}

function unscaleObjective(v: number, mode: ObjectiveMode, arcSet: ArcSet): number {
  const sc = objectiveScale(arcSet.arcs);
  switch (mode) {
    case 'carbon_first':
      return (v / OBJ_SCALE_INT) * sc.maxCarbon;
    case 'profit_first':
      return (v / OBJ_SCALE_INT) * sc.maxMargin;
    default:
      return v / OBJ_SCALE_INT;
  }
}

export function objectiveUnit(mode: ObjectiveMode): string {
  switch (mode) {
    case 'carbon_first':
      return 'tCO₂e per extra tonne of capacity';
    case 'profit_first':
      return '₹ per extra tonne of capacity';
    default:
      return 'objective points per extra tonne';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Alternatives the optimiser rejected
// ─────────────────────────────────────────────────────────────────────────────

function compareAlternatives(
  net: NetworkState,
  arcSet: ArcSet,
  values: number[],
  bestValue: number,
): RejectedAlternative[] {
  const out: RejectedAlternative[] = [];
  const windowDays = net.assumptions.windowDays;

  const scoreFlow = (flow: number[][]): number => {
    let v = 0;
    for (let i = 0; i < arcSet.bySource.length; i++) {
      for (let k = 0; k < arcSet.bySource[i].length; k++) {
        v += (flow[i][k] ?? 0) * values[arcSet.bySource[i][k].arcIndex];
      }
    }
    return v;
  };

  // 1. Status quo: send every lot to its nearest feasible facility with room.
  const nearest = nearestFeasibleAllocation(net, arcSet);
  const nearestValue = scoreFlow(nearest);
  out.push({
    label: 'Nearest-facility heuristic (status quo operating practice)',
    objectiveValue: nearestValue,
    deltaVsBest: bestValue !== 0 ? ((nearestValue - bestValue) / Math.abs(bestValue)) * 100 : 0,
    reason:
      'What an operator does today: each lot goes to the closest site that will take it. Minimises haul but ignores pathway value and capacity contention.',
  });

  // 2. Single-pathway configurations.
  const pathwaySet = new Set(net.facilities.map((f) => f.pathway));
  for (const pw of pathwaySet) {
    const closed = new Set<number>();
    net.facilities.forEach((f, j) => {
      if (f.pathway !== pw) closed.add(j);
    });
    if (closed.size === net.facilities.length) continue;
    const outcome = solveNode(
      net,
      arcSet,
      values,
      { closed, forcedOpen: new Set(), bound: Infinity, depth: 0 },
      null,
    );
    out.push({
      label: `${PATHWAYS[pw].short}-only network`,
      objectiveValue: outcome.value,
      deltaVsBest:
        bestValue !== 0 ? ((outcome.value - bestValue) / Math.abs(bestValue)) * 100 : 0,
      reason: `Restricting the whole network to ${PATHWAYS[pw].label.toLowerCase()} strands feedstock that this pathway cannot accept.`,
    });
  }

  void windowDays;
  return out.sort((a, b) => b.objectiveValue - a.objectiveValue);
}

/**
 * The baseline every result is compared against: nearest feasible facility with
 * remaining capacity, processed greedily by lot size. This is genuinely what
 * happens in the field today, which makes it the honest comparator.
 */
export function nearestFeasibleAllocation(net: NetworkState, arcSet: ArcSet): number[][] {
  const windowDays = net.assumptions.windowDays;
  const remaining = net.facilities.map((f) =>
    f.status === 'offline' ? 0 : f.capacityTpd * f.availability * windowDays,
  );
  const flow: number[][] = arcSet.bySource.map((row) => new Array(row.length).fill(0));

  const order = net.sources
    .map((s, i) => ({ i, t: s.availableT }))
    .sort((a, b) => b.t - a.t);

  for (const { i } of order) {
    let left = net.sources[i].availableT;
    const candidates = arcSet.bySource[i]
      .map((r, k) => ({ k, facility: r.facility, d: arcSet.arcs[r.arcIndex].distanceKm }))
      .sort((a, b) => a.d - b.d);
    for (const c of candidates) {
      if (left <= 0.5) break;
      const take = Math.min(left, remaining[c.facility]);
      if (take <= 0.5) continue;
      flow[i][c.k] = take;
      remaining[c.facility] -= take;
      left -= take;
    }
  }
  return flow;
}

/** Runs the nearest-facility baseline end to end, for before/after comparisons. */
export function baselineResult(net: NetworkState, mode: ObjectiveMode): OptimizationResult {
  const arcSet = buildArcs(net);
  const sc = objectiveScale(arcSet.arcs);
  const values = arcSet.arcs.map((a) => arcValue(a, mode, sc));
  const flow = nearestFeasibleAllocation(net, arcSet);
  const allocations = materialiseAllocations(net, arcSet, flow);
  const totals = computeTotals(net, allocations);
  const open = new Set(allocations.map((a) => a.facilityId));

  let value = 0;
  for (let i = 0; i < arcSet.bySource.length; i++) {
    for (let k = 0; k < arcSet.bySource[i].length; k++) {
      value += (flow[i][k] ?? 0) * values[arcSet.bySource[i][k].arcIndex];
    }
  }

  return {
    objective: mode,
    allocations,
    openFacilities: [...open],
    idleFacilities: net.facilities.filter((f) => !open.has(f.id)).map((f) => f.id),
    totals,
    telemetry: {
      arcsGenerated: arcSet.generated,
      arcsFeasible: arcSet.arcs.length,
      arcsRejected: arcSet.rejected,
      candidateConfigurations: 1,
      bnbNodesExplored: 0,
      bnbNodesPruned: 0,
      mcfIterations: 0,
      lpBound: value,
      incumbent: value,
      gapPct: 0,
      provenOptimal: false,
      solveMs: 0,
      stages: [],
    },
    shadowPrices: [],
    rejectedAlternatives: [],
    windowDays: net.assumptions.windowDays,
    seed: net.assumptions.seed,
  };
}

export { PATHWAYS };
export type { Facility };
