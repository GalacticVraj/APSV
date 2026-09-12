/**
 * Facilities as carbon decision points.
 *
 * The bug this file exists to prevent already happened once: reading
 * `Allocation.netCarbonT` for an arc instead of building that arc's own ledger.
 * The optimiser computes that field with the arc's own permanence, so the arcs
 * summed to 84% of their facility and the same haul showed one number here and a
 * different one in the Carbon Ledger. Two screens disagreeing about one truckload
 * is the failure this whole product is built to avoid.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNetwork } from '../src/network.ts';
import { optimize } from '../src/optimizer.ts';
import {
  aggregateAllocations,
  buildLedger,
  dominantBiocharStream,
  permanenceFor,
} from '../src/carbon.ts';
import { strandedLots } from '../src/bottleneck.ts';
import { traceAllocation } from '../src/trace.ts';
import { compareFacilities, facilityCarbon, facilityRanking } from '../src/facility.ts';

const net = buildNetwork();
const result = optimize(net, 'balanced');
const stranded = strandedLots(net, result);

const dominant = dominantBiocharStream(result.allocations);
const networkLedger = buildLedger(
  aggregateAllocations(result.allocations, net.facilities, net.vehicles, net.assumptions),
  net.assumptions,
  dominant ? permanenceFor(dominant, net.assumptions.soilTempC) : null,
  false,
);

const ranking = facilityRanking(net, result);
const profiles = net.facilities
  .map((f) => facilityCarbon(net, result, f.id, stranded))
  .filter((p): p is NonNullable<typeof p> => p !== null);

// ─────────────────────────────────────────────────────────────────────────────
// The parts sum to the whole
// ─────────────────────────────────────────────────────────────────────────────

test('facility ledgers sum to the network ledger', () => {
  const checks: Array<[string, number, number]> = [
    ['net', ranking.reduce((a, r) => a + r.netT, 0), networkLedger.netT],
    [
      'gross benefit',
      ranking.reduce((a, r) => a + r.grossBenefitT, 0),
      networkLedger.durableRemovalT + networkLedger.avoidedEmissionsT + networkLedger.substitutionT,
    ],
  ];
  for (const [label, parts, whole] of checks) {
    const tol = Math.max(1e-6, Math.abs(whole) * 1e-9);
    assert.ok(Math.abs(parts - whole) < tol, `${label}: ${parts.toFixed(6)} vs ${whole.toFixed(6)}`);
  }
});

test('transport and processing charges sum to the network ledger lines', () => {
  const line = (k: string) => networkLedger.lines.find((l) => l.key === k)?.valueT ?? 0;
  const networkTransport = -(line('em_transport') + line('em_aggregation'));
  const networkProcess = -networkLedger.lines
    .filter((l) => l.key.startsWith('em_') && l.key !== 'em_transport' && l.key !== 'em_aggregation')
    .reduce((a, l) => a + l.valueT, 0);

  assert.ok(Math.abs(ranking.reduce((a, r) => a + r.transportT, 0) - networkTransport) < 1e-6);
  assert.ok(Math.abs(ranking.reduce((a, r) => a + r.processT, 0) - networkProcess) < 1e-6);
});

test('every facility appears in the ranking, including idle ones', () => {
  assert.equal(ranking.length, net.facilities.length);
  assert.ok(ranking.some((r) => r.receivedT === 0), 'an idle plant should still be listed');
});

test('the ranking is ordered by net carbon', () => {
  for (let i = 1; i < ranking.length; i++) {
    assert.ok(ranking[i - 1].netT >= ranking[i].netT);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Arcs
// ─────────────────────────────────────────────────────────────────────────────

test('a facility’s arcs sum to that facility', () => {
  for (const p of profiles) {
    if (p.arcs.length === 0) continue;
    const summed = p.arcs.reduce((a, x) => a + x.netCarbonT, 0);
    assert.ok(
      Math.abs(summed - p.netT) < 1e-6,
      `${p.name}: arcs ${summed.toFixed(4)} vs facility ${p.netT.toFixed(4)}`,
    );
  }
});

test('an arc shows the same number here as in the Carbon Ledger trace', () => {
  // The regression that motivated this file. Allocation.netCarbonT is computed with
  // the arc's own permanence and is not the figure either screen should display.
  let checked = 0;
  for (const p of profiles) {
    for (const a of p.arcs.slice(0, 3)) {
      const trace = traceAllocation(net, result, a.sourceId, p.id);
      assert.ok(trace, `${a.sourceId} -> ${p.id} should be traceable`);
      assert.ok(
        Math.abs(trace.ledger.netT - a.netCarbonT) < 1e-6,
        `${a.sourceName} -> ${p.name}: facilities ${a.netCarbonT.toFixed(4)} vs ledger ${trace.ledger.netT.toFixed(4)}`,
      );
      checked++;
    }
  }
  assert.ok(checked > 5, 'the fixture should exercise several arcs');
});

test('arc shares total 100% of their facility', () => {
  for (const p of profiles) {
    if (p.arcs.length === 0 || Math.abs(p.netT) < 1) continue;
    const share = p.arcs.reduce((a, x) => a + x.sharePct, 0);
    assert.ok(Math.abs(share - 100) < 0.01, `${p.name}: shares total ${share.toFixed(2)}%`);
  }
});

test('apportioned transport sums to the facility charge', () => {
  for (const p of profiles) {
    if (p.arcs.length === 0) continue;
    const summed = p.arcs.reduce((a, x) => a + x.transportT, 0);
    assert.ok(Math.abs(summed - p.transportT) < 1e-6, `${p.name}: transport apportionment drifted`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Honesty
// ─────────────────────────────────────────────────────────────────────────────

test('an idle facility reports zero rather than nothing', () => {
  const idle = profiles.filter((p) => p.receivedT === 0);
  assert.ok(idle.length > 0, 'the fixture should contain an idle plant');
  for (const p of idle) {
    assert.equal(p.netT, 0);
    assert.equal(p.perTonneT, 0);
    assert.equal(p.arcs.length, 0);
    assert.ok(p.capacityT > 0, 'capacity is still real even when nothing was received');
    assert.match(p.why, /received (no|nothing)/i);
  }
});

test('charges are reported as positive quantities', () => {
  for (const p of profiles) {
    assert.ok(p.transportT >= -1e-9, `${p.name} transport should be a positive charge`);
    assert.ok(p.processT >= -1e-9, `${p.name} processing should be a positive charge`);
  }
});

test('utilisation never exceeds capacity', () => {
  for (const p of profiles) {
    assert.ok(p.receivedT <= p.capacityT + 1e-6, `${p.name} received more than its capacity`);
    assert.ok(p.headroomT >= 0);
    assert.ok(Math.abs(p.headroomT - (p.capacityT - p.receivedT)) < 1e-6);
  }
});

test('the explanation names the facility and never claims verification', () => {
  const forbidden = /\b(verified|certified|audited|carbon credit|guaranteed)\b/i;
  for (const p of profiles) {
    assert.ok(p.why.includes(p.name), `${p.id} explanation should name the plant`);
    assert.doesNotMatch(p.why, forbidden);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Opportunities
// ─────────────────────────────────────────────────────────────────────────────

test('every opportunity is priced and carries its reason', () => {
  const all = profiles.flatMap((p) => p.opportunities);
  for (const o of all) {
    assert.ok(Number.isFinite(o.carbonDeltaT), 'an unpriced opportunity must not be shown');
    assert.ok(o.carbonDeltaT > 0, 'only opportunities that would help are offered');
    assert.ok(o.why.length > 40, 'the reason must survive being read');
    assert.ok(o.tonnes > 0);
  }
});

test('a binding-capacity opportunity is only offered where capacity actually binds', () => {
  for (const p of profiles) {
    const binding = p.opportunities.find((o) => o.kind === 'binding_capacity');
    if (binding) {
      assert.ok(p.shadow?.binding, `${p.name}: offered extra capacity but capacity is not binding`);
      assert.ok(p.shadow.carbonPerExtraTonne > 0);
    }
  }
});

test('an idle-capacity opportunity is only offered where there is headroom', () => {
  for (const p of profiles) {
    const idle = p.opportunities.find((o) => o.kind === 'idle_capacity');
    if (idle) {
      assert.ok(p.headroomT > 1, `${p.name}: offered to fill capacity it does not have`);
      assert.ok(idle.tonnes <= p.headroomT + 1e-6, 'cannot place more than the headroom');
    }
  }
});

test('offline facilities are offered no opportunities', () => {
  for (const p of profiles) {
    if (p.status === 'online') continue;
    assert.equal(p.opportunities.length, 0, `${p.name} is ${p.status} but was given advice`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Comparison
// ─────────────────────────────────────────────────────────────────────────────

test('a comparison reports both plants and a like-for-like set where one exists', () => {
  const working = ranking.filter((r) => r.receivedT > 0);
  const cmp = compareFacilities(net, result, working[0].id, working[1].id);
  assert.ok(cmp);
  assert.equal(cmp.a.id, working[0].id);
  assert.equal(cmp.b.id, working[1].id);
  assert.ok(cmp.rows.length >= 6);
  assert.ok(cmp.summary.includes(cmp.a.name) || cmp.summary.includes(cmp.b.name));
  for (const s of cmp.sharedSources) {
    assert.ok(s.aPerT !== null && s.bPerT !== null, 'a shared source must price both sides');
  }
});

test('comparison rows carry the direction that counts as better', () => {
  const working = ranking.filter((r) => r.receivedT > 0);
  const cmp = compareFacilities(net, result, working[0].id, working[1].id)!;
  const transport = cmp.rows.find((r) => r.key === 'transport');
  const net_ = cmp.rows.find((r) => r.key === 'net');
  assert.equal(transport?.higherIsBetter, false, 'more transport emissions is not better');
  assert.equal(net_?.higherIsBetter, true, 'more net carbon is better');
});

test('comparing against an idle plant says so rather than implying a result', () => {
  const idle = ranking.find((r) => r.receivedT === 0);
  const working = ranking.find((r) => r.receivedT > 0);
  if (!idle || !working) return;
  const cmp = compareFacilities(net, result, working.id, idle.id)!;
  assert.match(cmp.summary, /received nothing/i);
});

test('an unknown facility is refused rather than guessed at', () => {
  assert.equal(facilityCarbon(net, result, 'NOT-A-PLANT'), null);
  assert.equal(compareFacilities(net, result, 'NOT-A-PLANT', net.facilities[0].id), null);
});
