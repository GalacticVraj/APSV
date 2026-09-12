/**
 * The Carbon Intelligence Brief.
 *
 * The brief is the last place a discrepancy could hide, and the most dangerous:
 * it is the screen a decision-maker reads *instead of* the others, so a figure
 * that drifts here is a figure nobody cross-checks. Its whole design is that it
 * computes nothing — and this file is what holds that to be true.
 *
 * Every test below asserts the same thing from a different direction: the brief's
 * number IS the owning module's number, not a copy that happens to agree today.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNetwork } from '../src/network.ts';
import { optimize } from '../src/optimizer.ts';
import { networkLedger } from '../src/carbon.ts';
import { resilienceReport } from '../src/bottleneck.ts';
import { buildBrief } from '../src/brief.ts';
import { findOpportunities } from '../src/opportunity.ts';
import { runShock, compareObjectives } from '../src/shock.ts';
import { facilityRanking } from '../src/facility.ts';
import { evidenceRegister, evidenceHealth } from '../src/evidence.ts';
import { carbonHistory } from '../src/history.ts';
import { buildLedger, aggregateAllocations, dominantBiocharStream, permanenceFor } from '../src/carbon.ts';
import type { ScenarioInstance } from '../src/types.ts';

const net = buildNetwork();
const result = optimize(net, 'balanced');

const dominant = dominantBiocharStream(result.allocations);
const LEDGER = buildLedger(
  aggregateAllocations(result.allocations, net.facilities, net.vehicles, net.assumptions),
  net.assumptions,
  dominant ? permanenceFor(dominant, net.assumptions.soilTempC) : null,
  true,
);

const history = carbonHistory(net, 'balanced');
const oppReport = findOpportunities(net, result);
const ranking = facilityRanking(net, result);
const evidence = evidenceHealth(evidenceRegister(net, result, LEDGER));
const resilience = resilienceReport(net, result, 'balanced');
const worstScenario: ScenarioInstance = {
  kind: 'facility_offline',
  params: { facilityId: resilience.worstCaseFacilityId },
};
const worstShock = runShock(net, result, worstScenario, 'balanced');
const objectives = compareObjectives(net, worstScenario, 'balanced');

const BRIEF = buildBrief({
  state: net,
  result,
  version: 0,
  ledger: LEDGER,
  history,
  opportunities: oppReport.opportunities,
  ranking,
  evidence,
  resilience,
  worstShock,
  objectives,
});

const EPS = 1e-6;

// ─────────────────────────────────────────────────────────────────────────────
// The position is the ledger
// ─────────────────────────────────────────────────────────────────────────────

test('report net carbon is the networkLedger figure', () => {
  const authoritative = networkLedger(
    result.allocations,
    net.facilities,
    net.vehicles,
    net.assumptions,
  );
  assert.ok(Math.abs(BRIEF.position.netT - authoritative.netT) < EPS);
  assert.ok(Math.abs(BRIEF.position.netT - LEDGER.netT) < EPS);
});

test('the decomposition reconciles exactly to net', () => {
  const p = BRIEF.position;
  const recon = p.removalT + p.avoidedT + p.substitutionT - p.transportT - p.processT;
  assert.ok(
    Math.abs(recon - p.netT) < EPS,
    `decomposition ${recon.toFixed(6)} vs net ${p.netT.toFixed(6)}`,
  );
  assert.ok(Math.abs(p.grossBenefitT - (p.removalT + p.avoidedT + p.substitutionT)) < EPS);
});

test('removal, avoidance and substitution stay distinct', () => {
  const p = BRIEF.position;
  assert.ok(Math.abs(p.removalT - LEDGER.durableRemovalT) < EPS);
  assert.ok(Math.abs(p.avoidedT - LEDGER.avoidedEmissionsT) < EPS);
  assert.ok(Math.abs(p.substitutionT - LEDGER.substitutionT) < EPS);
  assert.ok(Math.abs(p.avoidedT - p.substitutionT) > 1, 'they should be genuinely different');
});

test('charges are reported positive and subtracted, never as benefits', () => {
  assert.ok(BRIEF.position.transportT >= -EPS);
  assert.ok(BRIEF.position.processT >= -EPS);
  // And they partition the emission lines with nothing left over.
  const emissions = LEDGER.lines
    .filter((l) => l.kind === 'emission')
    .reduce((a, l) => a + l.valueT, 0);
  assert.ok(Math.abs(BRIEF.position.transportT + BRIEF.position.processT + emissions) < EPS);
});

// ─────────────────────────────────────────────────────────────────────────────
// Every section equals the module that owns it
// ─────────────────────────────────────────────────────────────────────────────

test('report best action is the top opportunity, instance included', () => {
  const top = oppReport.opportunities[0];
  assert.ok(BRIEF.action);
  assert.equal(BRIEF.action.headline, top.headline);
  assert.ok(Math.abs(BRIEF.action.carbonDeltaT - top.measure.carbonDeltaT) < EPS);
  assert.ok(Math.abs(BRIEF.action.marginDeltaInr - top.measure.marginDeltaInr) < 1e-6);
  assert.deepEqual(BRIEF.action.scenario, top.scenario, 'the ScenarioInstance was rebuilt');
});

test('the brief action simulates to the figure the brief reports', () => {
  // §21.4 — the CTA must reproduce the number beside it.
  const sim = runShock(net, result, BRIEF.action!.scenario, result.objective);
  assert.ok(
    Math.abs(sim.carbonDeltaT - BRIEF.action!.carbonDeltaT) < EPS,
    `simulation ${sim.carbonDeltaT} vs brief ${BRIEF.action!.carbonDeltaT}`,
  );
});

test('report scenario result equals the shock engine', () => {
  const r = BRIEF.risk!;
  assert.ok(Math.abs(r.baselineNetT - worstShock.baseline.netT) < EPS);
  assert.ok(Math.abs(r.afterNetT - worstShock.after.netT) < EPS);
  assert.ok(Math.abs(r.carbonDeltaT - worstShock.carbonDeltaT) < EPS);
  assert.ok(Math.abs(r.afterNetT - r.baselineNetT - r.carbonDeltaT) < 1e-9);
  assert.deepEqual(r.scenario, worstScenario);
});

test('the risk baseline is the live plan, not a separate solve', () => {
  assert.ok(Math.abs(BRIEF.risk!.baselineNetT - BRIEF.position.netT) < EPS);
});

test('report facility values equal Carbon Facilities', () => {
  const c = BRIEF.contributors;
  const byId = new Map(ranking.map((r) => [r.id, r]));
  for (const row of [c.best, c.weakestPerTonne, c.largestIdle]) {
    if (!row) continue;
    const owner = byId.get(row.id)!;
    assert.ok(Math.abs(row.netT - owner.netT) < EPS, `${row.name}: net disagrees`);
    assert.ok(Math.abs(row.perTonneT - owner.perTonneT) < EPS);
    assert.ok(Math.abs(row.receivedT - owner.receivedT) < EPS);
  }
  // And the selections are actually the extremes they claim to be.
  const working = ranking.filter((r) => r.receivedT > 0);
  assert.equal(c.best!.id, working[0].id);
  assert.equal(
    c.weakestPerTonne!.id,
    [...working].sort((a, b) => a.perTonneT - b.perTonneT)[0].id,
  );
});

test('report pathway bands reconcile to the network ledger', () => {
  const sum = BRIEF.flow.reduce((a, f) => a + f.netT, 0);
  assert.ok(Math.abs(sum - LEDGER.netT) < EPS, `bands ${sum} vs ledger ${LEDGER.netT}`);
  const tonnes = BRIEF.flow.reduce((a, f) => a + f.tonnes, 0);
  assert.ok(Math.abs(tonnes - result.totals.divertedT) < 0.5);
  for (const f of BRIEF.flow) {
    assert.ok(Math.abs(f.perTonneT - f.netT / f.tonnes) < 1e-9, `${f.label}: rate is not the ratio`);
  }
});

test('report evidence counts equal MRV', () => {
  assert.deepEqual(BRIEF.evidence.byStatus, evidence.byStatus);
  assert.deepEqual(BRIEF.evidence.inputsByBasis, evidence.inputsByBasis);
  assert.equal(BRIEF.evidence.totalRecords, evidence.totalRecords);
  assert.equal(BRIEF.evidence.byStatus.measured, 0, 'nothing in this dataset is measured');
});

test('report trend equals Carbon Home history', () => {
  assert.ok(BRIEF.trend);
  assert.ok(Math.abs(BRIEF.trend.deltaT - history.period.deltaT) < EPS);
  assert.ok(Math.abs(BRIEF.trend.deltaPct - history.period.deltaPct) < EPS);
  assert.equal(BRIEF.trend.improving, history.period.improving);
  assert.equal(BRIEF.trend.basis, history.basis);
});

test('report objective sweep equals the shock engine sweep', () => {
  assert.ok(BRIEF.objectives);
  assert.equal(BRIEF.objectives.length, objectives.length);
  for (let i = 0; i < objectives.length; i++) {
    assert.equal(BRIEF.objectives[i].objective, objectives[i].objective);
    assert.ok(Math.abs(BRIEF.objectives[i].carbonDeltaT - objectives[i].carbonDeltaT) < EPS);
  }
  assert.equal(BRIEF.objectives.filter((o) => o.isCurrent).length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Honesty
// ─────────────────────────────────────────────────────────────────────────────

test('building the brief never mutates the network or the solve', () => {
  const beforeNet = JSON.stringify(net);
  const beforeResult = JSON.stringify(result);
  buildBrief({
    state: net,
    result,
    version: 0,
    ledger: LEDGER,
    history,
    opportunities: oppReport.opportunities,
    ranking,
    evidence,
    resilience,
    worstShock,
    objectives,
  });
  assert.equal(JSON.stringify(net), beforeNet, 'the brief mutated the network');
  assert.equal(JSON.stringify(result), beforeResult, 'the brief mutated the solve');
});

test('the headline names only findings that are present', () => {
  assert.ok(BRIEF.headline.length > 120);
  if (BRIEF.action) assert.ok(BRIEF.headline.includes(BRIEF.action.headline.toLowerCase().slice(0, 20)));
  if (BRIEF.risk) assert.ok(BRIEF.headline.includes(BRIEF.risk.facilityName));
});

test('no section claims verification, certification or measurement', () => {
  const forbidden = /\b(verified|certified|accredited|audit ready|guaranteed|carbon credit)\b/i;
  const prose = [
    BRIEF.headline,
    BRIEF.whatChanged,
    BRIEF.action?.why ?? '',
    BRIEF.action?.whyNotAlready ?? '',
    BRIEF.risk?.why ?? '',
    ...Object.values(BRIEF.methodology).flat().map(String),
  ];
  for (const p of prose) assert.doesNotMatch(p, forbidden, p.slice(0, 90));
});

test('the methodology states the model basis and its limitations', () => {
  const m = BRIEF.methodology;
  assert.ok(m.limitations.length >= 3);
  assert.match(m.limitations.join(' '), /model output/i);
  assert.match(m.limitations.join(' '), /not a record of historical emissions|not a measurement/i);
  assert.match(m.permanenceBasis, /never summed/i, 'the removal/avoidance rule must be stated');
  assert.match(m.planningWindow, /\d+-day/);
});

test('an empty section explains itself rather than being hidden', () => {
  const bare = buildBrief({
    state: net,
    result,
    version: 0,
    ledger: LEDGER,
    history: null,
    opportunities: [],
    ranking,
    evidence,
    resilience,
    worstShock: null,
    objectives: null,
  });
  assert.equal(bare.action, null);
  assert.equal(bare.risk, null);
  assert.equal(bare.trend, null);
  assert.ok(bare.notes.action && bare.notes.action.length > 40);
  assert.ok(bare.notes.risk && bare.notes.risk.length > 20);
  assert.ok(bare.notes.trend && bare.notes.trend.length > 40);
  assert.match(bare.headline, /No tested change improved net carbon/);
  assert.match(bare.whatChanged, /No material network change/);
});

test('the brief carries its planning window and never implies history', () => {
  assert.equal(BRIEF.windowDays, net.assumptions.windowDays);
  assert.equal(BRIEF.asOf, net.asOf);
  assert.ok(BRIEF.generatedAt.length > 0);
  assert.match(BRIEF.methodology.trendBasis, /re-solve|window/i);
});
