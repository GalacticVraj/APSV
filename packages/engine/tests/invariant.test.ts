/**
 * The trust invariant: one number, one calculation, one trace.
 *
 * Five Carbon modules now describe the same plan — Home, Ledger, Pathways,
 * Facilities and Evidence. Each was built to read the engine rather than
 * recompute it, but "built to" is a claim and this file is the proof. If any two
 * of them can disagree about a tonne of CO₂e, the product's central promise is
 * gone, and it will be gone quietly: every screen will still render, every number
 * will still look plausible, and only a reader who checks two pages will find it.
 *
 * These tests are deliberately cross-module. The per-module suites check that each
 * piece is internally consistent; this one checks that the pieces agree with each
 * other, which is the failure the per-module suites cannot see.
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
import { facilityCarbon, facilityRanking } from '../src/facility.ts';
import { pathwayDecision } from '../src/pathwaychoice.ts';
import { evidenceRegister, lineContributors } from '../src/evidence.ts';

const net = buildNetwork();
const result = optimize(net, 'balanced');
const stranded = strandedLots(net, result);

/** The one authoritative ledger every module must agree with. */
const dominant = dominantBiocharStream(result.allocations);
const permanence = dominant ? permanenceFor(dominant, net.assumptions.soilTempC) : null;
const LEDGER = buildLedger(
  aggregateAllocations(result.allocations, net.facilities, net.vehicles, net.assumptions),
  net.assumptions,
  permanence,
  false,
);

const records = evidenceRegister(net, result, LEDGER);
const ranking = facilityRanking(net, result);

/** Tolerance is absolute and tight. A discrepancy is a bug, never a rounding choice. */
const EPS = 1e-6;

function line(key: string): number {
  return LEDGER.lines.find((l) => l.key === key)?.valueT ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidence register is the ledger
// ─────────────────────────────────────────────────────────────────────────────

test('every evidence record equals its ledger line exactly', () => {
  for (const r of records) {
    const l = LEDGER.lines.find((x) => x.key === r.key);
    assert.ok(l, `evidence record "${r.key}" has no ledger line`);
    assert.equal(r.valueT, l.valueT, `${r.key}: register and ledger disagree`);
    assert.equal(r.calculation, l.basis, `${r.key}: the stated calculation was rewritten`);
    assert.equal(r.source, l.source);
    assert.equal(r.unit, 'tCO₂e');
  }
});

test('the register covers every non-total ledger line and invents none', () => {
  const ledgerKeys = LEDGER.lines.filter((l) => l.kind !== 'total').map((l) => l.key).sort();
  const recordKeys = records.map((r) => r.key).sort();
  assert.deepEqual(recordKeys, ledgerKeys);
});

// ─────────────────────────────────────────────────────────────────────────────
// Backward trace reconstructs the line
// ─────────────────────────────────────────────────────────────────────────────

test('contributors sum to their ledger line, for every line', () => {
  let worst = 0;
  for (const r of records) {
    const contributors = lineContributors(net, result, r.key);
    const summed = contributors.reduce((a, c) => a + c.valueT, 0);
    worst = Math.max(worst, Math.abs(summed - r.valueT));
    assert.ok(
      Math.abs(summed - r.valueT) < EPS,
      `${r.key}: contributors ${summed.toFixed(6)} vs line ${r.valueT.toFixed(6)}`,
    );
  }
  assert.ok(worst < EPS, `worst backward-trace error ${worst.toExponential(2)}`);
});

test('contributor shares total 100% of their line', () => {
  for (const r of records) {
    const contributors = lineContributors(net, result, r.key);
    if (contributors.length === 0) continue;
    const share = contributors.reduce((a, c) => a + c.sharePct, 0);
    assert.ok(Math.abs(share - 100) < 0.01, `${r.key}: shares total ${share.toFixed(3)}%`);
  }
});

test('the contributor count in the register matches the actual trace', () => {
  for (const r of records) {
    assert.equal(
      lineContributors(net, result, r.key).length,
      r.contributorCount,
      `${r.key}: register claims ${r.contributorCount} contributors`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// The six required components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Each named component is checked the same way: the ledger line, the evidence
 * record and the backward trace must be one number.
 */
function assertComponent(key: string, expectSign: 'positive' | 'negative') {
  const l = LEDGER.lines.find((x) => x.key === key);
  assert.ok(l, `the fixture should contain a "${key}" line`);
  if (expectSign === 'positive') assert.ok(l.valueT > 0, `${key} should be a benefit`);
  else assert.ok(l.valueT < 0, `${key} should be a charge`);

  const record = records.find((r) => r.key === key);
  assert.ok(record, `no evidence record for ${key}`);
  assert.equal(record.valueT, l.valueT);

  const traced = lineContributors(net, result, key).reduce((a, c) => a + c.valueT, 0);
  assert.ok(Math.abs(traced - l.valueT) < EPS, `${key}: trace ${traced} vs ledger ${l.valueT}`);
}

test('a positive component reconciles across ledger, evidence and trace', () => {
  assertComponent('sub_coal', 'positive');
});

test('a negative component reconciles across ledger, evidence and trace', () => {
  assertComponent('em_parasitic', 'negative');
});

test('the transport contribution reconciles', () => {
  assertComponent('em_transport', 'negative');
});

test('the processing contribution reconciles', () => {
  // Digester slip is a processing charge distinct from parasitic grid draw.
  assertComponent('em_ch4_slip', 'negative');
});

test('a facility-level result reconciles with the ledger and with its own arcs', () => {
  const working = ranking.filter((r) => r.receivedT > 0);
  assert.ok(working.length > 0);
  const p = facilityCarbon(net, result, working[0].id, stranded)!;

  // Facility ledger equals the ranking row.
  assert.ok(Math.abs(p.netT - working[0].netT) < EPS, 'profile and ranking disagree');

  // Arcs equal the facility.
  const arcSum = p.arcs.reduce((a, x) => a + x.netCarbonT, 0);
  assert.ok(Math.abs(arcSum - p.netT) < EPS, `arcs ${arcSum} vs facility ${p.netT}`);

  // And each arc equals the Ledger's own forward trace of the same allocation.
  for (const a of p.arcs) {
    const t = traceAllocation(net, result, a.sourceId, p.id)!;
    assert.ok(
      Math.abs(t.ledger.netT - a.netCarbonT) < EPS,
      `${a.sourceName}: facilities ${a.netCarbonT} vs ledger trace ${t.ledger.netT}`,
    );
  }
});

test('a pathway-level result reconciles with its own ledger', () => {
  // Pathways evaluates hypothetical arcs, so it is checked against its own ledger
  // rather than against the plan — but the components must still reconcile and
  // must not double-count avoidance into substitution.
  const source = net.sources.slice().sort((a, b) => b.availableT - a.availableT)[0];
  const d = pathwayDecision(net, result, source.id, 'carbon_first')!;
  const resolved = d.options.filter((o) => o.perT && o.ledger);
  assert.ok(resolved.length > 0, 'the largest source should have a usable pathway');

  for (const o of resolved) {
    const per = o.ledger!.netT / d.availableT;
    assert.ok(Math.abs(per - o.perT!.net) < 1e-9, `${o.pathway}: ledger and arc net disagree`);

    const recon =
      o.perT!.durable + o.perT!.avoided + o.perT!.substitution - o.perT!.emitted;
    assert.ok(Math.abs(recon - o.perT!.net) < 1e-9, `${o.pathway}: components do not reconcile`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// No duplicated avoidance / substitution
// ─────────────────────────────────────────────────────────────────────────────

test('avoidance and substitution are never the same quantity', () => {
  // The regression: Arc.avoidedPerT is (avoided + substitution). If any module
  // reads it as "avoided" and reports substitution separately, the two become
  // arithmetically linked and the components stop summing to net.
  const source = net.sources.slice().sort((a, b) => b.availableT - a.availableT)[0];
  const d = pathwayDecision(net, result, source.id, 'carbon_first')!;
  for (const o of d.options) {
    if (!o.perT || !o.ledger) continue;
    assert.ok(
      Math.abs(o.perT.avoided - o.ledger.avoidedEmissionsT / d.availableT) < 1e-9,
      `${o.pathway}: avoided is not the ledger's avoided`,
    );
    assert.ok(
      Math.abs(o.perT.substitution - o.ledger.substitutionT / d.availableT) < 1e-9,
      `${o.pathway}: substitution is not the ledger's substitution`,
    );
  }
});

test('the network keeps removal, avoidance and substitution on separate lines', () => {
  const kinds = new Set(LEDGER.lines.map((l) => l.kind));
  assert.ok(kinds.has('avoided'));
  assert.ok(kinds.has('substitution'));
  // No single line may carry both, which is what a merged figure would look like.
  for (const l of LEDGER.lines) {
    assert.notEqual(l.kind as string, 'avoided_substitution');
  }
  const avoided = LEDGER.lines.filter((l) => l.kind === 'avoided').reduce((a, l) => a + l.valueT, 0);
  const substitution = LEDGER.lines
    .filter((l) => l.kind === 'substitution')
    .reduce((a, l) => a + l.valueT, 0);
  assert.ok(Math.abs(avoided - substitution) > 1, 'the two should be genuinely different figures');
  assert.ok(Math.abs(avoided - LEDGER.avoidedEmissionsT) < EPS);
  assert.ok(Math.abs(substitution - LEDGER.substitutionT) < EPS);
});

// ─────────────────────────────────────────────────────────────────────────────
// Aggregation and units
// ─────────────────────────────────────────────────────────────────────────────

test('the whole network reconciles from three independent decompositions', () => {
  // By facility, by allocation, and by ledger line — three routes to one number.
  const byFacility = ranking.reduce((a, r) => a + r.netT, 0);

  const byAllocation = result.allocations.reduce((a, x) => {
    const one = buildLedger(
      aggregateAllocations([x], net.facilities, net.vehicles, net.assumptions),
      net.assumptions,
      permanence,
      false,
    );
    return a + one.netT;
  }, 0);

  const byLine = LEDGER.lines.filter((l) => l.kind !== 'total').reduce((a, l) => a + l.valueT, 0);

  assert.ok(Math.abs(byFacility - LEDGER.netT) < EPS, `by facility: ${byFacility}`);
  assert.ok(Math.abs(byAllocation - LEDGER.netT) < EPS, `by allocation: ${byAllocation}`);
  assert.ok(Math.abs(byLine - LEDGER.netT) < EPS, `by line: ${byLine}`);
});

test('the ledger group totals equal the sum of their own lines', () => {
  const sumKind = (k: string) =>
    LEDGER.lines.filter((l) => l.kind === k).reduce((a, l) => a + l.valueT, 0);
  assert.ok(Math.abs(sumKind('avoided') - LEDGER.avoidedEmissionsT) < EPS);
  assert.ok(Math.abs(sumKind('substitution') - LEDGER.substitutionT) < EPS);
  // Durable removal is reported net of the permanence adjustment.
  assert.ok(
    Math.abs(sumKind('removal') + sumKind('adjustment') - LEDGER.durableRemovalT) < EPS,
    'durable removal should be gross removal plus the permanence adjustment',
  );
  assert.ok(Math.abs(-sumKind('emission') - LEDGER.emissionsT) < EPS);
});

test('transport and processing partition the emission lines with nothing left over', () => {
  const transport = line('em_transport') + line('em_aggregation');
  const processing = LEDGER.lines
    .filter((l) => l.kind === 'emission' && l.key !== 'em_transport' && l.key !== 'em_aggregation')
    .reduce((a, l) => a + l.valueT, 0);
  const all = LEDGER.lines.filter((l) => l.kind === 'emission').reduce((a, l) => a + l.valueT, 0);
  assert.ok(Math.abs(transport + processing - all) < EPS, 'an emission line belongs to neither');

  // And the facility split must partition the same way.
  const facTransport = ranking.reduce((a, r) => a + r.transportT, 0);
  const facProcess = ranking.reduce((a, r) => a + r.processT, 0);
  assert.ok(Math.abs(facTransport + facProcess - -all) < EPS);
});

test('no module reports a charge as a benefit', () => {
  for (const l of LEDGER.lines) {
    if (l.kind === 'emission') assert.ok(l.valueT <= 0, `${l.key} is an emission but positive`);
    if (l.kind === 'removal') assert.ok(l.valueT >= 0, `${l.key} is a removal but negative`);
  }
  for (const r of ranking) {
    assert.ok(r.transportT >= -EPS);
    assert.ok(r.processT >= -EPS);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Language
// ─────────────────────────────────────────────────────────────────────────────

test('no evidence record claims measurement or verification', () => {
  const forbidden = /\b(verified|certified|accredited|audited|measured|carbon credit)\b/i;
  for (const r of records) {
    assert.equal(r.status, 'modelled', `${r.key} is not a measurement and must not say so`);
    assert.doesNotMatch(r.calculation, forbidden, `${r.key} calculation: ${r.calculation}`);
  }
});
