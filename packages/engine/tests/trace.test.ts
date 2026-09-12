/**
 * Traceability.
 *
 * The Carbon Ledger makes one claim that everything else rests on: a traced
 * contribution is a decomposition of the network figure, not a second opinion
 * about it. If traced lines ever stop summing into network lines, the screen is
 * lying — politely, and with citations, which is worse than an obvious error.
 *
 * The reconciliation test below is therefore the most important test in the file,
 * and the rest guard the ways it could quietly stop being true.
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
import { provenanceFor, traceAllocation, traceCandidates } from '../src/trace.ts';

const net = buildNetwork();
const result = optimize(net, 'balanced');

const networkAgg = aggregateAllocations(
  result.allocations,
  net.facilities,
  net.vehicles,
  net.assumptions,
);
const dominant = dominantBiocharStream(result.allocations);
const networkLedger = buildLedger(
  networkAgg,
  net.assumptions,
  dominant ? permanenceFor(dominant, net.assumptions.soilTempC) : null,
  false,
);

const traces = result.allocations.map((a) =>
  traceAllocation(net, result, a.sourceId, a.facilityId),
);

// ─────────────────────────────────────────────────────────────────────────────
// The claim
// ─────────────────────────────────────────────────────────────────────────────

test('every allocation in the plan can be traced', () => {
  assert.equal(traces.filter((t) => t !== null).length, result.allocations.length);
});

test('traced ledgers sum to the network ledger, line group by line group', () => {
  const sum = (f: (l: NonNullable<(typeof traces)[number]>) => number) =>
    traces.reduce((a, t) => a + (t ? f(t) : 0), 0);

  const checks: Array<[string, number, number]> = [
    ['net', sum((t) => t.ledger.netT), networkLedger.netT],
    ['durable removal', sum((t) => t.ledger.durableRemovalT), networkLedger.durableRemovalT],
    ['avoided', sum((t) => t.ledger.avoidedEmissionsT), networkLedger.avoidedEmissionsT],
    ['substitution', sum((t) => t.ledger.substitutionT), networkLedger.substitutionT],
    ['emissions', sum((t) => t.ledger.emissionsT), networkLedger.emissionsT],
  ];

  for (const [label, traced, network] of checks) {
    const tol = Math.max(1, Math.abs(network) * 1e-6);
    assert.ok(
      Math.abs(traced - network) < tol,
      `${label}: traced ${traced.toFixed(3)} vs network ${network.toFixed(3)}`,
    );
  }
});

test('permanence comes from the network feedstock, not the allocation', () => {
  // Using the allocation's own dominant stream would give a marginally different
  // BC100 per load and silently break the reconciliation above. Every trace that
  // books durable removal must carry the same BC100 as the network ledger.
  const withChar = traces.filter((t) => t && t.ledger.permanence !== null);
  if (withChar.length < 2) return;
  const first = withChar[0]!.ledger.permanence!.bc100;
  for (const t of withChar) {
    assert.equal(t!.ledger.permanence!.bc100, first, 'all traces must share one BC₁₀₀');
  }
});

test('a traced ledger uses the same line keys as the network ledger', () => {
  const networkKeys = new Set(networkLedger.lines.map((l) => l.key));
  for (const t of traces) {
    if (!t) continue;
    for (const l of t.ledger.lines) {
      assert.ok(
        networkKeys.has(l.key),
        `traced line "${l.key}" does not exist in the network ledger`,
      );
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Stages
// ─────────────────────────────────────────────────────────────────────────────

test('the stage chain reconciles to the traced net figure', () => {
  for (const t of traces) {
    if (!t) continue;
    const staged = t.stages.reduce((a, s) => a + (s.carbonT ?? 0), 0);
    assert.ok(
      Math.abs(staged - t.ledger.netT) < 1,
      `${t.key}: stages sum to ${staged.toFixed(2)} but the ledger says ${t.ledger.netT.toFixed(2)}`,
    );
  }
});

test('no carbon is booked twice across stages', () => {
  // Each stage owns a disjoint set of ledger lines; if two stages ever claimed the
  // same line the chain would still "reconcile" only by luck.
  for (const t of traces.slice(0, 5)) {
    if (!t) continue;
    const booked = t.stages.filter((s) => s.carbonT !== null);
    const total = booked.reduce((a, s) => a + (s.carbonT ?? 0), 0);
    const ledgerNonTotal = t.ledger.lines
      .filter((l) => l.kind !== 'total')
      .reduce((a, l) => a + l.valueT, 0);
    assert.ok(Math.abs(total - ledgerNonTotal) < 1, `${t.key}: double-booked or dropped carbon`);
  }
});

test('stages follow the physical order of the chain', () => {
  const expected = [
    'waste',
    'source',
    'route',
    'facility',
    'pathway',
    'processing',
    'outcome',
  ];
  for (const t of traces.slice(0, 3)) {
    if (!t) continue;
    assert.deepEqual(
      t.stages.map((s) => s.key),
      expected,
    );
  }
});

test('a stage with no carbon event reports null rather than zero', () => {
  // Zero and "nothing happened here" are different claims, and the UI renders
  // them differently on purpose.
  for (const t of traces.slice(0, 10)) {
    if (!t) continue;
    for (const s of t.stages) {
      if (s.carbonT === null) {
        assert.equal(s.carbonLabel, null);
        assert.equal(s.kind, null);
      } else {
        assert.ok(s.carbonLabel, `${s.key} books carbon but has no label`);
      }
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Route and identity
// ─────────────────────────────────────────────────────────────────────────────

test('road distance is never shorter than the straight line', () => {
  for (const t of traces) {
    if (!t) continue;
    assert.ok(
      t.route.roadKm >= t.route.straightKm - 1e-6,
      `${t.key}: road ${t.route.roadKm} < direct ${t.route.straightKm}`,
    );
    assert.ok(t.route.circuity >= 1 - 1e-6);
  }
});

test('an allocation that is not in the plan traces to null, not to an error', () => {
  assert.equal(traceAllocation(net, result, 'SRC-PB-01', 'NOT-A-FACILITY'), null);
  assert.equal(traceAllocation(net, result, 'NOT-A-SOURCE', 'FAC-PL-01'), null);
});

test('candidates are ranked by carbon magnitude and carry a real share', () => {
  const cands = traceCandidates(net, result);
  assert.ok(cands.length > 0);
  for (let i = 1; i < cands.length; i++) {
    assert.ok(Math.abs(cands[i - 1].netCarbonT) >= Math.abs(cands[i].netCarbonT));
  }
  const shareSum = cands.reduce((a, c) => a + c.sharePct, 0);
  assert.ok(shareSum > 0 && shareSum <= 100.01, `shares should total at most 100%, got ${shareSum}`);
});

test('every candidate resolves to a trace', () => {
  for (const c of traceCandidates(net, result, 8)) {
    const t = traceAllocation(net, result, c.sourceId, c.facilityId);
    assert.ok(t, `candidate ${c.key} could not be traced`);
    assert.equal(t.key, c.key);
    assert.ok(Math.abs(t.tonnes - c.tonnes) < 1e-6);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Provenance
// ─────────────────────────────────────────────────────────────────────────────

const networkProvenance = provenanceFor(
  networkAgg,
  net.assumptions.soilTempC,
  net.assumptions.gridEfTPerMwh,
  dominant,
);

test('provenance is recorded for every ledger line the plan produced', () => {
  const missing = networkLedger.lines
    .filter((l) => l.kind !== 'total')
    .map((l) => l.key)
    .filter((k) => !networkProvenance[k]);
  assert.deepEqual(missing, [], `ledger lines with no provenance: ${missing.join(', ')}`);
});

test('provenance never describes a line the plan did not produce', () => {
  const produced = new Set(networkLedger.lines.map((l) => l.key));
  for (const key of Object.keys(networkProvenance)) {
    assert.ok(produced.has(key), `provenance for "${key}" but no such ledger line`);
  }
});

test('every provenance row carries a finite value and a unit', () => {
  for (const [key, rows] of Object.entries(networkProvenance)) {
    assert.ok(rows.length > 0, `${key} has an empty provenance list`);
    for (const r of rows) {
      assert.ok(Number.isFinite(r.value), `${key}/${r.input} has a non-finite value`);
      assert.ok(r.unit.length > 0, `${key}/${r.input} has no unit`);
      assert.equal(r.status, 'modelled');
    }
  }
});

test('every factor row cites a source', () => {
  // A factor without a citation is exactly the thing this screen exists to refuse.
  for (const [key, rows] of Object.entries(networkProvenance)) {
    for (const r of rows) {
      if (r.factor === null) continue;
      assert.ok(
        r.factorSource && r.factorSource.length > 0,
        `${key}/${r.input} applies a factor with no source`,
      );
    }
  }
});

test('provenance quantities match the aggregate they came from', () => {
  const transport = networkProvenance.em_transport;
  if (transport) {
    const diesel = transport.find((r) => r.input.startsWith('Diesel burned'));
    assert.ok(diesel);
    assert.ok(Math.abs(diesel.value - networkAgg.transportDieselL) < 1e-6);
  }
  const coal = networkProvenance.sub_coal;
  if (coal) {
    const energy = coal.find((r) => r.unit === 'GJ');
    assert.ok(energy, 'coal energy should be quoted in GJ to match the ledger basis');
    assert.ok(Math.abs(energy.value - networkAgg.coalDisplacedMj / 1000) < 1e-6);
  }
});

test('a trace carries provenance for its own lines', () => {
  const t = traces.find((x) => x !== null)!;
  for (const l of t.ledger.lines) {
    if (l.kind === 'total') continue;
    assert.ok(t.provenance[l.key], `traced line "${l.key}" has no provenance`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Explanation
// ─────────────────────────────────────────────────────────────────────────────

test('the explanation quotes the trace it belongs to', () => {
  for (const t of traces.slice(0, 6)) {
    if (!t) continue;
    assert.ok(t.why.includes(t.facilityName), 'the explanation should name the facility');
    assert.match(t.why, /tCO₂e/);
    assert.ok(t.why.length > 60, 'the explanation should be a sentence, not a fragment');
  }
});

test('the explanation never claims measurement or verification', () => {
  const forbidden = /\b(verified|certified|measured|audited|credit issued)\b/i;
  for (const t of traces) {
    if (!t) continue;
    assert.doesNotMatch(t.why, forbidden, `"${t.why}"`);
  }
});
