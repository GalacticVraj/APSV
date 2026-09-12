/**
 * Optimiser tests.
 *
 * Constraints are only real if they are tested. Everything here asserts a
 * property of the *solution*, not of the code that produced it: capacity is never
 * exceeded, supply is never double-allocated, a plant never runs below its
 * minimum viable feed, and the same seed produces the same answer.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNetwork, cloneNetwork } from '../src/network.ts';
import {
  arcValue,
  baselineResult,
  buildArcs,
  computeTotals,
  nearestFeasibleAllocation,
  materialiseAllocations,
  objectiveScale,
  optimize,
} from '../src/optimizer.ts';
import { MinCostFlow, solveTransport } from '../src/mincostflow.ts';
import { PATHWAYS, suitability } from '../src/pathways.ts';
import { STREAMS } from '../src/streams.ts';
import type { ObjectiveMode } from '../src/types.ts';

const MODES: ObjectiveMode[] = ['carbon_first', 'profit_first', 'balanced', 'logistics_first'];

const solveAll = () => {
  const net = buildNetwork();
  return MODES.map((m) => ({ mode: m, net, result: optimize(net, m) }));
};

// ─────────────────────────────────────────────────────────────────────────────
// Hard constraints
// ─────────────────────────────────────────────────────────────────────────────

test('no facility ever receives more than its capacity', () => {
  for (const { mode, net, result } of solveAll()) {
    const load = new Map<string, number>();
    for (const a of result.allocations) {
      load.set(a.facilityId, (load.get(a.facilityId) ?? 0) + a.tonnes);
    }
    for (const f of net.facilities) {
      const cap = f.capacityTpd * f.availability * net.assumptions.windowDays;
      const l = load.get(f.id) ?? 0;
      assert.ok(
        l <= cap + 1,
        `${mode}: ${f.name} received ${l} t against a capacity of ${cap} t`,
      );
    }
  }
});

test('no source ever ships more than it has available', () => {
  for (const { mode, net, result } of solveAll()) {
    const out = new Map<string, number>();
    for (const a of result.allocations) {
      out.set(a.sourceId, (out.get(a.sourceId) ?? 0) + a.tonnes);
    }
    for (const s of net.sources) {
      const shipped = out.get(s.id) ?? 0;
      assert.ok(
        shipped <= s.availableT + 1,
        `${mode}: ${s.name} shipped ${shipped} t but only ${s.availableT} t was available`,
      );
    }
  }
});

test('a facility either meets its minimum viable feed or does not run at all', () => {
  for (const { mode, net, result } of solveAll()) {
    const load = new Map<string, number>();
    for (const a of result.allocations) {
      load.set(a.facilityId, (load.get(a.facilityId) ?? 0) + a.tonnes);
    }
    for (const f of net.facilities) {
      const l = load.get(f.id) ?? 0;
      if (l <= 0.5) continue;
      const minFeed = f.minFeedTpd * net.assumptions.windowDays;
      assert.ok(
        l >= minFeed - 1,
        `${mode}: ${f.name} runs at ${l} t, below its minimum viable feed of ${minFeed} t`,
      );
    }
  }
});

test('every allocation respects the pathway gates of its destination', () => {
  for (const { mode, net, result } of solveAll()) {
    for (const a of result.allocations) {
      const fac = net.facilities.find((f) => f.id === a.facilityId);
      assert.ok(fac, 'allocation must reference a real facility');
      const suit = suitability(STREAMS[a.stream], PATHWAYS[fac!.pathway]);
      assert.ok(
        suit.feasible,
        `${mode}: ${a.stream} routed to ${fac!.pathway}, which its ${suit.limitingFactor} gate forbids`,
      );
    }
  }
});

test('no allocation exceeds the maximum economic haul distance', () => {
  for (const { mode, net, result } of solveAll()) {
    for (const a of result.allocations) {
      assert.ok(
        a.distanceKm <= net.assumptions.maxHaulKm + 0.001,
        `${mode}: ${a.distanceKm} km haul exceeds the ${net.assumptions.maxHaulKm} km limit`,
      );
    }
  }
});

test('an offline facility receives nothing', () => {
  const net = cloneNetwork(buildNetwork());
  const target = net.facilities[0];
  target.status = 'offline';
  target.availability = 0;

  const result = optimize(net, 'balanced');
  const got = result.allocations.filter((a) => a.facilityId === target.id);
  assert.equal(got.length, 0, `${target.name} is offline but received ${got.length} flows`);
});

test('a facility not permitted for a stream never receives it', () => {
  const net = buildNetwork();
  const restricted = net.facilities.filter((f) => f.acceptedStreams.length > 0);
  assert.ok(restricted.length > 0, 'the fixture should contain at least one restricted site');

  const result = optimize(net, 'balanced');
  for (const f of restricted) {
    for (const a of result.allocations.filter((x) => x.facilityId === f.id)) {
      assert.ok(
        f.acceptedStreams.includes(a.stream),
        `${f.name} is not permitted for ${a.stream} but received it`,
      );
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Optimality and determinism
// ─────────────────────────────────────────────────────────────────────────────

test('the same seed produces an identical solution', () => {
  const a = optimize(buildNetwork(), 'balanced');
  const b = optimize(buildNetwork(), 'balanced');

  assert.equal(a.allocations.length, b.allocations.length);
  assert.equal(a.totals.divertedT, b.totals.divertedT);
  assert.equal(a.totals.netCarbonT, b.totals.netCarbonT);
  assert.equal(a.totals.marginInr, b.totals.marginInr);
  assert.deepEqual(a.openFacilities.slice().sort(), b.openFacilities.slice().sort());
});

test('the incumbent never exceeds the LP relaxation bound', () => {
  for (const { mode, result } of solveAll()) {
    assert.ok(
      result.telemetry.incumbent <= result.telemetry.lpBound + 1,
      `${mode}: incumbent ${result.telemetry.incumbent} exceeds its own bound ${result.telemetry.lpBound}`,
    );
    assert.ok(result.telemetry.gapPct >= -1e-9, `${mode}: negative gap reported`);
  }
});

test('the optimiser beats the status-quo heuristic on its own objective', () => {
  const net = buildNetwork();
  for (const mode of MODES) {
    const optimised = optimize(net, mode);
    const arcs = buildArcs(net);
    const sc = objectiveScale(arcs.arcs);
    const values = arcs.arcs.map((a) => arcValue(a, mode, sc));

    const heuristicFlow = nearestFeasibleAllocation(net, arcs);
    let heuristicValue = 0;
    for (let i = 0; i < arcs.bySource.length; i++) {
      for (let k = 0; k < arcs.bySource[i].length; k++) {
        heuristicValue += (heuristicFlow[i][k] ?? 0) * values[arcs.bySource[i][k].arcIndex];
      }
    }

    assert.ok(
      optimised.telemetry.incumbent >= heuristicValue,
      `${mode}: optimiser scored ${optimised.telemetry.incumbent} against heuristic ${heuristicValue}`,
    );
  }
});

test('carbon-first delivers more carbon and profit-first delivers more margin', () => {
  const net = buildNetwork();
  const carbon = optimize(net, 'carbon_first');
  const profit = optimize(net, 'profit_first');

  assert.ok(
    carbon.totals.netCarbonT > profit.totals.netCarbonT,
    `carbon-first (${carbon.totals.netCarbonT}) should beat profit-first (${profit.totals.netCarbonT}) on carbon`,
  );
  assert.ok(
    profit.totals.marginInr > carbon.totals.marginInr,
    `profit-first (${profit.totals.marginInr}) should beat carbon-first (${carbon.totals.marginInr}) on margin`,
  );
});

test('logistics-first moves less freight than carbon-first', () => {
  const net = buildNetwork();
  const logistics = optimize(net, 'logistics_first');
  const carbon = optimize(net, 'carbon_first');
  assert.ok(
    logistics.totals.tkm < carbon.totals.tkm,
    `logistics-first tkm ${logistics.totals.tkm} should be below carbon-first ${carbon.totals.tkm}`,
  );
});

test('shadow prices are reported only for binding constraints and are non-negative', () => {
  const net = buildNetwork();
  const result = optimize(net, 'profit_first');
  for (const sp of result.shadowPrices) {
    if (!sp.binding) {
      assert.equal(sp.valuePerExtraTonne, 0, `${sp.facilityName}: non-binding yet priced`);
      assert.equal(sp.carbonPerExtraTonne, 0);
      assert.equal(sp.marginPerExtraTonne, 0);
    } else {
      assert.ok(
        sp.utilisationPct > 95,
        `${sp.facilityName}: flagged binding at only ${sp.utilisationPct}% utilisation`,
      );
      assert.ok(
        sp.valuePerExtraTonne >= -1e-6,
        `${sp.facilityName}: extra capacity cannot make the objective worse`,
      );
    }
  }
  assert.ok(
    result.shadowPrices.some((s) => s.binding),
    'this network is capacity-tight; at least one constraint must bind',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Totals
// ─────────────────────────────────────────────────────────────────────────────

test('diverted plus stranded equals total supply', () => {
  for (const { mode, net, result } of solveAll()) {
    const T = result.totals;
    const supply = net.sources.reduce((s, x) => s + x.availableT, 0);
    assert.ok(Math.abs(T.suppliedT - supply) < 1, `${mode}: supply mismatch`);
    assert.ok(
      Math.abs(T.divertedT + T.strandedT - supply) < 2,
      `${mode}: ${T.divertedT} + ${T.strandedT} != ${supply}`,
    );
  }
});

test('totals are the sum of their allocations', () => {
  const net = buildNetwork();
  const result = optimize(net, 'balanced');
  const T = computeTotals(net, result.allocations);

  const carbon = result.allocations.reduce((s, a) => s + a.netCarbonT, 0);
  const margin = result.allocations.reduce((s, a) => s + a.marginInr, 0);
  assert.ok(Math.abs(T.netCarbonT - carbon) < 1e-6);
  assert.ok(Math.abs(T.marginInr - margin) < 1e-3);
});

// ─────────────────────────────────────────────────────────────────────────────
// Min-cost flow itself
// ─────────────────────────────────────────────────────────────────────────────

test('min-cost flow finds the known optimum on a hand-checked instance', () => {
  // Two sources of 10 t each, two sinks of 10 t each.
  // Values:  s0->f0 = 5, s0->f1 = 1, s1->f0 = 4, s1->f1 = 3
  // Greedy by best arc takes s0->f0 (5) then s1->f1 (3) = 80.
  // That is also optimal here: the alternative is s0->f1 + s1->f0 = 1+4 = 50.
  const sol = solveTransport({
    supplies: [10, 10],
    capacities: [10, 10],
    lowerBounds: [0, 0],
    arcs: [
      [
        { facility: 0, value: 5 },
        { facility: 1, value: 1 },
      ],
      [
        { facility: 0, value: 4 },
        { facility: 1, value: 3 },
      ],
    ],
  });
  assert.equal(sol.value, 80);
  assert.equal(sol.flow[0][0], 10);
  assert.equal(sol.flow[1][1], 10);
});

test('min-cost flow leaves negative-value arcs unused', () => {
  const sol = solveTransport({
    supplies: [10],
    capacities: [10],
    lowerBounds: [0],
    arcs: [[{ facility: 0, value: -7 }]],
  });
  assert.equal(sol.value, 0, 'a loss-making arc must not be used');
  assert.equal(sol.unallocated[0], 10, 'the material stays where it is');
});

test('min-cost flow honours a lower bound when one is imposed', () => {
  const sol = solveTransport({
    supplies: [10],
    capacities: [10],
    lowerBounds: [6],
    arcs: [[{ facility: 0, value: -7 }]],
  });
  assert.ok(sol.lowerBoundsMet[0], 'the forced minimum must be met');
  assert.ok(sol.flow[0][0] >= 6, `expected at least 6 t forced through, got ${sol.flow[0][0]}`);
});

test('min-cost flow respects capacity on a contended sink', () => {
  const sol = solveTransport({
    supplies: [10, 10],
    capacities: [12],
    lowerBounds: [0],
    arcs: [[{ facility: 0, value: 5 }], [{ facility: 0, value: 5 }]],
  });
  const total = sol.flow[0][0] + sol.flow[1][0];
  assert.equal(total, 12, `sink took ${total} t against a capacity of 12 t`);
  assert.equal(sol.value, 60);
});

test('the flow conservation invariant holds in the raw solver', () => {
  const mcf = new MinCostFlow(4);
  mcf.addEdge(0, 1, 10, 0);
  mcf.addEdge(0, 2, 10, 0);
  mcf.addEdge(1, 3, 6, -5);
  mcf.addEdge(2, 3, 8, -2);
  const { flow } = mcf.run(0, 3);
  assert.equal(flow, 14, 'max flow should saturate both sink arcs');

  // Every node except source and sink must balance.
  for (let v = 1; v <= 2; v++) {
    let net = 0;
    for (const ei of mcf.graph[v]) {
      const e = mcf.edges[ei];
      if (ei % 2 === 0) net -= e.flow;
      else net += mcf.edges[ei ^ 1].flow;
    }
    assert.ok(Math.abs(net) < 1e-9, `node ${v} does not conserve flow`);
  }
});

test('the baseline heuristic is feasible even though it is not optimal', () => {
  const net = buildNetwork();
  const base = baselineResult(net, 'balanced');
  const load = new Map<string, number>();
  for (const a of base.allocations) {
    load.set(a.facilityId, (load.get(a.facilityId) ?? 0) + a.tonnes);
  }
  for (const f of net.facilities) {
    const cap = f.capacityTpd * f.availability * net.assumptions.windowDays;
    assert.ok((load.get(f.id) ?? 0) <= cap + 1, `${f.name} over capacity in the baseline`);
  }
});

test('arc generation rejects nothing silently', () => {
  const net = buildNetwork();
  const arcs = buildArcs(net);
  const rejected = Object.values(arcs.rejected).reduce((s, v) => s + v, 0);
  assert.equal(
    arcs.generated,
    arcs.arcs.length + rejected,
    'every examined pair must be either retained or counted as rejected',
  );
});
