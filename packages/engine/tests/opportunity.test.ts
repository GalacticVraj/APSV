/**
 * Carbon opportunities.
 *
 * The claim this module makes is unusually strong: every number on the page is the
 * difference between two real optimiser runs. That is only true if nothing here
 * quietly extrapolates, and it stays true only if the scenario handed to the user
 * is the same one that was measured. These tests hold both.
 *
 * The failure that would be hardest to notice is a recommendation the optimiser
 * had already rejected for a good reason, presented without that reason. So the
 * explanation is tested as carefully as the arithmetic.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNetwork } from '../src/network.ts';
import { optimize } from '../src/optimizer.ts';
import { runScenario } from '../src/scenario.ts';
import { networkLedger, OWN_BASIS } from '../src/carbon.ts';
import { findOpportunities, explainOpportunity } from '../src/opportunity.ts';

const net = buildNetwork();
const result = optimize(net, 'balanced');
const report = findOpportunities(net, result);

const EPS = 1e-6;

// ─────────────────────────────────────────────────────────────────────────────
// The current state is the real current state
// ─────────────────────────────────────────────────────────────────────────────

test('the reported current state is the actual network state', () => {
  const ledger = networkLedger(result.allocations, net.facilities, net.vehicles, net.assumptions, OWN_BASIS);
  assert.ok(Math.abs(report.current.carbonT - ledger.netT) < EPS);
  assert.equal(report.current.marginInr, result.totals.marginInr);
  assert.equal(report.current.divertedT, result.totals.divertedT);
  assert.equal(report.current.strandedT, result.totals.strandedT);
  assert.equal(report.current.objective, result.objective);
});

test('every opportunity starts from the same current carbon figure', () => {
  for (const o of report.opportunities) {
    assert.ok(
      Math.abs(o.measure.carbonBeforeT - report.current.carbonT) < EPS,
      `${o.id}: before-state disagrees with the current plan`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// The delta is the difference, and the after-state is a real re-solve
// ─────────────────────────────────────────────────────────────────────────────

test('the delta is exactly after minus before', () => {
  for (const o of report.opportunities) {
    const m = o.measure;
    assert.ok(
      Math.abs(m.carbonAfterT - m.carbonBeforeT - m.carbonDeltaT) < 1e-9,
      `${o.id}: delta is not the difference`,
    );
    assert.ok(
      Math.abs(m.marginAfterInr - m.marginBeforeInr - m.marginDeltaInr) < 1e-6,
      `${o.id}: margin delta is not the difference`,
    );
    assert.ok(
      Math.abs(m.divertedAfterT - m.divertedBeforeT - m.divertedDeltaT) < 1e-6,
      `${o.id}: tonnage delta is not the difference`,
    );
  }
});

test('re-running an opportunity reproduces its reported figures', () => {
  // The strongest check available: run the same scenario again through the
  // scenario engine and require the same numbers. If anything in the summary were
  // extrapolated rather than measured, this diverges.
  for (const o of report.opportunities.slice(0, 4)) {
    const again = explainOpportunity(net, result, o.scenario);
    assert.ok(
      Math.abs(again.measure.carbonDeltaT - o.measure.carbonDeltaT) < EPS,
      `${o.id}: re-run gives ${again.measure.carbonDeltaT} vs reported ${o.measure.carbonDeltaT}`,
    );
    assert.ok(Math.abs(again.measure.marginDeltaInr - o.measure.marginDeltaInr) < 1e-6);
    assert.ok(Math.abs(again.measure.divertedDeltaT - o.measure.divertedDeltaT) < 1e-6);
  }
});

test('the after-state equals the ledger of the re-optimised plan', () => {
  for (const o of report.opportunities.slice(0, 4)) {
    const run = runScenario(net, o.scenario, result.objective, result);
    const ledger = networkLedger(
      run.after.allocations,
      net.facilities,
      net.vehicles,
      net.assumptions,
      OWN_BASIS,
    );
    assert.ok(
      Math.abs(ledger.netT - o.measure.carbonAfterT) < EPS,
      `${o.id}: after-ledger ${ledger.netT} vs reported ${o.measure.carbonAfterT}`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Sign conventions
// ─────────────────────────────────────────────────────────────────────────────

test('an opportunity always improves carbon', () => {
  for (const o of report.opportunities) {
    assert.ok(o.measure.carbonDeltaT > 1, `${o.id} is listed but does not improve carbon`);
  }
});

test('a change that costs carbon is rejected, never listed', () => {
  for (const r of report.rejected) {
    assert.ok(r.carbonDeltaT <= 1, `${r.id} was rejected but improves carbon`);
  }
  const listed = new Set(report.opportunities.map((o) => o.id));
  for (const r of report.rejected) {
    assert.ok(!listed.has(r.id), `${r.id} appears in both lists`);
  }
  assert.equal(report.opportunities.length + report.rejected.length, report.candidatesTested);
});

test('a rejected candidate states its measured cost rather than a vague reason', () => {
  const costly = report.rejected.filter((r) => r.carbonDeltaT < -1);
  assert.ok(costly.length > 0, 'the fixture should contain at least one costly candidate');
  for (const r of costly) {
    assert.match(r.reason, /re-optimisation/i);
    assert.match(r.reason, /tCO₂e/);
  }
});

test('carbon per added tonne is only reported when tonnage actually moved', () => {
  for (const o of report.opportunities) {
    const m = o.measure;
    if (Math.abs(m.divertedDeltaT) <= 1) {
      assert.equal(m.carbonPerAddedTonneT, null, `${o.id}: rate quoted on no extra tonnage`);
    } else {
      assert.ok(
        Math.abs(m.carbonPerAddedTonneT! - m.carbonDeltaT / m.divertedDeltaT) < 1e-9,
        `${o.id}: per-tonne rate is not the ratio`,
      );
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// The explanation
// ─────────────────────────────────────────────────────────────────────────────

test('every opportunity explains why the optimiser has not already taken it', () => {
  for (const o of report.opportunities) {
    assert.ok(o.whyNotAlready.length > 60, `${o.id}: no usable explanation`);
    if (o.kind === 'capacity') {
      assert.match(o.whyNotAlready, /binding/i, `${o.id}: capacity case should cite the constraint`);
    } else {
      assert.match(o.whyNotAlready, /objective/i, `${o.id}: objective case should cite the objective`);
    }
  }
});

test('a capacity opportunity is only offered where capacity actually binds', () => {
  const binding = new Set(result.shadowPrices.filter((s) => s.binding).map((s) => s.facilityId));
  for (const o of report.opportunities) {
    if (o.kind !== 'capacity') continue;
    assert.ok(o.facilityId && binding.has(o.facilityId), `${o.id}: capacity does not bind there`);
  }
});

test('the explanation quotes the measured figures, not generic advice', () => {
  for (const o of report.opportunities) {
    assert.match(o.why, /tCO₂e/);
    assert.match(o.why, /re-optimis/i);
  }
});

test('a margin trade-off is named in the explanation when one exists', () => {
  for (const o of report.opportunities) {
    if (o.measure.marginDeltaInr < -1e5) {
      assert.match(o.why, /trade-?off|falls/i, `${o.id}: margin falls but the text does not say so`);
    } else if (o.measure.marginDeltaInr > 1e5) {
      assert.match(o.why, /margin also rises|agree/i);
    }
  }
});

test('no opportunity claims a guaranteed reduction', () => {
  const forbidden = /\b(guarantee|guaranteed|will reduce|certain|verified|carbon credit)\b/i;
  for (const o of report.opportunities) {
    assert.doesNotMatch(o.why, forbidden, `${o.id}: ${o.why}`);
    assert.doesNotMatch(o.whyNotAlready, forbidden);
  }
  assert.match(report.basis, /modelled/i);
  assert.doesNotMatch(report.basis, /guaranteed reduction(?!,)/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// The handoff
// ─────────────────────────────────────────────────────────────────────────────

test('the scenario handed to the user is the one that was measured', () => {
  for (const o of report.opportunities) {
    assert.ok(o.scenario.kind, `${o.id}: no scenario to simulate`);
    // Re-running the handed-over instance must reproduce the reported delta —
    // otherwise "Simulate" shows the user something different from the page.
    const again = explainOpportunity(net, result, o.scenario);
    assert.ok(
      Math.abs(again.measure.carbonDeltaT - o.measure.carbonDeltaT) < EPS,
      `${o.id}: simulating the handed-over scenario gives a different result`,
    );
  }
});

test('every scenario names a kind the scenario engine actually supports', () => {
  const supported = new Set([
    'facility_offline',
    'facility_derate',
    'supply_surge',
    'supply_shortage',
    'fleet_shortage',
    'diesel_price',
    'carbon_price',
    'processing_cost',
    'road_disruption',
    'new_facility',
    'seasonal_shift',
    'objective_change',
  ]);
  for (const o of report.opportunities) {
    assert.ok(supported.has(o.scenario.kind), `${o.scenario.kind} is not a real scenario`);
  }
});

test('ranking is by measured carbon improvement alone', () => {
  for (let i = 1; i < report.opportunities.length; i++) {
    assert.ok(
      report.opportunities[i - 1].measure.carbonDeltaT >=
        report.opportunities[i].measure.carbonDeltaT,
      'opportunities are not ordered by carbon',
    );
  }
});

test('flow changes carry real entities and a carbon figure', () => {
  for (const o of report.opportunities.slice(0, 3)) {
    for (const f of o.flowChanges) {
      assert.ok(f.sourceName && f.sourceName.length > 0);
      assert.ok(Number.isFinite(f.carbonDeltaT));
      assert.ok(f.tonnes >= 0, 'a flow change cannot move negative tonnage');
    }
  }
});
