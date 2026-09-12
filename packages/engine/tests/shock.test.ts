/**
 * The shock engine, and the invariants that keep it honest.
 *
 * The single most important test in this file is the last kind: **a scenario must
 * never alter the baseline network**. Everything else in the product reads the
 * live twin, so a scenario that leaked a mutation would silently corrupt Carbon
 * Home, the Ledger, Facilities and Evidence at once, and the corruption would look
 * like a plausible number rather than an error.
 *
 * The second concern is cross-module agreement. This suite pins the bug that was
 * live before this module existed: `buildDeltas` read `OptimizationResult.totals`,
 * so the Scenarios screen reported +1,174 tCO₂e for the same capacity change that
 * Carbon Opportunities measured at +1,410.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNetwork } from '../src/network.ts';
import { optimize } from '../src/optimizer.ts';
import { buildDeltas, runScenario } from '../src/scenario.ts';
import { networkLedger, OWN_BASIS } from '../src/carbon.ts';
import { runShock, compareObjectives } from '../src/shock.ts';
import { findOpportunities } from '../src/opportunity.ts';
import { facilityRanking } from '../src/facility.ts';
import type { ScenarioInstance } from '../src/types.ts';

const net = buildNetwork();
const base = optimize(net, 'balanced');
const BASE_LEDGER = networkLedger(base.allocations, net.facilities, net.vehicles, net.assumptions, OWN_BASIS);

const SHOCKS: ScenarioInstance[] = [
  { kind: 'facility_offline', params: { facilityId: 'FAC-PL-02' } },
  { kind: 'new_facility', params: { facilityId: 'FAC-PL-01', addTpd: 40 } },
  { kind: 'diesel_price', params: { price: 150 } },
  { kind: 'supply_surge', params: { stream: 'paddy_straw', changePct: 40 } },
];

const EPS = 1e-6;

// ─────────────────────────────────────────────────────────────────────────────
// The baseline must survive
// ─────────────────────────────────────────────────────────────────────────────

test('running a shock never mutates the baseline network', () => {
  const before = JSON.stringify(net);
  for (const s of SHOCKS) runShock(net, base, s, 'balanced');
  compareObjectives(net, SHOCKS[0], 'balanced');
  assert.equal(JSON.stringify(net), before, 'the live network was modified by a scenario');
});

test('running a shock never mutates the baseline solve', () => {
  const before = JSON.stringify(base);
  for (const s of SHOCKS) runShock(net, base, s, 'balanced');
  assert.equal(JSON.stringify(base), before, 'the baseline OptimizationResult was modified');
});

test('the baseline side of every shock is the live plan', () => {
  for (const s of SHOCKS) {
    const r = runShock(net, base, s, 'balanced');
    assert.ok(
      Math.abs(r.baseline.netT - BASE_LEDGER.netT) < EPS,
      `${s.kind}: baseline ${r.baseline.netT} vs live ledger ${BASE_LEDGER.netT}`,
    );
    assert.equal(r.baseline.marginInr, base.totals.marginInr);
    assert.equal(r.baseline.divertedT, base.totals.divertedT);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-module agreement
// ─────────────────────────────────────────────────────────────────────────────

test('scenario deltas use the ledger, not the optimiser aggregate', () => {
  // The regression. totals.netCarbonT and the ledger differ by about a tenth on
  // this network, so a delta built from totals is a different quantity.
  assert.ok(
    Math.abs(base.totals.netCarbonT - BASE_LEDGER.netT) > 100,
    'the fixture should still exercise the case where the two differ',
  );
  for (const s of SHOCKS) {
    const run = runScenario(net, s, 'balanced', base);
    const d = buildDeltas(net, run.before, run.after).find((x) => x.key === 'netCarbonT')!;
    const bL = networkLedger(run.before.allocations, net.facilities, net.vehicles, net.assumptions, OWN_BASIS);
    const aL = networkLedger(run.after.allocations, net.facilities, net.vehicles, net.assumptions, OWN_BASIS);
    assert.ok(Math.abs(d.before - bL.netT) < EPS, `${s.kind}: delta before is not the ledger`);
    assert.ok(Math.abs(d.after - aL.netT) < EPS, `${s.kind}: delta after is not the ledger`);
  }
});

test('the shock engine and the scenario deltas report the same carbon change', () => {
  for (const s of SHOCKS) {
    const shock = runShock(net, base, s, 'balanced');
    const run = runScenario(net, s, 'balanced', base);
    const d = buildDeltas(net, run.before, run.after).find((x) => x.key === 'netCarbonT')!;
    assert.ok(
      Math.abs(d.delta - shock.carbonDeltaT) < EPS,
      `${s.kind}: shock ${shock.carbonDeltaT} vs delta ${d.delta}`,
    );
  }
});

test('an opportunity and its simulation report the identical change', () => {
  // §16: clicking Simulate must reproduce exactly what Opportunities measured.
  const report = findOpportunities(net, base);
  for (const o of report.opportunities.slice(0, 4)) {
    const shock = runShock(net, base, o.scenario, base.objective);
    assert.ok(
      Math.abs(shock.carbonDeltaT - o.measure.carbonDeltaT) < EPS,
      `${o.id}: opportunity ${o.measure.carbonDeltaT} vs simulation ${shock.carbonDeltaT}`,
    );
    assert.ok(Math.abs(shock.marginDeltaInr - o.measure.marginDeltaInr) < 1e-6);
    assert.deepEqual(shock.scenario, o.scenario, 'the instance was not preserved');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// The decomposition reconciles
// ─────────────────────────────────────────────────────────────────────────────

test('the delta is exactly after minus before', () => {
  for (const s of SHOCKS) {
    const r = runShock(net, base, s, 'balanced');
    assert.ok(Math.abs(r.after.netT - r.baseline.netT - r.carbonDeltaT) < 1e-9);
    assert.ok(
      Math.abs(r.after.marginInr - r.baseline.marginInr - r.marginDeltaInr) < 1e-6,
    );
  }
});

test('the drivers sum to the carbon change with no residual', () => {
  for (const s of SHOCKS) {
    const r = runShock(net, base, s, 'balanced');
    const groups = r.groupDeltas.reduce((a, g) => a + g.delta, 0);
    const lines = r.lineDeltas.reduce((a, l) => a + l.delta, 0);
    assert.ok(
      Math.abs(groups - r.carbonDeltaT) < EPS,
      `${s.kind}: groups ${groups} vs delta ${r.carbonDeltaT}`,
    );
    assert.ok(Math.abs(lines - r.carbonDeltaT) < EPS, `${s.kind}: lines do not reconcile`);
  }
});

test('every line delta is a genuine before/after difference', () => {
  for (const s of SHOCKS) {
    const r = runShock(net, base, s, 'balanced');
    for (const l of r.lineDeltas) {
      assert.ok(Math.abs(l.after - l.before - l.delta) < 1e-9, `${l.key}: delta is not the difference`);
      assert.ok(Math.abs(l.delta) > 1e-9, `${l.key}: an unchanged line was reported as a driver`);
    }
  }
});

test('transport and processing stay partitioned across the diff', () => {
  for (const s of SHOCKS) {
    const r = runShock(net, base, s, 'balanced');
    const emissionLines = r.lineDeltas.filter((l) => l.kind === 'emission');
    const transport = r.groupDeltas.find((g) => g.key === 'transport')?.delta ?? 0;
    const processing = r.groupDeltas.find((g) => g.key === 'processing')?.delta ?? 0;
    const all = emissionLines.reduce((a, l) => a + l.delta, 0);
    assert.ok(
      Math.abs(transport + processing - all) < EPS,
      `${s.kind}: an emission line belongs to neither group`,
    );
  }
});

test('avoidance and substitution remain separate groups', () => {
  for (const s of SHOCKS) {
    const r = runShock(net, base, s, 'balanced');
    const keys = r.groupDeltas.map((g) => g.key);
    assert.ok(!keys.includes('avoided_substitution'));
    const avoided = r.lineDeltas.filter((l) => l.kind === 'avoided').reduce((a, l) => a + l.delta, 0);
    const sub = r.lineDeltas.filter((l) => l.kind === 'substitution').reduce((a, l) => a + l.delta, 0);
    const gA = r.groupDeltas.find((g) => g.key === 'avoided')?.delta ?? 0;
    const gS = r.groupDeltas.find((g) => g.key === 'substitution')?.delta ?? 0;
    assert.ok(Math.abs(gA - avoided) < EPS);
    assert.ok(Math.abs(gS - sub) < EPS);
  }
});

test('benefit and charge groups are labelled with the right polarity', () => {
  const r = runShock(net, base, SHOCKS[0], 'balanced');
  for (const g of r.groupDeltas) {
    if (g.key === 'transport' || g.key === 'processing' || g.key === 'adjustment') {
      assert.equal(g.benefit, false, `${g.key} is a charge and must not be flagged a benefit`);
    } else {
      assert.equal(g.benefit, true);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// The physical response
// ─────────────────────────────────────────────────────────────────────────────

test('changed facilities reconcile with the scenario allocations', () => {
  for (const s of SHOCKS) {
    const r = runShock(net, base, s, 'balanced');
    const run = runScenario(net, s, 'balanced', base);
    for (const f of r.changedFacilities) {
      const after = run.after.allocations
        .filter((a) => a.facilityId === f.id)
        .reduce((x, a) => x + a.tonnes, 0);
      assert.ok(Math.abs(after - f.afterT) < 0.5, `${f.name}: after-tonnage disagrees`);
      assert.ok(Math.abs(f.afterT - f.beforeT - f.tonnesDeltaT) < 0.5);
    }
  }
});

test('a facility reported as unchanged really did not change', () => {
  const r = runShock(net, base, SHOCKS[1], 'balanced');
  const run = runScenario(net, SHOCKS[1], 'balanced', base);
  const changed = new Set(r.changedFacilities.map((f) => f.id));
  for (const f of net.facilities) {
    if (changed.has(f.id)) continue;
    const b = run.before.allocations.filter((a) => a.facilityId === f.id).reduce((x, a) => x + a.tonnes, 0);
    const a = run.after.allocations.filter((x) => x.facilityId === f.id).reduce((x, y) => x + y.tonnes, 0);
    assert.ok(Math.abs(a - b) < 0.5, `${f.name} changed but was not reported`);
  }
});

test('baseline facility totals still reconcile to the baseline ledger', () => {
  // Guards the share-denominator fix: a shock must not disturb this.
  const ranking = facilityRanking(net, base);
  const sum = ranking.reduce((a, r) => a + r.netT, 0);
  assert.ok(Math.abs(sum - BASE_LEDGER.netT) < EPS);
  assert.ok(Math.abs(ranking.reduce((a, r) => a + r.sharePct, 0) - 100) < 0.01);
});

test('constraint changes are only reported when binding actually flipped', () => {
  for (const s of SHOCKS) {
    const r = runShock(net, base, s, 'balanced');
    const run = runScenario(net, s, 'balanced', base);
    const bById = new Map(run.before.shadowPrices.map((x) => [x.facilityId, x]));
    for (const c of r.constraints) {
      const b = bById.get(c.facilityId)!;
      const a = run.after.shadowPrices.find((x) => x.facilityId === c.facilityId)!;
      assert.notEqual(b.binding, a.binding, `${c.facilityName}: reported but did not flip`);
      assert.equal(c.afterBinding, a.binding);
    }
  }
});

test('a shock with no physical change says so rather than implying one', () => {
  for (const s of SHOCKS) {
    const r = runShock(net, base, s, 'balanced');
    if (r.physicallyChanged) {
      assert.equal(r.unchangedReason, null);
    } else {
      assert.ok(r.unchangedReason, 'an unchanged network must explain itself');
      assert.equal(r.flowChanges.length, 0);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Objectives and classification
// ─────────────────────────────────────────────────────────────────────────────

test('each objective is measured against its own baseline', () => {
  const outcomes = compareObjectives(net, SHOCKS[0], 'balanced');
  assert.equal(outcomes.length, 4);
  for (const o of outcomes) {
    const ownBaseline = optimize(net, o.objective);
    const ledger = networkLedger(
      ownBaseline.allocations,
      net.facilities,
      net.vehicles,
      net.assumptions,
      OWN_BASIS,
    );
    assert.ok(
      Math.abs(o.baselineNetT - ledger.netT) < EPS,
      `${o.objective}: baseline is not that objective's own solve`,
    );
    assert.ok(Math.abs(o.scenarioNetT - o.baselineNetT - o.carbonDeltaT) < 1e-9);
  }
  assert.equal(outcomes.filter((o) => o.isCurrent).length, 1);
});

test('the current objective row matches the single-objective run', () => {
  const outcomes = compareObjectives(net, SHOCKS[0], 'balanced');
  const current = outcomes.find((o) => o.isCurrent)!;
  const single = runShock(net, base, SHOCKS[0], 'balanced');
  assert.ok(Math.abs(current.carbonDeltaT - single.carbonDeltaT) < EPS);
});

test('classification follows the two signs and nothing else', () => {
  for (const s of SHOCKS) {
    const r = runShock(net, base, s, 'balanced');
    const expected =
      r.carbonDeltaT >= 0
        ? r.marginDeltaInr >= 0
          ? 'carbon_up_econ_up'
          : 'carbon_up_econ_down'
        : r.marginDeltaInr >= 0
          ? 'carbon_down_econ_up'
          : 'carbon_down_econ_down';
    assert.equal(r.classification, expected, `${s.kind}: misclassified`);
  }
});

test('the explanation is built from measured facts and claims no certainty', () => {
  const forbidden = /\b(guarantee|guaranteed|certain|verified|carbon credit)\b/i;
  for (const s of SHOCKS) {
    const r = runShock(net, base, s, 'balanced');
    assert.ok(r.why.length > 60, `${s.kind}: no usable explanation`);
    assert.doesNotMatch(r.why, forbidden);
    if (r.constraints.length > 0) {
      assert.ok(
        r.why.includes(r.constraints[0].facilityName),
        `${s.kind}: a constraint flipped but the explanation does not mention it`,
      );
    }
  }
});
