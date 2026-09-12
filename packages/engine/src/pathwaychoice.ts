/**
 * The pathway decision.
 *
 * Not "here are five ways to treat waste" — that is a brochure. The question is
 * narrower and harder: given THIS material sitting at THIS source, and the network
 * as it currently stands, which feasible pathway produces the best carbon outcome,
 * and what is being given up by choosing it.
 *
 * Everything here is read from the optimiser's own arc set. `buildArcs` already
 * decides which source-facility pairs are legal, which pathway gates fail, which
 * vehicle can run the road, and what a tonne is worth in carbon and in rupees on
 * each arc. Re-deriving any of that would produce a second opinion that could
 * disagree with the plan the rest of the product is showing. So this module picks
 * among arcs the optimiser already generated, and builds the carbon breakdown from
 * `ArcSet.physical` through the same `buildLedger` the network ledger uses.
 *
 * One consistency note worth stating, because it looks like an inconsistency:
 * permanence here is computed from the material's OWN stream, because that is what
 * `buildArcs` does when it values an arc. The Carbon Ledger instead uses the
 * network's dominant biochar feedstock, because it is decomposing a finished
 * network total. Arc-level decisions and network-level decomposition legitimately
 * use different BC100 values, and the UI says so rather than hiding the difference.
 */

import { buildArcs, arcValue, objectiveScale, selectVehicle } from './optimizer.ts';
import {
  addToAggregate,
  buildLedger,
  emptyAggregate,
  permanenceFor,
} from './carbon.ts';
import { PATHWAYS, PATHWAY_IDS, suitability } from './pathways.ts';
import { STREAMS } from './streams.ts';
import { haversineKm, roadDistanceKm } from './geo.ts';
import type {
  Arc,
  CarbonLedger,
  NetworkState,
  ObjectiveMode,
  OptimizationResult,
  PathwayId,
  StreamId,
} from './types.ts';

export interface PathwayGate {
  gate: string;
  pass: boolean;
  detail: string;
}

export interface PathwayOption {
  pathway: PathwayId;
  label: string;
  short: string;
  maturity: string;
  producesDurableRemoval: boolean;

  /** does the material pass this pathway's feedstock gates at all */
  feasible: boolean;
  gates: PathwayGate[];
  blockedBy: string | null;
  /** 0..1 soft fit, above the hard gates */
  suitability: number;

  /**
   * Why no result could be produced even though the gates passed — no plant of
   * this type online, none that accepts the stream, none within haul range.
   * Null when a result exists.
   */
  unavailableReason: string | null;

  facility: {
    id: string;
    name: string;
    district: string;
    lat: number;
    lon: number;
    capacityTpd: number;
    efficiency: number;
    /** capacity in the window not already committed by the current plan, t */
    headroomT: number;
  } | null;

  route: {
    roadKm: number;
    straightKm: number;
    vehicleId: string;
    payloadT: number;
    trips: number;
  } | null;

  /** per tonne of feedstock, tCO2e */
  perT: {
    net: number;
    durable: number;
    avoided: number;
    substitution: number;
    emitted: number;
    transport: number;
    process: number;
  } | null;

  /** the full ledger for the material's available tonnage on this pathway */
  ledger: CarbonLedger | null;

  econ: { marginPerT: number; marginTotal: number } | null;

  /** tonnes the current plan actually sends from this source on this pathway */
  inPlanT: number;
}

export interface PathwayDecision {
  source: {
    id: string;
    name: string;
    district: string;
    state: string;
    lat: number;
    lon: number;
    telemetryAgeH: number;
  };
  stream: StreamId;
  streamLabel: string;
  availableT: number;
  lens: ObjectiveMode;

  /** feasible and resolvable first, ranked under the lens; then the rest */
  options: PathwayOption[];
  feasibleCount: number;
  resolvedCount: number;

  carbonBest: PathwayId | null;
  economicBest: PathwayId | null;
  lensBest: PathwayId | null;

  why: string;
  /** stated only when the carbon choice and the economic choice differ */
  tradeoff: string | null;
}

export interface PathwayDriver {
  key: string;
  label: string;
  fromValue: number;
  toValue: number;
  /** contribution to the change in net carbon per tonne */
  deltaT: number;
  detail: string;
}

export interface PathwayDiff {
  from: PathwayId;
  to: PathwayId;
  fromLabel: string;
  toLabel: string;
  netDeltaPerT: number;
  netDeltaTotal: number;
  marginDeltaTotal: number;
  drivers: PathwayDriver[];
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────

export interface MaterialCandidate {
  id: string;
  name: string;
  district: string;
  stream: StreamId;
  streamLabel: string;
  availableT: number;
}

/** Sources worth offering as a material context, largest availability first. */
export function materialCandidates(state: NetworkState): MaterialCandidate[] {
  return state.sources
    .map((s) => ({
      id: s.id,
      name: s.name,
      district: s.district,
      stream: s.stream,
      streamLabel: STREAMS[s.stream].label,
      availableT: s.availableT,
    }))
    .sort((a, b) => b.availableT - a.availableT);
}

/**
 * Why a pathway that passes its gates still has no usable destination.
 *
 * Reported per reason rather than as a single "unavailable", because the fix is
 * different in each case and the Carbon Manager is the person who has to make it.
 */
function unavailableReason(
  state: NetworkState,
  sourceId: string,
  pathway: PathwayId,
  stream: StreamId,
): string {
  const src = state.sources.find((s) => s.id === sourceId)!;
  const sites = state.facilities.filter((f) => f.pathway === pathway);
  if (sites.length === 0) return `The network operates no ${PATHWAYS[pathway].short.toLowerCase()} plant.`;

  const online = sites.filter((f) => f.status === 'online');
  if (online.length === 0) {
    return `All ${sites.length} ${PATHWAYS[pathway].short.toLowerCase()} plants are offline or under maintenance.`;
  }

  const accepting = online.filter((f) => f.acceptedStreams.includes(stream));
  if (accepting.length === 0) {
    return `No operating ${PATHWAYS[pathway].short.toLowerCase()} plant is permitted to accept ${STREAMS[stream].label.toLowerCase()}.`;
  }

  const inRange = accepting.filter(
    (f) =>
      roadDistanceKm(src, f, state.assumptions.circuityFactor, src.access) <=
      state.assumptions.maxHaulKm,
  );
  if (inRange.length === 0) {
    const nearest = Math.min(
      ...accepting.map((f) =>
        roadDistanceKm(src, f, state.assumptions.circuityFactor, src.access),
      ),
    );
    return `The nearest accepting plant is ${nearest.toFixed(0)} km away, beyond the ${state.assumptions.maxHaulKm} km maximum haul.`;
  }

  const blocked = new Set(state.blockedArcs.map((b) => `${b.sourceId}>${b.facilityId}`));
  if (inRange.every((f) => blocked.has(`${sourceId}>${f.id}`))) {
    return 'Every route to an accepting plant is currently blocked.';
  }

  if (!selectVehicle(src, 1, state.vehicles, state)) {
    return `No vehicle in the fleet is permitted on this site's ${src.access.replace(/_/g, ' ')} access road.`;
  }
  return 'No feasible route to an accepting plant in the current network.';
}

/**
 * Evaluates every pathway for one source's material.
 *
 * Returns null when the source does not exist. A source with nothing available is
 * still a valid answer — the gates and the reachability still tell the manager
 * something — so that case is reported rather than refused.
 */
export function pathwayDecision(
  state: NetworkState,
  result: OptimizationResult,
  sourceId: string,
  lens: ObjectiveMode,
): PathwayDecision | null {
  const src = state.sources.find((s) => s.id === sourceId);
  if (!src) return null;

  const stream = STREAMS[src.stream];
  const arcSet = buildArcs(state);
  const scale = objectiveScale(arcSet.arcs);

  // Committed load per facility in the current plan, so headroom is real.
  const committed = new Map<string, number>();
  for (const a of result.allocations) {
    committed.set(a.facilityId, (committed.get(a.facilityId) ?? 0) + a.tonnes);
  }

  // Arcs leaving this source, with their index so we can reach the physical row.
  const mine: Array<{ arc: Arc; index: number }> = [];
  arcSet.arcs.forEach((arc, index) => {
    if (arc.sourceId === sourceId) mine.push({ arc, index });
  });

  const options: PathwayOption[] = [];

  for (const pid of PATHWAY_IDS) {
    const def = PATHWAYS[pid];
    const suit = suitability(stream, def);
    const failed = suit.gates.find((g) => !g.pass);

    const base = {
      pathway: pid,
      label: def.label,
      short: def.short,
      maturity: def.maturity,
      producesDurableRemoval: def.producesDurableRemoval,
      feasible: suit.feasible,
      gates: suit.gates,
      blockedBy: suit.feasible ? null : failed ? `${failed.gate}: ${failed.detail}` : suit.limitingFactor,
      suitability: suit.score,
      inPlanT: result.allocations
        .filter((a) => a.sourceId === sourceId && a.pathway === pid)
        .reduce((x, a) => x + a.tonnes, 0),
    };

    if (!suit.feasible) {
      options.push({
        ...base,
        unavailableReason: null,
        facility: null,
        route: null,
        perT: null,
        ledger: null,
        econ: null,
      });
      continue;
    }

    const forPathway = mine.filter((m) => m.arc.pathway === pid);
    if (forPathway.length === 0) {
      options.push({
        ...base,
        unavailableReason: unavailableReason(state, sourceId, pid, src.stream),
        facility: null,
        route: null,
        perT: null,
        ledger: null,
        econ: null,
      });
      continue;
    }

    // The optimiser's own valuation picks the destination, under the chosen lens.
    let best = forPathway[0];
    let bestScore = arcValue(best.arc, lens, scale);
    for (const m of forPathway.slice(1)) {
      const v = arcValue(m.arc, lens, scale);
      if (v > bestScore) {
        best = m;
        bestScore = v;
      }
    }

    const arc = best.arc;
    const phys = arcSet.physical[best.index];
    const fac = state.facilities.find((f) => f.id === arc.facilityId)!;

    // The ledger for this material on this pathway, through the network's own
    // builder. Permanence from the material's own stream, matching how buildArcs
    // valued the arc in the first place.
    const agg = emptyAggregate();
    addToAggregate(agg, phys, src.availableT);
    const perm = def.producesDurableRemoval
      ? permanenceFor(src.stream, state.assumptions.soilTempC)
      : null;
    const ledger = buildLedger(agg, state.assumptions, perm, false);

    // Components come from the ledger, NOT from the arc. `Arc.avoidedPerT` is
    // `avoided + substitution` — a sound simplification for ranking arcs, but this
    // screen must keep removal, avoidance and substitution apart, and reading the
    // arc field here would report avoidance with substitution folded inside it and
    // then report substitution again alongside.
    const per = (v: number) => v / Math.max(1e-9, src.availableT);
    const lineSum = (pred: (k: string) => boolean) =>
      ledger.lines.filter((l) => pred(l.key)).reduce((x, l) => x + l.valueT, 0);

    const transportPerT = -per(lineSum((k) => k === 'em_transport' || k === 'em_aggregation'));
    const processPerT = -per(
      lineSum((k) => k.startsWith('em_') && k !== 'em_transport' && k !== 'em_aggregation'),
    );

    const capacityT = fac.capacityTpd * fac.availability * state.assumptions.windowDays;
    const headroomT = Math.max(0, capacityT - (committed.get(fac.id) ?? 0));

    options.push({
      ...base,
      unavailableReason: null,
      facility: {
        id: fac.id,
        name: fac.name,
        district: fac.district,
        lat: fac.lat,
        lon: fac.lon,
        capacityTpd: fac.capacityTpd,
        efficiency: fac.efficiency,
        headroomT,
      },
      route: {
        roadKm: arc.distanceKm,
        straightKm: haversineKm(src, fac),
        vehicleId: arc.vehicleId,
        payloadT: arc.payloadT,
        trips: Math.ceil(src.availableT / Math.max(0.1, arc.payloadT)),
      },
      perT: {
        // net is taken from the arc because that is the figure the optimiser
        // ranked on; it agrees with the ledger to machine precision, and a test
        // holds it there.
        net: arc.netCarbonPerT,
        durable: per(ledger.durableRemovalT),
        avoided: per(ledger.avoidedEmissionsT),
        substitution: per(ledger.substitutionT),
        emitted: per(ledger.emissionsT),
        transport: transportPerT,
        process: processPerT,
      },
      ledger,
      econ: {
        marginPerT: arc.marginInrPerT,
        marginTotal: arc.marginInrPerT * src.availableT,
      },
    });
  }

  const resolved = options.filter((o) => o.perT !== null);
  const carbonBest = pick(resolved, (o) => o.perT!.net);
  const economicBest = pick(resolved, (o) => o.econ!.marginPerT);
  const lensBest =
    lens === 'carbon_first' ? carbonBest : lens === 'profit_first' ? economicBest : pick(resolved, (o) => lensScore(o, lens));

  // Resolvable options first, ranked by the lens; then gated-but-unreachable;
  // then infeasible. Order encodes usefulness, not alphabet.
  const rank = (o: PathwayOption) => (o.perT ? 0 : o.feasible ? 1 : 2);
  options.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    if (a.perT && b.perT) return lensScore(b, lens) - lensScore(a, lens);
    return b.suitability - a.suitability;
  });

  return {
    source: {
      id: src.id,
      name: src.name,
      district: src.district,
      state: src.state,
      lat: src.lat,
      lon: src.lon,
      telemetryAgeH: src.telemetryAgeH,
    },
    stream: src.stream,
    streamLabel: stream.label,
    availableT: src.availableT,
    lens,
    options,
    feasibleCount: options.filter((o) => o.feasible).length,
    resolvedCount: resolved.length,
    carbonBest,
    economicBest,
    lensBest,
    why: composeWhy(resolved, carbonBest, src.availableT, stream.label),
    tradeoff: composeTradeoff(resolved, carbonBest, economicBest, src.availableT),
  };
}

function lensScore(o: PathwayOption, lens: ObjectiveMode): number {
  if (!o.perT || !o.econ) return -Infinity;
  switch (lens) {
    case 'carbon_first':
      return o.perT.net;
    case 'profit_first':
      return o.econ.marginPerT;
    case 'logistics_first':
      return o.route ? o.perT.net / Math.max(1, o.route.roadKm) : -Infinity;
    default:
      return o.perT.net;
  }
}

function pick(options: PathwayOption[], score: (o: PathwayOption) => number): PathwayId | null {
  let best: PathwayOption | null = null;
  for (const o of options) {
    if (!best || score(o) > score(best)) best = o;
  }
  return best ? best.pathway : null;
}

/**
 * Why the leading pathway leads.
 *
 * Built by comparing the winner against the runner-up on the components that
 * actually separate them, so the sentence changes when the numbers do.
 */
function composeWhy(
  resolved: PathwayOption[],
  carbonBest: PathwayId | null,
  availableT: number,
  streamLabel: string,
): string {
  if (resolved.length === 0) {
    return `No pathway can currently take this material, so there is no carbon outcome to compare.`;
  }
  const win = resolved.find((o) => o.pathway === carbonBest);
  if (!win || !win.perT) return 'No pathway produced a carbon result for this material.';

  const n = (v: number, dp = 2) =>
    Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: dp });

  if (resolved.length === 1) {
    return `${win.short} is the only pathway that can take this ${streamLabel.toLowerCase()}, at ${n(win.perT.net)} tCO₂e per tonne (${n(win.perT.net * availableT, 0)} tCO₂e over ${n(availableT, 0)} t).`;
  }

  const others = resolved.filter((o) => o.pathway !== carbonBest && o.perT);
  others.sort((a, b) => b.perT!.net - a.perT!.net);
  const second = others[0];

  let s = `${win.short} gives the highest net carbon for this material at ${n(win.perT.net)} tCO₂e per tonne`;
  if (second?.perT) {
    const gap = win.perT.net - second.perT.net;
    s += `, ${n(gap)} tCO₂e/t ahead of ${second.short}`;

    // Name only the component that actually explains the gap.
    const benefitGap =
      win.perT.durable + win.perT.avoided + win.perT.substitution -
      (second.perT.durable + second.perT.avoided + second.perT.substitution);
    const emissionGap = second.perT.emitted - win.perT.emitted;

    if (Math.abs(benefitGap) > Math.abs(emissionGap)) {
      const part =
        win.perT.durable > second.perT.durable + 1e-6
          ? 'the carbon it locks into char'
          : win.perT.substitution > second.perT.substitution + 1e-6
            ? 'the fossil energy it displaces'
            : 'the disposal emissions it avoids';
      s += `, because ${part} outweighs the difference`;
    } else if (emissionGap > 1e-6) {
      s += `, mostly because it emits ${n(emissionGap)} tCO₂e/t less in haulage and processing`;
    }
  }
  return s + '.';
}

function composeTradeoff(
  resolved: PathwayOption[],
  carbonBest: PathwayId | null,
  economicBest: PathwayId | null,
  availableT: number,
): string | null {
  if (!carbonBest || !economicBest || carbonBest === economicBest) return null;
  const c = resolved.find((o) => o.pathway === carbonBest);
  const e = resolved.find((o) => o.pathway === economicBest);
  if (!c?.perT || !e?.perT || !c.econ || !e.econ) return null;

  const carbonLost = (c.perT.net - e.perT.net) * availableT;
  const moneyGained = (e.econ.marginPerT - c.econ.marginPerT) * availableT;
  const n = (v: number, dp = 0) =>
    Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: dp });

  return `Choosing ${e.short} over ${c.short} earns ₹${n(moneyGained)} more on this material but gives up ${n(carbonLost)} tCO₂e — about ₹${n(moneyGained / Math.max(1e-9, carbonLost))} of margin per tonne of CO₂e forgone.`;
}

/**
 * What switching pathways actually changes.
 *
 * Only components that genuinely differ are reported. A driver list that always
 * names the same five things teaches the reader nothing.
 */
export function comparePathwayPair(
  decision: PathwayDecision,
  fromId: PathwayId,
  toId: PathwayId,
): PathwayDiff | null {
  const from = decision.options.find((o) => o.pathway === fromId);
  const to = decision.options.find((o) => o.pathway === toId);
  if (!from?.perT || !to?.perT || !from.econ || !to.econ) return null;

  const t = decision.availableT;
  const drivers: PathwayDriver[] = [];
  const push = (
    key: string,
    label: string,
    fromValue: number,
    toValue: number,
    detail: string,
    invert = false,
  ) => {
    const raw = toValue - fromValue;
    if (Math.abs(raw) < 1e-4) return;
    drivers.push({
      key,
      label,
      fromValue,
      toValue,
      deltaT: (invert ? -raw : raw) * t,
      detail,
    });
  };

  push('durable', 'Durable removal', from.perT.durable, to.perT.durable, 'Carbon locked into char');
  push('avoided', 'Avoided disposal', from.perT.avoided, to.perT.avoided, 'Emissions the counterfactual fate would have released');
  push('substitution', 'Fossil displacement', from.perT.substitution, to.perT.substitution, 'Fossil energy and nitrogen displaced by the products');
  push('transport', 'Transport emissions', from.perT.transport, to.perT.transport, 'Haulage and field aggregation', true);
  push('process', 'Processing emissions', from.perT.process, to.perT.process, 'Plant power, digester slip and windrow losses', true);

  drivers.sort((a, b) => Math.abs(b.deltaT) - Math.abs(a.deltaT));

  const netDeltaPerT = to.perT.net - from.perT.net;
  const n = (v: number, dp = 0) =>
    Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: dp });

  let summary = `Switching from ${from.short} to ${to.short} ${
    netDeltaPerT >= 0 ? 'raises' : 'reduces'
  } net carbon impact by ${n(Math.abs(netDeltaPerT) * t)} tCO₂e for this material (${n(Math.abs(netDeltaPerT), 2)} tCO₂e per tonne).`;

  // Facility and distance are consequences of the switch, so they are stated even
  // though they are not themselves carbon terms.
  const bits: string[] = [];
  if (from.facility && to.facility && from.facility.id !== to.facility.id) {
    bits.push(`the material now goes to ${to.facility.name} instead of ${from.facility.name}`);
  }
  if (from.route && to.route && Math.abs(to.route.roadKm - from.route.roadKm) >= 1) {
    const d = to.route.roadKm - from.route.roadKm;
    bits.push(`the haul ${d > 0 ? 'lengthens' : 'shortens'} by ${n(Math.abs(d))} km`);
  }
  if (bits.length) summary += ` In the network, ${bits.join(' and ')}.`;

  const lead = drivers[0];
  if (lead) {
    summary += ` The largest single driver is ${lead.label.toLowerCase()}, worth ${n(Math.abs(lead.deltaT))} tCO₂e ${lead.deltaT >= 0 ? 'in favour of' : 'against'} ${to.short}.`;
  }

  return {
    from: fromId,
    to: toId,
    fromLabel: from.short,
    toLabel: to.short,
    netDeltaPerT,
    netDeltaTotal: netDeltaPerT * t,
    marginDeltaTotal: (to.econ.marginPerT - from.econ.marginPerT) * t,
    drivers,
    summary,
  };
}
