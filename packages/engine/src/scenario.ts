/**
 * The scenario shock engine.
 *
 * A digital twin that only ever shows the plan is a picture. The thing that makes
 * it an operating system is the ability to ask "what if this breaks?" and get the
 * whole network re-solved, with the *reasons* the answer changed.
 *
 * A scenario is a set of mutations to network state. Applying one produces a new
 * state, which is re-optimised from scratch — nothing is patched incrementally, so
 * the after-state is exactly what the optimiser would have produced had the world
 * always looked that way. The diff between the two is then attributed flow by flow.
 */

import type {
  Allocation,
  FlowChange,
  NetworkState,
  ObjectiveMode,
  OptimizationResult,
  ScenarioDef,
  ScenarioDelta,
  ScenarioInstance,
  ScenarioResult,
  SolveStage,
  StreamId,
} from './types.ts';
import { cloneNetwork } from './network.ts';
import { networkLedger, OWN_BASIS } from './carbon.ts';
import { optimize } from './optimizer.ts';
import { detectBottlenecks } from './bottleneck.ts';
import { STREAMS } from './streams.ts';
import { PATHWAYS } from './pathways.ts';
import { OBJECTIVE_META } from './constants.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Definitions
// ─────────────────────────────────────────────────────────────────────────────

export function scenarioDefs(net: NetworkState): ScenarioDef[] {
  const facilityChoices = net.facilities.map((f) => ({
    value: f.id,
    label: `${f.name} (${PATHWAYS[f.pathway].short}, ${f.capacityTpd} t/day)`,
  }));
  const streamChoices = (Object.keys(STREAMS) as StreamId[]).map((s) => ({
    value: s,
    label: STREAMS[s].label,
  }));
  const districtChoices = [...new Set(net.sources.map((s) => s.district))]
    .sort()
    .map((d) => ({ value: d, label: d }));

  return [
    {
      kind: 'facility_offline',
      label: 'Facility outage',
      category: 'disruption',
      description:
        'A processing plant stops accepting feedstock — unplanned shutdown, permit suspension or a major breakdown. The network must find somewhere else for everything it was taking.',
      demoHeadline: 'Take a plant offline and watch the network re-route itself.',
      params: [
        {
          key: 'facilityId',
          label: 'Facility',
          type: 'choice',
          choices: facilityChoices,
          defaultValue: net.facilities[0]?.id ?? '',
        },
      ],
    },
    {
      kind: 'facility_derate',
      label: 'Capacity derating',
      category: 'disruption',
      description:
        'A plant keeps running but at reduced throughput — a failed line, a feedstock quality problem, or a partial permit restriction.',
      demoHeadline: 'Cut a plant to half capacity and see what gets displaced first.',
      params: [
        {
          key: 'facilityId',
          label: 'Facility',
          type: 'choice',
          choices: facilityChoices,
          defaultValue: net.facilities[0]?.id ?? '',
        },
        {
          key: 'availability',
          label: 'Remaining availability',
          type: 'number',
          min: 0,
          max: 100,
          step: 5,
          unit: '%',
          defaultValue: 50,
        },
      ],
    },
    {
      kind: 'supply_surge',
      label: 'Supply surge',
      category: 'supply',
      description:
        'More feedstock arrives than planned — an early harvest, a burning ban that suddenly makes residue available, or a neighbouring district joining the scheme.',
      demoHeadline: 'A burning ban puts 40% more straw on the market overnight.',
      params: [
        {
          key: 'stream',
          label: 'Stream',
          type: 'choice',
          choices: streamChoices,
          defaultValue: 'paddy_straw',
        },
        {
          key: 'changePct',
          label: 'Change in availability',
          type: 'number',
          min: -80,
          max: 200,
          step: 5,
          unit: '%',
          defaultValue: 40,
        },
      ],
    },
    {
      kind: 'supply_shortage',
      label: 'Supply shortfall',
      category: 'supply',
      description:
        'Less feedstock than planned — rain-delayed harvest, competing buyers, or farmers choosing to burn anyway.',
      demoHeadline: 'Rain delays the harvest and supply drops by a third.',
      params: [
        {
          key: 'stream',
          label: 'Stream',
          type: 'choice',
          choices: streamChoices,
          defaultValue: 'paddy_straw',
        },
        {
          key: 'changePct',
          label: 'Change in availability',
          type: 'number',
          min: -90,
          max: 0,
          step: 5,
          unit: '%',
          defaultValue: -35,
        },
      ],
    },
    {
      kind: 'fleet_shortage',
      label: 'Fleet shortage',
      category: 'disruption',
      description:
        'Vehicles become unavailable — a transporter strike, seasonal competition for trucks, or maintenance backlog.',
      demoHeadline: 'A transporter strike removes 40% of the truck fleet.',
      params: [
        {
          key: 'changePct',
          label: 'Change in fleet size',
          type: 'number',
          min: -90,
          max: 100,
          step: 5,
          unit: '%',
          defaultValue: -40,
        },
      ],
    },
    {
      kind: 'diesel_price',
      label: 'Diesel price move',
      category: 'market',
      description:
        'Fuel price change. Affects transport cost but not transport emissions, so it reshapes the economics without changing the carbon arithmetic.',
      demoHeadline: 'Diesel jumps to ₹120/litre and long hauls stop paying.',
      params: [
        {
          key: 'price',
          label: 'Diesel price',
          type: 'number',
          min: 50,
          max: 180,
          step: 1,
          unit: '₹/litre',
          defaultValue: 120,
        },
      ],
    },
    {
      kind: 'carbon_price',
      label: 'Carbon price move',
      category: 'market',
      description:
        'The durable-removal price moves. Because removal trades roughly twenty times above avoidance, this control decides whether pyrolysis or fossil displacement wins the network.',
      demoHeadline: 'Removal prices double and the network pivots to biochar.',
      params: [
        {
          key: 'cdrPrice',
          label: 'Durable CDR price',
          type: 'number',
          min: 0,
          max: 30000,
          step: 500,
          unit: '₹/tCO₂e',
          defaultValue: 21600,
        },
      ],
    },
    {
      kind: 'processing_cost',
      label: 'Processing cost shock',
      category: 'market',
      description:
        'Operating costs move across a pathway — power tariff change, labour, consumables or a maintenance cycle.',
      demoHeadline: 'Pyrolysis opex rises 30% and the biochar case narrows.',
      params: [
        {
          key: 'pathway',
          label: 'Pathway',
          type: 'choice',
          choices: Object.values(PATHWAYS).map((p) => ({ value: p.id, label: p.label })),
          defaultValue: 'pyrolysis_biochar',
        },
        {
          key: 'changePct',
          label: 'Change in opex',
          type: 'number',
          min: -50,
          max: 100,
          step: 5,
          unit: '%',
          defaultValue: 30,
        },
      ],
    },
    {
      kind: 'road_disruption',
      label: 'Transport disruption',
      category: 'disruption',
      description:
        'A district becomes hard to serve — flooding, a bridge closure or a protest blocking a corridor. Every arc out of that district is severed.',
      demoHeadline: 'Flooding cuts a district off from the network entirely.',
      params: [
        {
          key: 'district',
          label: 'District',
          type: 'choice',
          choices: districtChoices,
          defaultValue: districtChoices[0]?.value ?? '',
        },
      ],
    },
    {
      kind: 'new_facility',
      label: 'Commission new capacity',
      category: 'strategy',
      description:
        'Add throughput at an existing site. The right question is not whether more capacity helps, but whether it helps *here* — which the shadow prices already answer.',
      demoHeadline: 'Add 40 t/day where the shadow price says it is worth most.',
      params: [
        {
          key: 'facilityId',
          label: 'Site to expand',
          type: 'choice',
          choices: facilityChoices,
          defaultValue: net.facilities[0]?.id ?? '',
        },
        {
          key: 'addTpd',
          label: 'Additional capacity',
          type: 'number',
          min: 5,
          max: 300,
          step: 5,
          unit: 't/day',
          defaultValue: 40,
        },
      ],
    },
    {
      kind: 'seasonal_shift',
      label: 'Seasonal shift',
      category: 'supply',
      description:
        'Move the planning window to a different point in the crop calendar. Straw disappears, press mud appears, and the optimal network is a different network.',
      demoHeadline: 'Jump to the wheat harvest and watch the feedstock mix invert.',
      params: [
        {
          key: 'weeksAhead',
          label: 'Weeks ahead',
          type: 'number',
          min: -26,
          max: 40,
          step: 1,
          unit: 'weeks',
          defaultValue: 22,
        },
      ],
    },
    {
      kind: 'objective_change',
      label: 'Change objective',
      category: 'strategy',
      description:
        'Re-solve the same network under a different objective. Nothing physical changes; the answer does.',
      demoHeadline: 'Switch from profit to carbon and watch the straw change destination.',
      params: [
        {
          key: 'objective',
          label: 'Objective',
          type: 'choice',
          choices: (Object.keys(OBJECTIVE_META) as ObjectiveMode[]).map((k) => ({
            value: k,
            label: OBJECTIVE_META[k].label,
          })),
          defaultValue: 'carbon_first',
        },
      ],
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Application
// ─────────────────────────────────────────────────────────────────────────────

import { seasonalMultiplier } from './forecast.ts';

export interface AppliedScenario {
  state: NetworkState;
  objective: ObjectiveMode | null;
  label: string;
  affectedEntityIds: string[];
}

export function applyScenario(
  net: NetworkState,
  scenario: ScenarioInstance,
  currentObjective: ObjectiveMode,
): AppliedScenario {
  const state = cloneNetwork(net);
  const p = scenario.params;
  const affected: string[] = [];
  let label = '';
  let objective: ObjectiveMode | null = null;

  switch (scenario.kind) {
    case 'facility_offline': {
      const f = state.facilities.find((x) => x.id === p.facilityId);
      if (f) {
        f.status = 'offline';
        f.availability = 0;
        affected.push(f.id);
        label = `${f.name} offline`;
      }
      break;
    }
    case 'facility_derate': {
      const f = state.facilities.find((x) => x.id === p.facilityId);
      if (f) {
        const pct = Number(p.availability) / 100;
        f.availability = Math.max(0, Math.min(1, pct));
        f.status = pct <= 0 ? 'offline' : 'derated';
        affected.push(f.id);
        label = `${f.name} derated to ${Number(p.availability).toFixed(0)}%`;
      }
      break;
    }
    case 'supply_surge':
    case 'supply_shortage': {
      const stream = p.stream as StreamId;
      const mult = 1 + Number(p.changePct) / 100;
      for (const s of state.sources) {
        if (s.stream !== stream) continue;
        s.availableT = Math.max(0, s.availableT * mult);
        affected.push(s.id);
      }
      label = `${STREAMS[stream].label} availability ${Number(p.changePct) >= 0 ? '+' : ''}${Number(p.changePct)}%`;
      break;
    }
    case 'fleet_shortage': {
      const mult = 1 + Number(p.changePct) / 100;
      for (const v of state.vehicles) {
        v.fleetSize = Math.max(0, Math.round(v.fleetSize * mult));
      }
      label = `Fleet size ${Number(p.changePct) >= 0 ? '+' : ''}${Number(p.changePct)}%`;
      break;
    }
    case 'diesel_price': {
      state.assumptions.dieselPriceInrPerL = Number(p.price);
      label = `Diesel at ₹${Number(p.price)}/litre`;
      break;
    }
    case 'carbon_price': {
      state.assumptions.cdrPriceInrPerT = Number(p.cdrPrice);
      label = `Durable CDR at ₹${Number(p.cdrPrice).toLocaleString('en-IN')}/tCO₂e`;
      break;
    }
    case 'processing_cost': {
      const mult = 1 + Number(p.changePct) / 100;
      for (const f of state.facilities) {
        if (f.pathway !== p.pathway) continue;
        f.opexInrPerT = Math.max(0, f.opexInrPerT * mult);
        affected.push(f.id);
      }
      label = `${PATHWAYS[p.pathway as keyof typeof PATHWAYS].short} opex ${Number(p.changePct) >= 0 ? '+' : ''}${Number(p.changePct)}%`;
      break;
    }
    case 'road_disruption': {
      const district = String(p.district);
      const cut = state.sources.filter((s) => s.district === district);
      for (const s of cut) {
        affected.push(s.id);
        for (const f of state.facilities) {
          if (f.district === district) continue;
          state.blockedArcs.push({ sourceId: s.id, facilityId: f.id });
        }
      }
      label = `${district} corridor severed`;
      break;
    }
    case 'new_facility': {
      const f = state.facilities.find((x) => x.id === p.facilityId);
      if (f) {
        f.capacityTpd += Number(p.addTpd);
        f.status = f.status === 'offline' ? 'online' : f.status;
        f.availability = Math.max(f.availability, 1);
        affected.push(f.id);
        label = `${f.name} +${Number(p.addTpd)} t/day`;
      }
      break;
    }
    case 'seasonal_shift': {
      const weeks = Number(p.weeksAhead);
      const baseWeek = isoWeekOf(state.asOf);
      for (const s of state.sources) {
        const now = seasonalMultiplier(s.stream, baseWeek % 52);
        const then = seasonalMultiplier(s.stream, (((baseWeek + weeks) % 52) + 52) % 52);
        s.availableT = Math.max(0, (s.availableT * then) / Math.max(1e-6, now));
        affected.push(s.id);
      }
      const shifted = new Date(Date.parse(state.asOf + 'T00:00:00Z') + weeks * 7 * 86400000);
      state.asOf = shifted.toISOString().slice(0, 10);
      label = `Window shifted ${weeks >= 0 ? '+' : ''}${weeks} weeks to ${state.asOf}`;
      break;
    }
    case 'objective_change': {
      objective = p.objective as ObjectiveMode;
      label = `Objective set to ${OBJECTIVE_META[objective].label}`;
      break;
    }
  }

  state.appliedScenarios.push(scenario);
  return { state, objective: objective ?? currentObjective, label, affectedEntityIds: affected };
}

function isoWeekOf(iso: string): number {
  const d = new Date(Date.parse(iso + 'T00:00:00Z'));
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - start) / (7 * 86400000));
}

// ─────────────────────────────────────────────────────────────────────────────
// Running a scenario and diffing the result
// ─────────────────────────────────────────────────────────────────────────────

function keyOf(a: Allocation): string {
  return `${a.sourceId}|${a.facilityId}`;
}

export function diffFlows(
  net: NetworkState,
  before: OptimizationResult,
  after: OptimizationResult,
): FlowChange[] {
  const srcName = new Map(net.sources.map((s) => [s.id, s.name]));
  const facName = new Map(net.facilities.map((f) => [f.id, f.name]));

  const b = new Map<string, Allocation>();
  for (const a of before.allocations) b.set(keyOf(a), a);
  const af = new Map<string, Allocation>();
  for (const a of after.allocations) af.set(keyOf(a), a);

  // Group by source so we can recognise a genuine re-route rather than reporting
  // a drop and an unrelated add.
  const bySourceBefore = new Map<string, Allocation[]>();
  for (const a of before.allocations) {
    const l = bySourceBefore.get(a.sourceId) ?? [];
    l.push(a);
    bySourceBefore.set(a.sourceId, l);
  }
  const bySourceAfter = new Map<string, Allocation[]>();
  for (const a of after.allocations) {
    const l = bySourceAfter.get(a.sourceId) ?? [];
    l.push(a);
    bySourceAfter.set(a.sourceId, l);
  }

  const changes: FlowChange[] = [];
  const sourceIds = new Set([...bySourceBefore.keys(), ...bySourceAfter.keys()]);

  for (const sid of sourceIds) {
    const prev = bySourceBefore.get(sid) ?? [];
    const next = bySourceAfter.get(sid) ?? [];
    const prevFacs = new Set(prev.map((a) => a.facilityId));
    const nextFacs = new Set(next.map((a) => a.facilityId));

    const dropped = prev.filter((a) => !nextFacs.has(a.facilityId));
    const added = next.filter((a) => !prevFacs.has(a.facilityId));

    // Pair up drops with adds of similar size: that is a re-route.
    const usedAdds = new Set<number>();
    for (const d of dropped) {
      let bestIdx = -1;
      let bestGap = Infinity;
      added.forEach((a, idx) => {
        if (usedAdds.has(idx)) return;
        const gap = Math.abs(a.tonnes - d.tonnes);
        if (gap < bestGap) {
          bestGap = gap;
          bestIdx = idx;
        }
      });
      if (bestIdx >= 0 && bestGap < d.tonnes * 0.75) {
        const a = added[bestIdx];
        usedAdds.add(bestIdx);
        changes.push({
          sourceId: sid,
          sourceName: srcName.get(sid) ?? sid,
          fromFacilityId: d.facilityId,
          fromFacilityName: facName.get(d.facilityId) ?? d.facilityId,
          toFacilityId: a.facilityId,
          toFacilityName: facName.get(a.facilityId) ?? a.facilityId,
          tonnes: a.tonnes,
          changeType: 'rerouted',
          distanceDeltaKm: a.distanceKm - d.distanceKm,
          carbonDeltaT: a.netCarbonT - d.netCarbonT,
        });
      } else {
        changes.push({
          sourceId: sid,
          sourceName: srcName.get(sid) ?? sid,
          fromFacilityId: d.facilityId,
          fromFacilityName: facName.get(d.facilityId) ?? d.facilityId,
          toFacilityId: null,
          toFacilityName: null,
          tonnes: d.tonnes,
          changeType: 'dropped',
          distanceDeltaKm: -d.distanceKm,
          carbonDeltaT: -d.netCarbonT,
        });
      }
    }
    added.forEach((a, idx) => {
      if (usedAdds.has(idx)) return;
      changes.push({
        sourceId: sid,
        sourceName: srcName.get(sid) ?? sid,
        fromFacilityId: null,
        fromFacilityName: null,
        toFacilityId: a.facilityId,
        toFacilityName: facName.get(a.facilityId) ?? a.facilityId,
        tonnes: a.tonnes,
        changeType: 'added',
        distanceDeltaKm: a.distanceKm,
        carbonDeltaT: a.netCarbonT,
      });
    });

    // Same destination, different quantity.
    for (const a of next) {
      if (!prevFacs.has(a.facilityId)) continue;
      const prevA = b.get(keyOf(a));
      if (!prevA) continue;
      const delta = a.tonnes - prevA.tonnes;
      if (Math.abs(delta) < 25) continue;
      changes.push({
        sourceId: sid,
        sourceName: srcName.get(sid) ?? sid,
        fromFacilityId: a.facilityId,
        fromFacilityName: facName.get(a.facilityId) ?? a.facilityId,
        toFacilityId: a.facilityId,
        toFacilityName: facName.get(a.facilityId) ?? a.facilityId,
        tonnes: Math.abs(delta),
        changeType: delta > 0 ? 'increased' : 'decreased',
        distanceDeltaKm: 0,
        carbonDeltaT: a.netCarbonT - prevA.netCarbonT,
      });
    }
  }

  return changes.sort((a, b2) => b2.tonnes - a.tonnes);
}

/**
 * Before/after deltas for a scenario.
 *
 * Carbon lines come from `networkLedger()`, not from `OptimizationResult.totals`.
 * The optimiser's totals aggregate each allocation under its own permanence and
 * read about a tenth below the ledger; using them here made this screen report
 * +1,174 tCO₂e for the same capacity change that Carbon Opportunities measured at
 * +1,410. Two screens disagreeing about one change is the failure the whole
 * product is built to avoid, so the ledger is the only carbon source here.
 *
 * `net` is required for that: a ledger needs the facilities, vehicles and
 * assumptions the allocations were solved against.
 */
export function buildDeltas(
  net: NetworkState,
  before: OptimizationResult,
  after: OptimizationResult,
): ScenarioDelta[] {
  const mk = (
    key: string,
    label: string,
    unit: string,
    b: number,
    a: number,
    higherIsBetter: boolean,
  ): ScenarioDelta => ({
    key,
    label,
    unit,
    before: b,
    after: a,
    delta: a - b,
    deltaPct: Math.abs(b) > 1e-9 ? ((a - b) / Math.abs(b)) * 100 : 0,
    higherIsBetter,
  });

  const B = before.totals;
  const A = after.totals;
  // Whole plans on both sides, each on its own feedstock mix.
  const bL = networkLedger(
    before.allocations,
    net.facilities,
    net.vehicles,
    net.assumptions,
    OWN_BASIS,
  );
  const aL = networkLedger(
    after.allocations,
    net.facilities,
    net.vehicles,
    net.assumptions,
    OWN_BASIS,
  );

  return [
    mk('divertedT', 'Waste diverted', 't', B.divertedT, A.divertedT, true),
    mk('strandedT', 'Waste stranded', 't', B.strandedT, A.strandedT, false),
    mk('netCarbonT', 'Net carbon impact', 'tCO₂e', bL.netT, aL.netT, true),
    mk(
      'durableRemovalT',
      'Durable removal',
      'tCO₂e',
      bL.durableRemovalT,
      aL.durableRemovalT,
      true,
    ),
    mk(
      'avoidedEmissionsT',
      'Avoided emissions',
      'tCO₂e',
      bL.avoidedEmissionsT,
      aL.avoidedEmissionsT,
      true,
    ),
    mk(
      'transportEmissionsT',
      'Transport emissions',
      'tCO₂e',
      B.transportEmissionsT,
      A.transportEmissionsT,
      false,
    ),
    mk(
      'processEmissionsT',
      'Process emissions',
      'tCO₂e',
      B.processEmissionsT,
      A.processEmissionsT,
      false,
    ),
    mk('marginInr', 'Operating margin', '₹', B.marginInr, A.marginInr, true),
    mk('revenueInr', 'Revenue', '₹', B.revenueInr, A.revenueInr, true),
    mk('tkm', 'Transport burden', 't·km', B.tkm, A.tkm, false),
    mk('vehicleTrips', 'Vehicle trips', 'trips', B.vehicleTrips, A.vehicleTrips, false),
    mk(
      'marginPerTonneInr',
      'Margin per tonne',
      '₹/t',
      B.marginPerTonneInr,
      A.marginPerTonneInr,
      true,
    ),
  ];
}

export function runScenario(
  net: NetworkState,
  scenario: ScenarioInstance,
  mode: ObjectiveMode,
  before?: OptimizationResult,
): ScenarioResult {
  const stages: SolveStage[] = [];
  let t = Date.now();

  const baseResult = before ?? optimize(net, mode);
  stages.push({
    label: 'Establish baseline',
    detail: `Current plan: ${baseResult.totals.divertedT.toFixed(0)} t diverted, ${baseResult.totals.netCarbonT.toFixed(0)} tCO₂e net`,
    ms: Date.now() - t,
  });

  t = Date.now();
  const applied = applyScenario(net, scenario, mode);
  stages.push({
    label: 'Mutate network state',
    detail: applied.label || 'Scenario applied',
    ms: Date.now() - t,
  });

  t = Date.now();
  const afterResult = optimize(applied.state, applied.objective ?? mode);
  stages.push({
    label: 'Re-optimise from scratch',
    detail: `${afterResult.telemetry.bnbNodesExplored} branch-and-bound nodes, ${afterResult.telemetry.arcsFeasible} feasible arcs, gap ${afterResult.telemetry.gapPct.toFixed(2)}%`,
    ms: Date.now() - t,
  });

  t = Date.now();
  const flowChanges = diffFlows(applied.state, baseResult, afterResult);
  const deltas = buildDeltas(net, baseResult, afterResult);
  stages.push({
    label: 'Attribute the difference',
    detail: `${flowChanges.length} flow changes identified`,
    ms: Date.now() - t,
  });

  t = Date.now();
  const beforeBottlenecks = detectBottlenecks(net, baseResult);
  const afterBottlenecks = detectBottlenecks(applied.state, afterResult);
  const beforeIds = new Set(beforeBottlenecks.map((b) => b.id));
  const afterIds = new Set(afterBottlenecks.map((b) => b.id));
  const newBottlenecks = afterBottlenecks.filter((b) => !beforeIds.has(b.id));
  const resolvedBottleneckIds = beforeBottlenecks
    .filter((b) => !afterIds.has(b.id))
    .map((b) => b.id);
  stages.push({
    label: 'Re-scan for bottlenecks',
    detail: `${newBottlenecks.length} new, ${resolvedBottleneckIds.length} resolved`,
    ms: Date.now() - t,
  });

  return {
    scenario,
    label: applied.label,
    narrative: narrate(applied.label, baseResult, afterResult, flowChanges, deltas),
    before: baseResult,
    after: afterResult,
    deltas,
    flowChanges,
    newBottlenecks,
    resolvedBottleneckIds,
    affectedEntityIds: applied.affectedEntityIds,
    computeStages: stages,
  };
}

/**
 * Plain-language explanation of what changed and why.
 * Every sentence is generated from a computed quantity — nothing here is a
 * template phrase that could be true of any result.
 */
function narrate(
  label: string,
  before: OptimizationResult,
  after: OptimizationResult,
  flows: FlowChange[],
  deltas: ScenarioDelta[],
): string[] {
  const out: string[] = [];
  const get = (k: string) => deltas.find((d) => d.key === k);

  const carbon = get('netCarbonT');
  const margin = get('marginInr');
  const stranded = get('strandedT');
  const tkm = get('tkm');

  out.push(`Scenario applied: ${label}.`);

  const rerouted = flows.filter((f) => f.changeType === 'rerouted');
  const dropped = flows.filter((f) => f.changeType === 'dropped');
  const reroutedT = rerouted.reduce((s, f) => s + f.tonnes, 0);
  const droppedT = dropped.reduce((s, f) => s + f.tonnes, 0);

  if (reroutedT > 0) {
    const avgExtraKm =
      rerouted.reduce((s, f) => s + f.distanceDeltaKm, 0) / Math.max(1, rerouted.length);
    out.push(
      `${reroutedT.toFixed(0)} t across ${rerouted.length} flows found a new destination, at an average ${avgExtraKm >= 0 ? '+' : ''}${avgExtraKm.toFixed(0)} km per haul.`,
    );
  }
  if (droppedT > 0) {
    out.push(
      `${droppedT.toFixed(0)} t could not be re-placed anywhere in the network and is now stranded.`,
    );
  }

  if (carbon) {
    const dir = carbon.delta >= 0 ? 'rises' : 'falls';
    out.push(
      `Net carbon ${dir} by ${Math.abs(carbon.delta).toFixed(0)} tCO₂e (${carbon.deltaPct >= 0 ? '+' : ''}${carbon.deltaPct.toFixed(1)}%), from ${carbon.before.toFixed(0)} to ${carbon.after.toFixed(0)}.`,
    );
  }
  if (margin) {
    const dir = margin.delta >= 0 ? 'improves' : 'deteriorates';
    out.push(
      `Operating margin ${dir} by ₹${(Math.abs(margin.delta) / 1e5).toFixed(1)} lakh (${margin.deltaPct >= 0 ? '+' : ''}${margin.deltaPct.toFixed(1)}%).`,
    );
  }
  if (tkm && Math.abs(tkm.deltaPct) > 3) {
    out.push(
      `Transport burden ${tkm.delta > 0 ? 'increases' : 'decreases'} by ${Math.abs(tkm.deltaPct).toFixed(1)}% to ${(tkm.after / 1000).toFixed(0)}k tonne-kilometres.`,
    );
  }
  if (stranded && Math.abs(stranded.delta) > 50) {
    out.push(
      `Stranded feedstock ${stranded.delta > 0 ? 'rises' : 'falls'} by ${Math.abs(stranded.delta).toFixed(0)} t.`,
    );
  }

  const openBefore = new Set(before.openFacilities);
  const openAfter = new Set(after.openFacilities);
  const started = [...openAfter].filter((x) => !openBefore.has(x));
  const stopped = [...openBefore].filter((x) => !openAfter.has(x));
  if (started.length > 0 || stopped.length > 0) {
    out.push(
      `Operating set changes: ${started.length === 0 ? "no facilities" : started.length === 1 ? "one facility" : `${started.length} facilities`} start up and ${stopped.length === 0 ? "none" : stopped.length === 1 ? "one" : stopped.length} shut down.`,
    );
  }

  return out;
}
