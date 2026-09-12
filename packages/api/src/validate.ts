/**
 * Input validation for scenario parameters.
 *
 * Kept apart from the server so it can be exercised directly by tests without
 * binding a port.
 */

import { STREAMS } from '../../engine/src/streams.ts';
import type { NetworkState, ScenarioDef, ScenarioParamDef } from '../../engine/src/types.ts';

/**
 * Scenario parameters arrive from the client as untyped JSON. Each scenario
 * definition already describes its own parameters — type, bounds, the permitted
 * choices — because the client renders its controls from exactly that metadata.
 * Validating against the same definition means the server enforces what the UI
 * displays, with no second copy of the rules to drift.
 *
 * A parameter that is absent falls back to the definition's default rather than
 * reaching the solver as `undefined`: an unset number would otherwise become NaN,
 * which poisons every downstream cost and lands as a plausible-looking solve in
 * which nothing can be placed anywhere.
 */
export function validateScenarioParams(
  def: ScenarioDef,
  net: NetworkState,
  raw: unknown,
): { params: Record<string, string | number> } | { error: string } {
  const given =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const known = def.params.map((p) => p.key);
  for (const key of Object.keys(given)) {
    if (!known.includes(key)) {
      return {
        error: `Scenario "${def.kind}" has no parameter "${key}". Expected: ${known.join(', ')}.`,
      };
    }
  }

  const params: Record<string, string | number> = {};
  for (const p of def.params) {
    const supplied = given[p.key];
    if (supplied === undefined || supplied === null || supplied === '') {
      params[p.key] = p.defaultValue;
      continue;
    }

    if (p.type === 'number') {
      const n = Number(supplied);
      if (!Number.isFinite(n)) {
        return { error: `Parameter "${p.label}" must be a number.` };
      }
      if (p.min !== undefined && n < p.min) {
        return { error: `Parameter "${p.label}" must be at least ${p.min}${p.unit ?? ''}.` };
      }
      if (p.max !== undefined && n > p.max) {
        return { error: `Parameter "${p.label}" must be at most ${p.max}${p.unit ?? ''}.` };
      }
      params[p.key] = n;
      continue;
    }

    const s = String(supplied);
    if (p.type === 'choice') {
      if (!p.choices?.some((c) => c.value === s)) {
        return {
          error: `Parameter "${p.label}" must be one of: ${(p.choices ?? [])
            .map((c) => c.value)
            .join(', ')}.`,
        };
      }
    } else if (!entityExists(net, p.entityType, s)) {
      return { error: `Parameter "${p.label}" does not name a known ${p.entityType ?? 'entity'}.` };
    }
    params[p.key] = s;
  }
  return { params };
}

function entityExists(
  net: NetworkState,
  kind: ScenarioParamDef['entityType'],
  id: string,
): boolean {
  switch (kind) {
    case 'facility':
      return net.facilities.some((f) => f.id === id);
    case 'source':
      return net.sources.some((s) => s.id === id);
    case 'district':
      return net.sources.some((s) => s.district === id);
    case 'stream':
      return Object.hasOwn(STREAMS, id);
    default:
      return false;
  }
}
