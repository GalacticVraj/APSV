/**
 * The pathway decision.
 *
 * Two failure modes matter here. The first is a second opinion: if this module
 * ever stops reading the optimiser's own arcs, the page starts recommending a
 * pathway the plan disagrees with. The second is quieter — reporting avoidance
 * and substitution as if they were independent when the arc field it came from
 * had already added them together. That bug existed, was caught, and these tests
 * are what stop it coming back.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNetwork } from '../src/network.ts';
import { optimize } from '../src/optimizer.ts';
import { PATHWAY_IDS } from '../src/pathways.ts';
import {
  comparePathwayPair,
  materialCandidates,
  pathwayDecision,
  type PathwayDecision,
} from '../src/pathwaychoice.ts';

const net = buildNetwork();
const result = optimize(net, 'balanced');
const materials = materialCandidates(net);

const decisions: PathwayDecision[] = materials
  .slice(0, 14)
  .map((m) => pathwayDecision(net, result, m.id, 'carbon_first')!)
  .filter(Boolean);

// ─────────────────────────────────────────────────────────────────────────────
// Consistency with the engine
// ─────────────────────────────────────────────────────────────────────────────

test('the per-tonne components reconcile to net', () => {
  let worst = 0;
  for (const d of decisions) {
    for (const o of d.options) {
      if (!o.perT) continue;
      const recon = o.perT.durable + o.perT.avoided + o.perT.substitution - o.perT.emitted;
      worst = Math.max(worst, Math.abs(recon - o.perT.net));
    }
  }
  assert.ok(worst < 1e-9, `worst reconciliation error ${worst.toExponential(2)}`);
});

test('avoidance and substitution are reported separately, not double-counted', () => {
  // Arc.avoidedPerT is (avoided + substitution). Reading it directly and then also
  // reporting substitution would make the two identical and break the line above.
  for (const d of decisions) {
    for (const o of d.options) {
      if (!o.perT || !o.ledger) continue;
      assert.ok(
        Math.abs(o.perT.avoided - o.ledger.avoidedEmissionsT / d.availableT) < 1e-9,
        'avoided must come from the ledger, not the arc',
      );
      assert.ok(
        Math.abs(o.perT.substitution - o.ledger.substitutionT / d.availableT) < 1e-9,
        'substitution must come from the ledger',
      );
    }
  }
});

test('the ledger agrees with the arc valuation the optimiser ranked on', () => {
  let worst = 0;
  for (const d of decisions) {
    for (const o of d.options) {
      if (!o.perT || !o.ledger) continue;
      worst = Math.max(worst, Math.abs(o.ledger.netT / d.availableT - o.perT.net));
    }
  }
  assert.ok(worst < 1e-9, `worst ledger/arc divergence ${worst.toExponential(2)}`);
});

test('emissions split cleanly into transport and processing', () => {
  for (const d of decisions) {
    for (const o of d.options) {
      if (!o.perT) continue;
      assert.ok(Math.abs(o.perT.transport + o.perT.process - o.perT.emitted) < 1e-9);
      assert.ok(o.perT.transport >= -1e-9, 'transport is a charge, reported positive');
      assert.ok(o.perT.process >= -1e-9, 'processing is a charge, reported positive');
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Feasibility honesty
// ─────────────────────────────────────────────────────────────────────────────

test('every pathway is accounted for, none silently dropped', () => {
  for (const d of decisions) {
    assert.equal(d.options.length, PATHWAY_IDS.length);
    const seen = new Set(d.options.map((o) => o.pathway));
    for (const p of PATHWAY_IDS) assert.ok(seen.has(p), `${p} missing for ${d.source.name}`);
  }
});

test('an excluded pathway always says why', () => {
  for (const d of decisions) {
    for (const o of d.options) {
      if (o.perT) continue;
      const reason = o.feasible ? o.unavailableReason : o.blockedBy;
      assert.ok(reason && reason.length > 10, `${o.pathway} excluded with no usable reason`);
    }
  }
});

test('an infeasible pathway carries no result at all', () => {
  // Half a result is worse than none: it invites the reader to compare a number
  // that was never valid for this material.
  for (const d of decisions) {
    for (const o of d.options) {
      if (o.feasible) continue;
      assert.equal(o.perT, null);
      assert.equal(o.ledger, null);
      assert.equal(o.facility, null);
      assert.equal(o.route, null);
      assert.equal(o.econ, null);
    }
  }
});

test('a gated pathway names the gate that failed', () => {
  const gated = decisions.flatMap((d) => d.options).filter((o) => !o.feasible);
  assert.ok(gated.length > 0, 'the fixture should contain at least one gated pathway');
  for (const o of gated) {
    assert.match(o.blockedBy!, /:/, 'the gate should be named and quantified');
    assert.ok(o.gates.some((g) => !g.pass));
  }
});

test('a resolved option always carries a facility and a route', () => {
  for (const d of decisions) {
    for (const o of d.options) {
      if (!o.perT) continue;
      assert.ok(o.facility, `${o.pathway} has a result but no facility`);
      assert.ok(o.route, `${o.pathway} has a result but no route`);
      assert.ok(o.route.roadKm >= o.route.straightKm - 1e-6, 'road cannot beat the straight line');
      assert.ok(o.facility.headroomT >= 0);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Ranking and lenses
// ─────────────────────────────────────────────────────────────────────────────

test('carbon best really is the highest net carbon', () => {
  for (const d of decisions) {
    const resolved = d.options.filter((o) => o.perT);
    if (resolved.length === 0) {
      assert.equal(d.carbonBest, null);
      continue;
    }
    const top = Math.max(...resolved.map((o) => o.perT!.net));
    const named = resolved.find((o) => o.pathway === d.carbonBest);
    assert.ok(named);
    assert.ok(Math.abs(named.perT!.net - top) < 1e-9);
  }
});

test('economic best really is the highest margin', () => {
  for (const d of decisions) {
    const resolved = d.options.filter((o) => o.econ);
    if (resolved.length === 0) continue;
    const top = Math.max(...resolved.map((o) => o.econ!.marginPerT));
    const named = resolved.find((o) => o.pathway === d.economicBest);
    assert.ok(named && Math.abs(named.econ!.marginPerT - top) < 1e-9);
  }
});

test('the lens changes the leader, and carbon_first leads on carbon', () => {
  const m = materials[0];
  const carbon = pathwayDecision(net, result, m.id, 'carbon_first')!;
  const profit = pathwayDecision(net, result, m.id, 'profit_first')!;
  assert.equal(carbon.lensBest, carbon.carbonBest);
  assert.equal(profit.lensBest, profit.economicBest);
});

test('resolved options are ordered ahead of excluded ones', () => {
  for (const d of decisions) {
    const rank = d.options.map((o) => (o.perT ? 0 : o.feasible ? 1 : 2));
    for (let i = 1; i < rank.length; i++) {
      assert.ok(rank[i - 1] <= rank[i], `${d.source.name}: excluded option sorted above a usable one`);
    }
  }
});

test('a trade-off is stated only when the two bests actually differ', () => {
  for (const d of decisions) {
    if (d.carbonBest && d.economicBest && d.carbonBest !== d.economicBest) {
      assert.ok(d.tradeoff, `${d.source.name}: bests differ but no trade-off was stated`);
      assert.match(d.tradeoff, /tCO₂e/);
    } else {
      assert.equal(d.tradeoff, null, 'no trade-off should be claimed when the choices agree');
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// The flip
// ─────────────────────────────────────────────────────────────────────────────

function firstPair(): { d: PathwayDecision; a: string; b: string } | null {
  for (const d of decisions) {
    const r = d.options.filter((o) => o.perT);
    if (r.length >= 2) return { d, a: r[0].pathway, b: r[1].pathway };
  }
  return null;
}

test('drivers reconcile to the net change', () => {
  const pair = firstPair();
  assert.ok(pair, 'the fixture should contain a material with two usable pathways');
  const diff = comparePathwayPair(pair.d, pair.a as never, pair.b as never)!;
  const summed = diff.drivers.reduce((x, dr) => x + dr.deltaT, 0);
  assert.ok(
    Math.abs(summed - diff.netDeltaTotal) < 1,
    `drivers ${summed.toFixed(2)} vs net change ${diff.netDeltaTotal.toFixed(2)}`,
  );
});

test('only components that actually differ are reported as drivers', () => {
  for (const d of decisions) {
    const r = d.options.filter((o) => o.perT);
    if (r.length < 2) continue;
    const diff = comparePathwayPair(d, r[0].pathway, r[1].pathway);
    if (!diff) continue;
    for (const dr of diff.drivers) {
      assert.ok(
        Math.abs(dr.toValue - dr.fromValue) > 1e-9,
        `${dr.label} reported as a driver but the values are identical`,
      );
    }
  }
});

test('drivers are ordered by magnitude', () => {
  for (const d of decisions) {
    const r = d.options.filter((o) => o.perT);
    if (r.length < 2) continue;
    const diff = comparePathwayPair(d, r[0].pathway, r[1].pathway);
    if (!diff) continue;
    for (let i = 1; i < diff.drivers.length; i++) {
      assert.ok(Math.abs(diff.drivers[i - 1].deltaT) >= Math.abs(diff.drivers[i].deltaT));
    }
  }
});

test('comparing against an unusable pathway returns null rather than a fiction', () => {
  const d = decisions.find((x) => x.options.some((o) => !o.perT))!;
  const usable = d.options.find((o) => o.perT)!;
  const unusable = d.options.find((o) => !o.perT)!;
  assert.equal(comparePathwayPair(d, usable.pathway, unusable.pathway), null);
});

test('the flip summary names both pathways and the direction of the change', () => {
  const pair = firstPair()!;
  const diff = comparePathwayPair(pair.d, pair.a as never, pair.b as never)!;
  assert.ok(diff.summary.includes(diff.fromLabel));
  assert.ok(diff.summary.includes(diff.toLabel));
  assert.match(diff.summary, diff.netDeltaPerT >= 0 ? /raises/ : /reduces/);
});

// ─────────────────────────────────────────────────────────────────────────────
// Language discipline
// ─────────────────────────────────────────────────────────────────────────────

test('no explanation claims verification, certification or credits', () => {
  const forbidden = /\b(verified|certified|accredited|audited|carbon credit|guaranteed)\b/i;
  for (const d of decisions) {
    assert.doesNotMatch(d.why, forbidden);
    if (d.tradeoff) assert.doesNotMatch(d.tradeoff, forbidden);
    const r = d.options.filter((o) => o.perT);
    if (r.length >= 2) {
      const diff = comparePathwayPair(d, r[0].pathway, r[1].pathway);
      if (diff) assert.doesNotMatch(diff.summary, forbidden);
    }
  }
});

test('the explanation is specific to the material it describes', () => {
  for (const d of decisions) {
    if (d.resolvedCount === 0) {
      assert.match(d.why, /no pathway/i);
      continue;
    }
    const win = d.options.find((o) => o.pathway === d.carbonBest)!;
    assert.ok(d.why.includes(win.short), 'the explanation should name the winning pathway');
    assert.match(d.why, /tCO₂e/);
  }
});

test('an unknown source is refused rather than guessed at', () => {
  assert.equal(pathwayDecision(net, result, 'NOT-A-SOURCE', 'carbon_first'), null);
});
