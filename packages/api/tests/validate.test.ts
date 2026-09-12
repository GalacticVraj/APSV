/**
 * Scenario parameter validation.
 *
 * The failure this guards against is quiet rather than loud: a scenario posted
 * without its parameters used to reach the solver with `undefined` where a price
 * belonged, which became NaN, which made every arc cost NaN, which made the whole
 * network unplaceable. The API answered 200 with a fully formed result claiming
 * carbon had fallen 100%. Nothing threw, so nothing revealed it. These tests pin
 * the boundary where that input is now caught or defaulted.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { validateScenarioParams } from '../src/validate.ts';
import { buildNetwork } from '../../engine/src/network.ts';
import { scenarioDefs } from '../../engine/src/scenario.ts';
import type { ScenarioDef, ScenarioKind } from '../../engine/src/types.ts';

const net = buildNetwork();
const defs = scenarioDefs(net);
const defFor = (kind: ScenarioKind): ScenarioDef => {
  const def = defs.find((d) => d.kind === kind);
  assert.ok(def, `scenario "${kind}" should exist`);
  return def;
};

const ok = (r: ReturnType<typeof validateScenarioParams>) => {
  assert.ok(!('error' in r), 'error' in r ? r.error : '');
  return (r as { params: Record<string, string | number> }).params;
};

// ─────────────────────────────────────────────────────────────────────────────
// Defaulting
// ─────────────────────────────────────────────────────────────────────────────

test('every scenario parameter is finite when nothing is supplied', () => {
  for (const def of defs) {
    const params = ok(validateScenarioParams(def, net, {}));
    for (const p of def.params) {
      const v = params[p.key];
      assert.notEqual(v, undefined, `${def.kind}.${p.key} should be defaulted`);
      if (p.type === 'number') {
        assert.ok(Number.isFinite(v as number), `${def.kind}.${p.key} should be a finite number`);
      }
    }
  }
});

test('a missing params object is equivalent to an empty one', () => {
  const def = defFor('carbon_price');
  assert.deepEqual(
    ok(validateScenarioParams(def, net, undefined)),
    ok(validateScenarioParams(def, net, {})),
  );
});

test('a non-object params value falls back to defaults rather than being read', () => {
  const def = defFor('supply_surge');
  assert.deepEqual(
    ok(validateScenarioParams(def, net, [1, 2])),
    ok(validateScenarioParams(def, net, {})),
  );
});

test('a supplied value overrides the default', () => {
  const def = defFor('facility_derate');
  const params = ok(validateScenarioParams(def, net, { availability: 25 }));
  assert.equal(params.availability, 25);
});

// ─────────────────────────────────────────────────────────────────────────────
// Rejection
// ─────────────────────────────────────────────────────────────────────────────

test('an unknown parameter key is rejected rather than ignored', () => {
  const result = validateScenarioParams(defFor('carbon_price'), net, { bogus: 1 });
  assert.ok('error' in result);
  assert.match(result.error, /bogus/);
});

test('a non-numeric value for a number parameter is rejected', () => {
  const result = validateScenarioParams(defFor('facility_derate'), net, { availability: 'abc' });
  assert.ok('error' in result);
});

test('a number outside its declared bounds is rejected at both ends', () => {
  const def = defFor('facility_derate');
  assert.ok('error' in validateScenarioParams(def, net, { availability: 999 }));
  assert.ok('error' in validateScenarioParams(def, net, { availability: -1 }));
});

test('a choice outside the declared options is rejected', () => {
  const result = validateScenarioParams(defFor('facility_offline'), net, {
    facilityId: 'not-a-facility',
  });
  assert.ok('error' in result);
});

test('every declared choice is accepted', () => {
  for (const def of defs) {
    for (const p of def.params) {
      if (p.type !== 'choice') continue;
      for (const choice of p.choices ?? []) {
        const params = ok(validateScenarioParams(def, net, { [p.key]: choice.value }));
        assert.equal(params[p.key], choice.value);
      }
    }
  }
});

test('each numeric parameter accepts its own bounds', () => {
  for (const def of defs) {
    for (const p of def.params) {
      if (p.type !== 'number') continue;
      for (const edge of [p.min, p.max]) {
        if (edge === undefined) continue;
        const params = ok(validateScenarioParams(def, net, { [p.key]: edge }));
        assert.equal(params[p.key], edge, `${def.kind}.${p.key} should accept ${edge}`);
      }
    }
  }
});
