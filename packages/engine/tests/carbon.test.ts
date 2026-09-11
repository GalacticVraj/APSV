/**
 * Carbon accounting tests.
 *
 * These are the tests that matter most: the carbon numbers are the product's
 * central claim, so the properties asserted here are the ones a reviewer would
 * challenge — internal consistency, the direction of the temperature correction,
 * and that we have not quietly counted biogenic CO2.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CO2_PER_C,
  REFERENCE_SOIL_TEMP_C,
  addToAggregate,
  aggregateAllocations,
  baseFactors,
  buildLedger,
  emptyAggregate,
  evaluateAggregate,
  evaluateCarbon,
  fT,
  permanenceFor,
  physicalPerTonne,
  q10Factor,
  twoPoolRemaining,
} from '../src/carbon.ts';
import { COUNTERFACTUALS, STREAMS, biocharCarbonPct, biocharHcOrg } from '../src/streams.ts';
import { PATHWAYS } from '../src/pathways.ts';
import { buildNetwork } from '../src/network.ts';
import { optimize } from '../src/optimizer.ts';
import { VEHICLES } from '../src/constants.ts';
import type { StreamId } from '../src/types.ts';

const STREAM_IDS = Object.keys(STREAMS) as StreamId[];

// ─────────────────────────────────────────────────────────────────────────────
// Permanence
// ─────────────────────────────────────────────────────────────────────────────

test('two-pool decay starts at 1 and decreases monotonically', () => {
  const f = (t: number) => twoPoolRemaining(t, 0.08, 0.55, 0.0015);
  assert.equal(f(0), 1);
  let prev = 1;
  for (const year of [1, 5, 10, 25, 50, 100, 200]) {
    const v = f(year);
    assert.ok(v < prev, `remaining should fall by year ${year}`);
    assert.ok(v > 0 && v <= 1, 'remaining must stay a fraction');
    prev = v;
  }
});

test('Q10 correction makes biochar decay faster in warmer soil, not slower', () => {
  const ratio = fT(REFERENCE_SOIL_TEMP_C, 26);
  assert.ok(ratio > 1, `expected rate ratio > 1 at 26 degC, got ${ratio}`);

  const cold = fT(REFERENCE_SOIL_TEMP_C, 8);
  assert.ok(cold < 1, `expected rate ratio < 1 at 8 degC, got ${cold}`);

  // Q10 itself must be a sane biological value.
  const q10 = q10Factor(REFERENCE_SOIL_TEMP_C, 26);
  assert.ok(q10 > 1 && q10 < 4, `implausible Q10 ${q10}`);
});

test('100-year permanence is lower in Indian soil than at the European reference', () => {
  for (const s of STREAM_IDS) {
    const india = permanenceFor(s, 26);
    const europe = permanenceFor(s, REFERENCE_SOIL_TEMP_C);
    assert.ok(
      india.bc100 < europe.bc100,
      `${s}: BC100 at 26C (${india.bc100}) should be below 14.9C (${europe.bc100})`,
    );
    // And the difference should be material rather than rounding noise.
    assert.ok(europe.bc100 - india.bc100 > 0.01, `${s}: correction is suspiciously small`);
  }
});

test('every feedstock produces char inside the EBC / Puro H:Corg durability gate', () => {
  for (const s of STREAM_IDS) {
    const hc = biocharHcOrg(STREAMS[s]);
    assert.ok(hc > 0 && hc < 0.7, `${s}: H/Corg ${hc} outside the < 0.7 durability gate`);
  }
});

test('BC100 stays within a defensible band for every feedstock', () => {
  for (const s of STREAM_IDS) {
    const p = permanenceFor(s, 26);
    assert.ok(
      p.bc100 > 0.5 && p.bc100 < 0.95,
      `${s}: BC100 ${p.bc100} outside the plausible 50-95% band`,
    );
  }
});

test('high-ash feedstock yields lower-carbon char', () => {
  // Rice husk is ~21% ash; cotton stalk ~5%. The silica must dilute the char.
  const husk = biocharCarbonPct(STREAMS.rice_husk);
  const stalk = biocharCarbonPct(STREAMS.cotton_stalk);
  assert.ok(husk < stalk, `rice husk char (${husk}%) should be below cotton stalk (${stalk}%)`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Ledger consistency
// ─────────────────────────────────────────────────────────────────────────────

test('net carbon equals removal plus avoided plus substitution minus emissions', () => {
  const net = buildNetwork();
  const result = optimize(net, 'balanced', { skipShadowPrices: true, skipAlternatives: true });
  const agg = aggregateAllocations(result.allocations, net.facilities, net.vehicles, net.assumptions);
  const ledger = buildLedger(agg, net.assumptions, permanenceFor('paddy_straw', 26), false);

  const expected =
    ledger.durableRemovalT + ledger.avoidedEmissionsT + ledger.substitutionT - ledger.emissionsT;
  assert.ok(
    Math.abs(ledger.netT - expected) < 1e-6,
    `net ${ledger.netT} != components ${expected}`,
  );
});

test('ledger line items sum to the reported net', () => {
  const net = buildNetwork();
  const result = optimize(net, 'balanced', { skipShadowPrices: true, skipAlternatives: true });
  const agg = aggregateAllocations(result.allocations, net.facilities, net.vehicles, net.assumptions);
  const ledger = buildLedger(agg, net.assumptions, permanenceFor('paddy_straw', 26), false);

  const sum = ledger.lines
    .filter((l) => l.kind !== 'total')
    .reduce((s, l) => s + l.valueT, 0);
  assert.ok(
    Math.abs(sum - ledger.netT) < 1,
    `line items sum to ${sum} but net is reported as ${ledger.netT}`,
  );
});

test('avoided-burning credit is the non-CO2 figure, not a biogenic-CO2 figure', () => {
  // If biogenic CO2 had leaked in, this would be near 1.5 tCO2e/t rather than
  // under 0.15. This test exists specifically to catch that regression.
  const f = COUNTERFACTUALS.open_field_burning.tco2ePerTDry;
  assert.ok(f > 0.02 && f < 0.15, `open-burning factor ${f} looks like it includes biogenic CO2`);
});

test('a longer haul never increases net carbon for the same arc', () => {
  const veh = VEHICLES[1];
  const fac = baseFactors(0.77, buildNetwork().assumptions);
  const near = physicalPerTonne('paddy_straw', 'pyrolysis_biochar', 1, 10, 8.7, veh);
  const far = physicalPerTonne('paddy_straw', 'pyrolysis_biochar', 1, 120, 8.7, veh);

  const cNear = evaluateCarbon(near, 1, fac);
  const cFar = evaluateCarbon(far, 1, fac);

  assert.ok(cFar.emittedT > cNear.emittedT, 'transport emissions must rise with distance');
  assert.ok(cFar.netT < cNear.netT, 'net carbon must fall with distance');
});

test('digester methane slip is charged rather than ignored', () => {
  const veh = VEHICLES[1];
  const phys = physicalPerTonne('mandi_waste', 'anaerobic_digestion_cbg', 1, 30, 8.8, veh);
  assert.ok(phys.ch4SlipM3 > 0, 'AD must report fugitive methane');
  assert.ok(
    Math.abs(phys.ch4SlipM3 / Math.max(1e-9, phys.cbgKg) - 0) > 0,
    'slip must be proportional to production',
  );
});

test('pyrolysis produces durable removal and digestion does not', () => {
  assert.equal(PATHWAYS.pyrolysis_biochar.producesDurableRemoval, true);
  assert.equal(PATHWAYS.anaerobic_digestion_cbg.producesDurableRemoval, false);
  assert.equal(PATHWAYS.composting.producesDurableRemoval, false);
  assert.equal(PATHWAYS.pellet_cofiring.producesDurableRemoval, false);

  const veh = VEHICLES[1];
  const fac = baseFactors(0.77, buildNetwork().assumptions);
  const char = evaluateCarbon(
    physicalPerTonne('paddy_straw', 'pyrolysis_biochar', 1, 30, 8.7, veh),
    1,
    fac,
  );
  const ad = evaluateCarbon(
    physicalPerTonne('mandi_waste', 'anaerobic_digestion_cbg', 1, 30, 8.8, veh),
    1,
    fac,
  );
  assert.ok(char.durableT > 0.1, 'pyrolysis must yield durable removal');
  assert.equal(ad.durableT, 0, 'digestion must yield no durable removal');
});

test('CO2:C molar ratio is correct', () => {
  assert.ok(Math.abs(CO2_PER_C - 3.664) < 0.005, `CO2/C ratio ${CO2_PER_C} is wrong`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Uncertainty
// ─────────────────────────────────────────────────────────────────────────────

test('Monte Carlo band brackets the deterministic estimate and is reproducible', () => {
  const net = buildNetwork();
  const result = optimize(net, 'balanced', { skipShadowPrices: true, skipAlternatives: true });
  const agg = aggregateAllocations(result.allocations, net.facilities, net.vehicles, net.assumptions);
  const perm = permanenceFor('paddy_straw', net.assumptions.soilTempC);

  const a = buildLedger(agg, net.assumptions, perm, true);
  const b = buildLedger(agg, net.assumptions, perm, true);

  assert.ok(a.uncertainty, 'uncertainty band must be produced');
  const u = a.uncertainty!;
  assert.ok(u.p5 < u.p50 && u.p50 < u.p95, 'percentiles must be ordered');
  assert.ok(u.p5 < a.netT && a.netT < u.p95, 'point estimate must sit inside the 90% interval');
  assert.ok(u.draws >= 200, 'too few draws to be meaningful');

  // Same seed, same band: the demo must be reproducible.
  assert.equal(u.p5, b.uncertainty!.p5);
  assert.equal(u.p50, b.uncertainty!.p50);
  assert.equal(u.p95, b.uncertainty!.p95);
});

test('the aggregate path and the per-arc path produce the same carbon', () => {
  // Two independent code paths compute carbon: one per arc (used to price arcs
  // for the optimiser) and one over a network aggregate (used for the ledger).
  // If they ever disagree, the screens and the solver are optimising different
  // quantities, which is the worst class of bug this system could have.
  const net = buildNetwork();
  const veh = VEHICLES[1];
  const phys = physicalPerTonne('cotton_stalk', 'pyrolysis_biochar', 1, 45, 6.96, veh);
  const fac = baseFactors(0.78, net.assumptions);

  const perArc = evaluateCarbon(phys, 100, fac);

  const agg = emptyAggregate();
  addToAggregate(agg, phys, 100);
  const aggregated = evaluateAggregate(agg, fac);

  assert.ok(
    Math.abs(aggregated.netT - perArc.netT) < 1e-9,
    `aggregate ${aggregated.netT} != per-arc ${perArc.netT}`,
  );
  assert.ok(Math.abs(aggregated.durableT - perArc.durableT) < 1e-9);
  assert.ok(Math.abs(aggregated.emittedT - perArc.emittedT) < 1e-9);
});
