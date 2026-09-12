/**
 * Carbon history, period comparison and change attribution.
 *
 * The risk this module carries is not arithmetic error, it is fabrication: a
 * trend line that looks plausible but was drawn rather than solved, or a
 * "what changed" sentence that asserts a driver the data does not support. These
 * tests pin both — every point must come from a real solve, and every clause of
 * the narrative must be traceable to a measured difference.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNetwork } from '../src/network.ts';
import {
  carbonHistory,
  changeDrivers,
  comparePeriods,
  composeNarrative,
  type CarbonHistoryPoint,
} from '../src/history.ts';

const net = buildNetwork();
const history = carbonHistory(net, 'balanced', 12);

// ─────────────────────────────────────────────────────────────────────────────
// The series
// ─────────────────────────────────────────────────────────────────────────────

test('every point is a real solve, not an interpolation', () => {
  assert.equal(history.points.length, 12);
  for (const p of history.points) {
    assert.ok(Number.isFinite(p.netT), 'net carbon must be finite');
    assert.ok(p.suppliedT > 0, 'a week with no supply would mean the history is not being read');
    assert.ok(p.divertedT <= p.suppliedT + 1e-6, 'cannot divert more than was supplied');
    assert.ok(
      Math.abs(p.divertedT + p.strandedT - p.suppliedT) < 1,
      'diverted plus stranded must equal supply',
    );
  }
});

test('supply varies across the series, so the trend carries information', () => {
  const supplies = history.points.map((p) => p.suppliedT);
  const spread = Math.max(...supplies) - Math.min(...supplies);
  assert.ok(spread > 1, 'a flat supply series would mean generateHistory is not being sampled');
});

test('the series is deterministic across calls', () => {
  const again = carbonHistory(net, 'balanced', 12);
  assert.deepEqual(
    again.points.map((p) => Math.round(p.netT)),
    history.points.map((p) => Math.round(p.netT)),
  );
});

test('dates run forward and end at the network as-of date', () => {
  for (let i = 1; i < history.points.length; i++) {
    assert.ok(
      history.points[i].date > history.points[i - 1].date,
      'points must be ordered oldest to newest',
    );
  }
  assert.equal(history.points[history.points.length - 1].date, net.asOf);
});

test('intensity is net carbon divided by tonnes actually diverted', () => {
  for (const p of history.points) {
    if (p.divertedT <= 0) continue;
    assert.ok(Math.abs(p.intensityTPerT - p.netT / p.divertedT) < 1e-9);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Period comparison
// ─────────────────────────────────────────────────────────────────────────────

function synthetic(values: number[]): CarbonHistoryPoint[] {
  return values.map((v, i) => ({
    weekIndex: i - values.length + 1,
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    suppliedT: 100,
    divertedT: 80,
    strandedT: 20,
    netT: v,
    durableRemovalT: 0,
    avoidedEmissionsT: 0,
    substitutionT: v,
    emissionsT: 0,
    transportEmissionsT: 0,
    processEmissionsT: 0,
    intensityTPerT: v / 80,
    tonnesByPathway: {},
    netByFacility: {},
  }));
}

test('the comparison averages equal-length windows on both sides', () => {
  // previous = [10, 10], current = [20, 20]
  const p = comparePeriods(synthetic([10, 10, 20, 20]), 2);
  assert.equal(p.weeks, 2);
  assert.equal(p.previousT, 10);
  assert.equal(p.currentT, 20);
  assert.equal(p.deltaT, 10);
  assert.equal(p.deltaPct, 100);
  assert.equal(p.improving, true);
});

test('more net carbon counts as improvement, less does not', () => {
  assert.equal(comparePeriods(synthetic([20, 20, 10, 10]), 2).improving, false);
  assert.equal(comparePeriods(synthetic([10, 10, 20, 20]), 2).improving, true);
});

test('the comparison never reads past the start of the series', () => {
  // Only three points but a four-week window: it must shrink, not read undefined.
  const p = comparePeriods(synthetic([10, 20, 30]), 4);
  assert.ok(p.weeks <= 1);
  assert.ok(Number.isFinite(p.currentT) && Number.isFinite(p.previousT));
});

test('a zero previous period does not produce a non-finite percentage', () => {
  const p = comparePeriods(synthetic([0, 0, 5, 5]), 2);
  assert.ok(Number.isFinite(p.deltaPct));
});

// ─────────────────────────────────────────────────────────────────────────────
// Attribution
// ─────────────────────────────────────────────────────────────────────────────

test('emission drivers are signed as charges, not as benefits', () => {
  // Transport emissions rising must register as a negative contribution.
  const points = synthetic([10, 10, 10, 10]).map((p, i) => ({
    ...p,
    transportEmissionsT: i >= 2 ? 100 : 0,
  }));
  const transport = changeDrivers(points, 2).find((d) => d.key === 'transport');
  assert.ok(transport, 'a 100 t rise in transport emissions must be attributed');
  assert.ok(transport.deltaT < 0, 'more emissions must reduce net carbon, not raise it');
});

test('drivers reconcile to the net change', () => {
  const n = history.period.weeks;
  const carbonDrivers = history.drivers.filter((d) => d.key !== 'throughput');
  const summed = carbonDrivers.reduce((a, d) => a + d.deltaT, 0);
  // Drivers below the half-tonne reporting floor are dropped, so allow for them.
  assert.ok(
    Math.abs(summed - history.period.deltaT) < 0.5 * carbonDrivers.length + 2,
    `drivers (${summed.toFixed(1)}) should reconcile to the period change (${history.period.deltaT.toFixed(1)}) over ${n} weeks`,
  );
});

test('drivers are ordered by magnitude so the lead driver really leads', () => {
  const scored = history.drivers.filter((d) => d.key !== 'throughput');
  for (let i = 1; i < scored.length; i++) {
    assert.ok(Math.abs(scored[i - 1].deltaT) >= Math.abs(scored[i].deltaT));
  }
});

test('the throughput shift is reported as physical movement, never as carbon', () => {
  const shift = history.drivers.find((d) => d.key === 'throughput');
  if (shift) {
    assert.equal(shift.deltaT, 0, 'the shift annotates the change, it does not contribute to it');
    assert.match(shift.detail, /\bt\b/, 'it should be quoted in tonnes');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Narrative
// ─────────────────────────────────────────────────────────────────────────────

test('the narrative names the direction the number actually moved', () => {
  const period = comparePeriods(synthetic([10, 10, 30, 30]), 2);
  const s = composeNarrative(period, [
    { key: 'substitution', label: 'Fossil displacement', deltaT: 20, detail: 'x' },
  ]);
  assert.match(s, /increased/);
  assert.doesNotMatch(s, /decreased/);
});

test('an unchanged period is reported as unchanged rather than invented movement', () => {
  const period = comparePeriods(synthetic([10, 10, 10, 10]), 2);
  const s = composeNarrative(period, []);
  assert.match(s, /held steady/);
});

test('an offset is only claimed when a driver genuinely pushed the other way', () => {
  const period = comparePeriods(synthetic([10, 10, 30, 30]), 2);

  const bothUp = composeNarrative(period, [
    { key: 'substitution', label: 'Fossil displacement', deltaT: 20, detail: 'x' },
    { key: 'avoided', label: 'Avoided disposal', deltaT: 5, detail: 'y' },
  ]);
  assert.doesNotMatch(bothUp, /offset/, 'two drivers pushing the same way is not an offset');

  const opposed = composeNarrative(period, [
    { key: 'substitution', label: 'Fossil displacement', deltaT: 20, detail: 'x' },
    { key: 'transport', label: 'Transport emissions', deltaT: -5, detail: 'y' },
  ]);
  assert.match(opposed, /Partially offset by transport emissions/);
});

test('the narrative quotes figures with digit grouping, as the rest of the product does', () => {
  const period = comparePeriods(synthetic([0, 0, 12564, 12564]), 2);
  const s = composeNarrative(period, [
    { key: 'substitution', label: 'Fossil displacement', deltaT: 12564, detail: 'x' },
  ]);
  assert.match(s, /12,564/, 'large figures must be grouped, not printed raw');
});

test('the live narrative is consistent with the live period figure', () => {
  const direction = history.period.deltaT > 0 ? /increased/ : /decreased/;
  if (Math.abs(history.period.deltaT) >= 0.5) {
    assert.match(history.narrative, direction);
  }
});

test('the basis states what is held fixed, so the trend cannot be over-read', () => {
  assert.match(history.basis, /supply/i);
  assert.match(history.basis, /held at their current values/i);
});
