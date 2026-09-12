/**
 * In-memory insight cache.
 *
 * Key: deterministic hash of (templateKey + sorted data package)
 * Value: CachedInsight with timestamp
 *
 * Cache is per-session (cleared on page refresh). This is intentional:
 * insights should reflect the current data state, and a refresh clears
 * stale insights automatically.
 */

import type { CachedInsight, InsightTemplateKey, StructuredInsight } from './types';

// djb2 hash — no crypto dependency, fast, deterministic
function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // convert to unsigned 32-bit int
  }
  return hash.toString(36);
}

/**
 * Produces a stable, deterministic key from a template key and data package.
 * Sorts object keys recursively so that `{a:1, b:2}` and `{b:2, a:1}` produce
 * the same cache key.
 */
function sortedStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(sortedStringify).join(',')}]`;
  const sorted = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${sortedStringify((value as Record<string, unknown>)[k])}`)
    .join(',');
  return `{${sorted}}`;
}

export function makeKey(templateKey: InsightTemplateKey, dataPackage: Record<string, unknown>): string {
  const raw = `${templateKey}:${sortedStringify(dataPackage)}`;
  return djb2Hash(raw);
}

const cache = new Map<string, CachedInsight>();

export function getCached(
  templateKey: InsightTemplateKey,
  dataPackage: Record<string, unknown>
): CachedInsight | null {
  const key = makeKey(templateKey, dataPackage);
  return cache.get(key) ?? null;
}

export function setCached(
  templateKey: InsightTemplateKey,
  dataPackage: Record<string, unknown>,
  insight: StructuredInsight,
  provider?: string
): void {
  const key = makeKey(templateKey, dataPackage);
  cache.set(key, { insight, generatedAt: Date.now(), provider });
}

export function clearCached(
  templateKey: InsightTemplateKey,
  dataPackage: Record<string, unknown>
): void {
  const key = makeKey(templateKey, dataPackage);
  cache.delete(key);
}

/** Clear the entire session cache. Exposed for testing and dev tooling. */
export function clearAll(): void {
  cache.clear();
}
