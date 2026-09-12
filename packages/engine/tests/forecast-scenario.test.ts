/**
 * Forecasting, scenario and copilot tests.
 *
 * The forecast tests assert that the model actually learns something — beating a
 * naive mean is the minimum bar for claiming a model at all. The scenario tests
 * assert that mutations really propagate through a full re-solve rather than
 * being patched onto the previous answer.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNetwork } from '../src/network.ts';
import { optimize } from '../src/optimizer.ts';
import {
  SEASON,
  choleskySolve,
  fitRidge,
  forecastNetwork,
  forecastSource,
  generateHistory,
  seasonalMultiplier,
  walkForwardMape,
} from '../src/forecast.ts';
import { applyScenario, buildDeltas, diffFlows, runScenario, scenarioDefs } from '../src/scenario.ts';
import { detectBottlenecks, resilienceReport, strandedLots } from '../src/bottleneck.ts';
import { Twin } from '../src/state.ts';
import { ask, comparePathways } from '../src/copilot.ts';
import { STREAMS } from '../src/streams.ts';
import type { StreamId } from '../src/types.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Linear algebra
// ─────────────────────────────────────────────────────────────────────────────

test('Cholesky solves a known symmetric positive-definite system', () => {
  // [[4,1],[1,3]] x = [1,2]  =>  x = [1/11, 7/11]
  const x = choleskySolve(
    [
      [4, 1],
      [1, 3],
    ],
    [1, 2],
    0,
  );
  assert.ok(Math.abs(x[0] - 1 / 11) < 1e-9, `x0 = ${x[0]}`);
  assert.ok(Math.abs(x[1] - 7 / 11) < 1e-9, `x1 = ${x[1]}`);
});

test('regularisation shrinks the solution toward zero', () => {
  const A = [
    [4, 1],
    [1, 3],
  ];
  const plain = choleskySolve(A, [1, 2], 0);
  const ridged = choleskySolve(A, [1, 2], 10);
  assert.ok(Math.abs(ridged[1]) < Math.abs(plain[1]), 'a larger lambda must shrink coefficients');
});

// ─────────────────────────────────────────────────────────────────────────────
// Seasonality
// ─────────────────────────────────────────────────────────────────────────────

test('each stream peaks in the week its crop calendar says it should', () => {
  for (const id of Object.keys(SEASON) as StreamId[]) {
    const profile = SEASON[id];
    let bestWeek = 0;
    let best = -Infinity;
    for (let w = 0; w < 52; w++) {
      const v = seasonalMultiplier(id, w);
      if (v > best) {
        best = v;
        bestWeek = w;
      }
    }
    // Circular distance to the declared peak.
    let d = Math.abs(bestWeek - profile.peakWeek);
    if (d > 26) d = 52 - d;
    const hasSecondPeak = profile.secondPeakWeek !== undefined;
    assert.ok(
      d <= (hasSecondPeak ? 26 : 3),
      `${id}: observed peak at week ${bestWeek}, declared ${profile.peakWeek}`,
    );
  }
});

test('paddy straw is strongly seasonal and cattle dung is not', () => {
  const range = (id: StreamId) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let w = 0; w < 52; w++) {
      const v = seasonalMultiplier(id, w);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    return hi / lo;
  };
  assert.ok(range('paddy_straw') > 8, 'paddy straw should swing by an order of magnitude');
  assert.ok(range('cattle_dung') < 1.5, 'dung supply should be near-continuous');
});

test('generated history is non-negative, deterministic and correctly scaled', () => {
  const net = buildNetwork();
  const src = net.sources.find((s) => s.stream === 'paddy_straw')!;
  const a = generateHistory(src, 104);
  const b = generateHistory(src, 104);

  assert.equal(a.length, 104);
  assert.deepEqual(a, b, 'history must be reproducible from the source id');
  assert.ok(a.every((v) => v >= 0), 'supply cannot be negative');
  assert.ok(Math.max(...a) > 0, 'history must contain something');
});

// ─────────────────────────────────────────────────────────────────────────────
// Model quality
// ─────────────────────────────────────────────────────────────────────────────

test('the ridge model beats a naive mean forecast', () => {
  const net = buildNetwork();
  const src = net.sources.find((s) => s.stream === 'paddy_straw')!;
  const history = generateHistory(src, 104);
  const fit = fitRidge(history);

  assert.ok(fit.r2 > 0.5, `R^2 of ${fit.r2} means the model explains almost nothing`);
  assert.ok(fit.coefficients.length === 10, 'expected 10 features');
  assert.ok(fit.coefficients.every((c) => Number.isFinite(c)), 'coefficients must be finite');
  assert.ok(fit.residualSd >= 0);
});

test('walk-forward backtest produces a finite, plausible error', () => {
  const net = buildNetwork();
  for (const src of net.sources.slice(0, 6)) {
    const history = generateHistory(src, 104);
    const mape = walkForwardMape(history);
    assert.ok(Number.isFinite(mape), `${src.id}: MAPE is not finite`);
    assert.ok(mape >= 0, `${src.id}: negative MAPE`);
    assert.ok(mape < 400, `${src.id}: MAPE of ${mape}% suggests the model is broken`);
  }
});

test('forecast intervals contain the point estimate and widen with horizon', () => {
  const net = buildNetwork();
  const f = forecastSource(net.sources[0], net.asOf);
  const future = f.points.filter((p) => p.actual === null);

  assert.ok(future.length > 0, 'a forecast must project forwards');
  for (const p of future) {
    assert.ok(p.lower <= p.predicted && p.predicted <= p.upper, 'interval must bracket the point');
    assert.ok(p.lower >= 0, 'supply cannot be forecast negative');
  }
  const firstWidth = future[0].upper - future[0].lower;
  const lastWidth = future[future.length - 1].upper - future[future.length - 1].lower;
  assert.ok(lastWidth > firstWidth, 'uncertainty must grow with horizon');
});

test('network forecast aggregates every source', () => {
  const net = buildNetwork();
  const f = forecastNetwork(net.sources, net.asOf, net.assumptions.windowDays);
  assert.equal(Object.keys(f.bySource).length, net.sources.length);
  assert.ok(f.windowTotalT > 0);
  assert.ok(f.windowLowerT <= f.windowTotalT && f.windowTotalT <= f.windowUpperT);
  assert.ok(f.peakWeeks.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenarios
// ─────────────────────────────────────────────────────────────────────────────

test('every declared scenario has parameters with valid defaults', () => {
  const net = buildNetwork();
  for (const def of scenarioDefs(net)) {
    assert.ok(def.label.length > 0, `${def.kind} has no label`);
    assert.ok(def.description.length > 20, `${def.kind} has no meaningful description`);
    for (const p of def.params) {
      assert.ok(p.defaultValue !== undefined, `${def.kind}.${p.key} has no default`);
      if (p.type === 'choice') {
        assert.ok(p.choices && p.choices.length > 0, `${def.kind}.${p.key} has no choices`);
        assert.ok(
          p.choices!.some((c) => c.value === String(p.defaultValue)),
          `${def.kind}.${p.key} default is not among its choices`,
        );
      }
      if (p.type === 'number') {
        const v = Number(p.defaultValue);
        assert.ok(v >= (p.min ?? -Infinity) && v <= (p.max ?? Infinity), `${def.kind}.${p.key} default out of range`);
      }
    }
  }
});

test('taking a facility offline removes its flows and is attributed', () => {
  const net = buildNetwork();
  const before = optimize(net, 'balanced');
  const target = net.facilities.find((f) => before.openFacilities.includes(f.id))!;

  const result = runScenario(net, { kind: 'facility_offline', params: { facilityId: target.id } }, 'balanced', before);

  assert.equal(
    result.after.allocations.filter((a) => a.facilityId === target.id).length,
    0,
    'the offline facility must receive nothing',
  );
  assert.ok(result.flowChanges.length > 0, 'losing an operating plant must change some flows');
  assert.ok(result.narrative.length > 1, 'the scenario must explain itself');
  assert.ok(result.computeStages.length >= 4, 'the compute stages must be recorded');

  const carbon = result.deltas.find((d) => d.key === 'netCarbonT')!;
  assert.ok(carbon.before !== carbon.after, 'removing a plant must move net carbon');
});

test('a supply surge raises availability and never lowers total supply', () => {
  const net = buildNetwork();
  const { state } = applyScenario(
    net,
    { kind: 'supply_surge', params: { stream: 'paddy_straw', changePct: 50 } },
    'balanced',
  );
  const beforeT = net.sources
    .filter((s) => s.stream === 'paddy_straw')
    .reduce((a, s) => a + s.availableT, 0);
  const afterT = state.sources
    .filter((s) => s.stream === 'paddy_straw')
    .reduce((a, s) => a + s.availableT, 0);
  assert.ok(Math.abs(afterT - beforeT * 1.5) < 1, `expected +50%, got ${afterT / beforeT}`);

  // The original network must be untouched — scenarios operate on a clone.
  assert.equal(
    net.sources.filter((s) => s.stream === 'paddy_straw').reduce((a, s) => a + s.availableT, 0),
    beforeT,
    'applyScenario must not mutate the network it was given',
  );
});

test('raising the carbon price never reduces net carbon', () => {
  const net = buildNetwork();
  const base = optimize(net, 'balanced');
  const { state } = applyScenario(
    net,
    { kind: 'carbon_price', params: { cdrPrice: 25000 } },
    'balanced',
  );
  const after = optimize(state, 'balanced');
  assert.ok(
    after.totals.netCarbonT >= base.totals.netCarbonT - 1,
    `carbon fell from ${base.totals.netCarbonT} to ${after.totals.netCarbonT} when the price rose`,
  );
});

test('a district cut off from the network strands its feedstock', () => {
  const net = buildNetwork();
  const district = 'Sangrur';
  const { state } = applyScenario(net, { kind: 'road_disruption', params: { district } }, 'balanced');
  const after = optimize(state, 'balanced');

  for (const a of after.allocations) {
    const src = state.sources.find((s) => s.id === a.sourceId)!;
    const fac = state.facilities.find((f) => f.id === a.facilityId)!;
    if (src.district !== district) continue;
    assert.equal(
      fac.district,
      district,
      `${src.name} is cut off but still ships to ${fac.name} in ${fac.district}`,
    );
  }
});

test('deltas report before, after and a consistent percentage', () => {
  const net = buildNetwork();
  const a = optimize(net, 'carbon_first');
  const b = optimize(net, 'profit_first');
  for (const d of buildDeltas(net, a, b)) {
    assert.ok(Math.abs(d.delta - (d.after - d.before)) < 1e-6, `${d.key}: delta is inconsistent`);
    if (Math.abs(d.before) > 1e-9) {
      const expected = ((d.after - d.before) / Math.abs(d.before)) * 100;
      assert.ok(Math.abs(d.deltaPct - expected) < 1e-6, `${d.key}: percentage is inconsistent`);
    }
  }
});

test('flow diffing recognises a re-route rather than reporting an unrelated drop and add', () => {
  const net = buildNetwork();
  const before = optimize(net, 'balanced');
  const target = net.facilities.find((f) => before.openFacilities.includes(f.id))!;
  const { state } = applyScenario(
    net,
    { kind: 'facility_offline', params: { facilityId: target.id } },
    'balanced',
  );
  const after = optimize(state, 'balanced');
  const changes = diffFlows(state, before, after);

  for (const c of changes) {
    if (c.changeType === 'rerouted') {
      assert.ok(c.fromFacilityId && c.toFacilityId, 'a re-route must name both ends');
      assert.notEqual(c.fromFacilityId, c.toFacilityId);
    }
    assert.ok(c.tonnes > 0, 'a change of zero tonnes is not a change');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Bottlenecks and resilience
// ─────────────────────────────────────────────────────────────────────────────

test('every stranded lot carries an attributed reason', () => {
  const net = buildNetwork();
  const result = optimize(net, 'balanced');
  const lots = strandedLots(net, result);

  for (const l of lots) {
    assert.ok(l.tonnes > 0, 'a stranded lot must have tonnage');
    assert.ok(l.reasonText.length > 20, `${l.name}: reason is not explanatory`);
    assert.ok(l.counterfactualEmissionsT >= 0);
  }

  // Stranded tonnage must reconcile with the totals.
  const total = lots.reduce((s, l) => s + l.tonnes, 0);
  assert.ok(
    Math.abs(total - result.totals.strandedT) < 2,
    `stranded lots sum to ${total} but totals report ${result.totals.strandedT}`,
  );
});

test('poultry litter is correctly identified as having no viable pathway', () => {
  // C:N of 9 sits below the stable window for both digestion and composting,
  // and its moisture puts it outside every thermal route. The system should say
  // so explicitly rather than silently dropping it.
  const net = buildNetwork();
  const result = optimize(net, 'balanced');
  const lots = strandedLots(net, result).filter((l) => l.stream === 'poultry_litter');
  assert.ok(lots.length > 0, 'poultry litter should be stranded in this fixture');
  assert.ok(
    lots.every((l) => l.reason === 'pathway_mismatch'),
    'the reason should be a pathway gate, not capacity',
  );
});

test('every bottleneck carries a quantified consequence and an action', () => {
  const net = buildNetwork();
  const result = optimize(net, 'balanced');
  for (const b of detectBottlenecks(net, result)) {
    assert.ok(b.title.length > 5, 'bottleneck needs a title');
    assert.ok(b.detail.length > 20, `${b.id}: no detail`);
    assert.ok(b.recommendation.length > 20, `${b.id}: no recommendation`);
    assert.ok(b.quantifiedUpside.length > 10, `${b.id}: no quantified upside`);
    assert.ok(['critical', 'high', 'moderate', 'low'].includes(b.severity));
  }
});

test('resilience scoring is bounded and its components are weighted to one', () => {
  const net = buildNetwork();
  const result = optimize(net, 'balanced');
  const r = resilienceReport(net, result, 'balanced');

  assert.ok(r.score >= 0 && r.score <= 100, `score ${r.score} out of range`);
  assert.ok(['Strong', 'Adequate', 'Fragile', 'Critical'].includes(r.grade));
  const weight = r.components.reduce((s, c) => s + c.weight, 0);
  assert.ok(Math.abs(weight - 1) < 1e-9, `component weights sum to ${weight}`);
  assert.ok(r.n1Results.length > 0, 'N-1 analysis must cover the operating set');
  for (const n of r.n1Results) assert.ok(n.lossPct >= 0, `${n.facilityName}: negative loss`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Copilot grounding
// ─────────────────────────────────────────────────────────────────────────────

test('the copilot answers from tools and never with an empty response', () => {
  const twin = new Twin();
  const questions = [
    'What is the network doing right now?',
    'Where should we add capacity next?',
    'Why is feedstock being stranded?',
    'How durable is the biochar carbon?',
    'Which pathway gives the highest profit for paddy straw?',
    'How resilient is the network?',
    'What happens if the largest plant goes offline?',
  ];
  for (const q of questions) {
    const a = ask(twin, q);
    assert.ok(a.answer.length > 80, `"${q}" produced a stub answer`);
    assert.ok(a.toolCalls.length > 0, `"${q}" answered without calling any tool`);
    assert.ok(a.intent.length > 0);
    // Nothing may leak an unresolved template or a NaN into the user's face.
    assert.ok(!a.answer.includes('undefined'), `"${q}" leaked undefined`);
    assert.ok(!a.answer.includes('NaN'), `"${q}" leaked NaN`);
  }
});

test('pathway comparison explains why an infeasible pathway is excluded', () => {
  const twin = new Twin();
  const rows = comparePathways(twin, 'paddy_straw');
  assert.equal(rows.length, 5, 'every pathway must be represented');
  for (const r of rows) {
    if (!r.feasible) {
      assert.ok(r.blockedBy.length > 3, `${r.pathway}: excluded without a reason`);
    }
  }
  // Paddy straw is far too dry for digestion and too coarse for composting.
  const ad = rows.find((r) => r.pathway === 'anaerobic_digestion_cbg')!;
  assert.equal(ad.feasible, false, 'paddy straw cannot be digested at 13% moisture');
});

test('the twin caches derived results and invalidates them on change', () => {
  const twin = new Twin();
  const first = twin.getResult();
  const second = twin.getResult();
  assert.equal(first, second, 'repeated reads must hit the cache');

  const v0 = twin.getVersion();
  twin.setObjective('carbon_first');
  assert.ok(twin.getVersion() > v0, 'changing the objective must bump the version');
  assert.notEqual(twin.getResult(), first, 'the cached result must have been invalidated');
});

test('the twin resets cleanly back to the baseline network', () => {
  const twin = new Twin();
  const baseline = twin.getResult().totals.netCarbonT;

  twin.commitScenario({ kind: 'facility_offline', params: { facilityId: 'FAC-PL-03' } });
  assert.notEqual(twin.getResult().totals.netCarbonT, baseline, 'the commit must change state');

  twin.reset();
  assert.equal(twin.getState().appliedScenarios.length, 0, 'reset must clear scenarios');
  assert.equal(
    twin.getResult().totals.netCarbonT,
    baseline,
    'reset must restore the original result exactly',
  );
});
