/**
 * The permanence basis contract.
 *
 * BC100 is derived from the dominant biochar feedstock, so a ledger built over a
 * SLICE of a plan is valued differently from the plan it belongs to. That defect
 * shipped four separate times — share denominators, scenario deltas, resilience
 * loss percentages and the brief's pathway bands — and every instance was silent:
 * the number stayed plausible, only the reconciliation failed.
 *
 * `networkLedger` now requires an explicit `PermanenceBasis`. This file proves
 * three things about that contract:
 *
 *   1. The parameter is load-bearing — the two bases really do disagree, so a
 *      caller that chose wrongly would produce a wrong number rather than a
 *      harmless one. A contract nobody can get wrong is also a contract that is
 *      not doing anything.
 *   2. Every decomposition the product performs sums to its whole. This is the
 *      property the contract exists to protect, checked end to end rather than
 *      per module.
 *   3. Whole-plan comparisons use own-basis on both sides, so a delta is never
 *      the difference between two differently-valued quantities.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNetwork } from '../src/network.ts';
import { optimize } from '../src/optimizer.ts';
import {
  dominantBiocharStream,
  inheritFrom,
  networkLedger,
  OWN_BASIS,
  type PermanenceBasis,
} from '../src/carbon.ts';
import { PATHWAYS } from '../src/pathways.ts';
import { facilityRanking } from '../src/facility.ts';
import { lineContributors, evidenceRegister } from '../src/evidence.ts';
import { runShock } from '../src/shock.ts';
import { buildBrief } from '../src/brief.ts';
import { carbonHistory } from '../src/history.ts';
import { findOpportunities } from '../src/opportunity.ts';
import { evidenceHealth } from '../src/evidence.ts';
import { resilienceReport } from '../src/bottleneck.ts';
import { buildLedger, aggregateAllocations, permanenceFor } from '../src/carbon.ts';
import type { Allocation, ScenarioInstance } from '../src/types.ts';

const net = buildNetwork();
const result = optimize(net, 'balanced');
const EPS = 1e-6;

const ledgerOf = (allocations: Allocation[], basis: PermanenceBasis) =>
  networkLedger(allocations, net.facilities, net.vehicles, net.assumptions, basis);

const WHOLE = ledgerOf(result.allocations, OWN_BASIS);
const NETWORK_BASIS = inheritFrom(result.allocations);

// ─────────────────────────────────────────────────────────────────────────────
// 1. The parameter is load-bearing
// ─────────────────────────────────────────────────────────────────────────────

test('the network produces biochar from more than one feedstock', () => {
  // If it did not, the two bases would coincide and this suite would prove
  // nothing. The fixture has to actually exercise the ambiguity.
  const streams = new Set(
    result.allocations
      .filter((a) => PATHWAYS[a.pathway].producesDurableRemoval)
      .map((a) => a.stream),
  );
  assert.ok(streams.size > 1, `only ${streams.size} biochar feedstock(s) — the bases cannot differ`);
});

test('own and inherited bases give different answers on a slice', () => {
  // Find a biochar slice whose own dominant feedstock is not the network's.
  const networkDominant = dominantBiocharStream(result.allocations);
  assert.ok(networkDominant, 'the fixture should produce durable removal');

  const divergent = result.allocations.filter(
    (a) => PATHWAYS[a.pathway].producesDurableRemoval && a.stream !== networkDominant,
  );
  assert.ok(divergent.length > 0, 'the fixture should contain a slice with a different feedstock');

  const own = ledgerOf(divergent, OWN_BASIS).netT;
  const inherited = ledgerOf(divergent, NETWORK_BASIS).netT;
  assert.ok(
    Math.abs(own - inherited) > EPS,
    `the basis parameter changed nothing (${own} vs ${inherited}) — it is not load-bearing`,
  );
});

test('an inherited basis reproduces the whole plan when given the whole plan', () => {
  const viaInherit = ledgerOf(result.allocations, NETWORK_BASIS).netT;
  assert.ok(Math.abs(viaInherit - WHOLE.netT) < EPS);
});

test('a null inherited stream means no permanence correction, and says so', () => {
  // Worth pinning because it is the contract's one subtlety: null does not mean
  // "no removal", it means "no feedstock to correct against", so BC100 stays at 1
  // and char carbon is reported ungraded. That is the right answer for a plan
  // with no biochar — where it is zero anyway — and the wrong thing to pass for a
  // slice that does produce char.
  const none = ledgerOf(result.allocations, { kind: 'inherit', stream: null });
  assert.equal(none.permanence, null, 'no permanence report should be produced');
  assert.ok(
    !none.lines.some((l) => l.key === 'char_permanence'),
    'no permanence adjustment line should appear',
  );
  assert.ok(
    none.durableRemovalT > WHOLE.durableRemovalT,
    'ungraded removal must exceed the permanence-corrected figure',
  );

  // A slice that genuinely contains no biochar reports zero removal under any basis.
  const noChar = result.allocations.filter((a) => !PATHWAYS[a.pathway].producesDurableRemoval);
  assert.equal(ledgerOf(noChar, { kind: 'inherit', stream: null }).durableRemovalT, 0);
  assert.equal(ledgerOf(noChar, OWN_BASIS).durableRemovalT, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Every decomposition sums to its whole
// ─────────────────────────────────────────────────────────────────────────────

test('per-allocation slices sum to the plan under the inherited basis', () => {
  const summed = result.allocations.reduce(
    (a, x) => a + ledgerOf([x], NETWORK_BASIS).netT,
    0,
  );
  assert.ok(Math.abs(summed - WHOLE.netT) < EPS, `parts ${summed} vs whole ${WHOLE.netT}`);
});

test('per-allocation slices do NOT sum to the plan under own basis', () => {
  // The counter-example that makes the rule necessary. If this ever starts
  // passing, the bases have coincided and the tests above have stopped biting.
  const summed = result.allocations.reduce((a, x) => a + ledgerOf([x], OWN_BASIS).netT, 0);
  assert.ok(
    Math.abs(summed - WHOLE.netT) > EPS,
    'own-basis slices summed to the whole — the ambiguity this contract guards has vanished',
  );
});

test('per-pathway slices sum to the plan', () => {
  const byPathway = new Map<string, Allocation[]>();
  for (const a of result.allocations) {
    const list = byPathway.get(a.pathway);
    if (list) list.push(a);
    else byPathway.set(a.pathway, [a]);
  }
  let summed = 0;
  for (const list of byPathway.values()) summed += ledgerOf(list, NETWORK_BASIS).netT;
  assert.ok(Math.abs(summed - WHOLE.netT) < EPS, `bands ${summed} vs whole ${WHOLE.netT}`);
});

test('per-facility slices sum to the plan, via the shipped ranking', () => {
  const summed = facilityRanking(net, result).reduce((a, r) => a + r.netT, 0);
  assert.ok(Math.abs(summed - WHOLE.netT) < EPS);
});

test('facility shares total 100% of the plan', () => {
  const share = facilityRanking(net, result).reduce((a, r) => a + r.sharePct, 0);
  assert.ok(Math.abs(share - 100) < 0.01, `shares total ${share.toFixed(4)}%`);
});

test('evidence line contributors sum to their line', () => {
  const records = evidenceRegister(net, result, WHOLE);
  for (const r of records) {
    const summed = lineContributors(net, result, r.key).reduce((a, c) => a + c.valueT, 0);
    assert.ok(Math.abs(summed - r.valueT) < EPS, `${r.key}: ${summed} vs ${r.valueT}`);
  }
});

test('shock changed-facility carbon is measured on each plan own basis', () => {
  // The instance fixed during this hardening pass: both sides of a facility
  // comparison must inherit from the plan they belong to, not from themselves.
  const shock = runShock(
    net,
    result,
    { kind: 'facility_offline', params: { facilityId: 'FAC-PL-02' } } as ScenarioInstance,
    'balanced',
  );
  for (const f of shock.changedFacilities) {
    assert.ok(
      Math.abs(f.afterCarbonT - f.beforeCarbonT - f.carbonDeltaT) < EPS,
      `${f.name}: delta is not the difference`,
    );
  }
  // The before-side slices must reconstruct the baseline plan.
  const beforeSlices = net.facilities.reduce((a, f) => {
    const slice = result.allocations.filter((x) => x.facilityId === f.id);
    return slice.length === 0 ? a : a + ledgerOf(slice, NETWORK_BASIS).netT;
  }, 0);
  assert.ok(Math.abs(beforeSlices - WHOLE.netT) < EPS);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Whole-plan comparisons never mix bases
// ─────────────────────────────────────────────────────────────────────────────

test('a shock compares two whole plans, each on its own basis', () => {
  const scenario: ScenarioInstance = {
    kind: 'facility_offline',
    params: { facilityId: 'FAC-PL-02' },
  };
  const shock = runShock(net, result, scenario, 'balanced');

  // The baseline side must equal the live plan valued on its own basis.
  assert.ok(Math.abs(shock.baseline.netT - WHOLE.netT) < EPS);
  // And the delta must be the difference of the two sides, not of mixed bases.
  assert.ok(Math.abs(shock.after.netT - shock.baseline.netT - shock.carbonDeltaT) < 1e-9);
  // The line diff, which is a decomposition of the CHANGE, must reconcile too.
  const lines = shock.lineDeltas.reduce((a, l) => a + l.delta, 0);
  assert.ok(Math.abs(lines - shock.carbonDeltaT) < EPS);
});

test('opportunities compare whole plans and agree with a direct own-basis reading', () => {
  const report = findOpportunities(net, result);
  assert.ok(Math.abs(report.current.carbonT - WHOLE.netT) < EPS);
  for (const o of report.opportunities.slice(0, 3)) {
    assert.ok(Math.abs(o.measure.carbonBeforeT - WHOLE.netT) < EPS, `${o.id}: before drifted`);
  }
});

test('the brief inherits for its bands and owns for its position', () => {
  const history = carbonHistory(net, 'balanced', 12);
  const opp = findOpportunities(net, result);
  const ranking = facilityRanking(net, result);
  const evidence = evidenceHealth(evidenceRegister(net, result, WHOLE));
  const resilience = resilienceReport(net, result, 'balanced');
  const worst = runShock(
    net,
    result,
    { kind: 'facility_offline', params: { facilityId: resilience.worstCaseFacilityId } },
    'balanced',
  );
  const brief = buildBrief({
    state: net,
    result,
    version: 0,
    ledger: WHOLE,
    history,
    opportunities: opp.opportunities,
    ranking,
    evidence,
    resilience,
    worstShock: worst,
    objectives: null,
  });

  // Position: the whole plan.
  assert.ok(Math.abs(brief.position.netT - WHOLE.netT) < EPS);
  // Bands: a decomposition of it.
  const bands = brief.flow.reduce((a, f) => a + f.netT, 0);
  assert.ok(Math.abs(bands - WHOLE.netT) < EPS, `bands ${bands} vs whole ${WHOLE.netT}`);
});

test('resilience loss percentages are computed on the ledger, not the optimiser aggregate', () => {
  const res = resilienceReport(net, result, 'balanced');
  // totals.netCarbonT and the ledger differ on this network, so a loss computed
  // from totals would be materially different.
  assert.ok(Math.abs(result.totals.netCarbonT - WHOLE.netT) > 100);
  const worst = res.n1Results[0];
  assert.ok(worst.lossPct > 0 && worst.lossPct < 100);

  // Recompute the worst case independently and require agreement.
  const shock = runShock(
    net,
    result,
    { kind: 'facility_offline', params: { facilityId: worst.facilityId } },
    'balanced',
  );
  const expected = (-shock.carbonDeltaT / WHOLE.netT) * 100;
  assert.ok(
    Math.abs(expected - worst.lossPct) < 1.5,
    `resilience says ${worst.lossPct.toFixed(2)}%, shock implies ${expected.toFixed(2)}%`,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// The contract itself
// ─────────────────────────────────────────────────────────────────────────────

test('inheritFrom reads the dominant feedstock of the plan it is given', () => {
  const basis = inheritFrom(result.allocations);
  assert.equal(basis.kind, 'inherit');
  assert.equal(basis.stream, dominantBiocharStream(result.allocations));
});

test('own basis matches building the ledger by hand with the same feedstock', () => {
  const dominant = dominantBiocharStream(result.allocations);
  const byHand = buildLedger(
    aggregateAllocations(result.allocations, net.facilities, net.vehicles, net.assumptions),
    net.assumptions,
    dominant ? permanenceFor(dominant, net.assumptions.soilTempC) : null,
    false,
  );
  assert.ok(Math.abs(byHand.netT - WHOLE.netT) < EPS);
});
