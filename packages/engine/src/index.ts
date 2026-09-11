/**
 * TERRAFLUX engine — public surface.
 *
 * The engine is pure TypeScript with no runtime dependencies. It is consumed as
 * source by both the API server (via Node's native type stripping) and the web
 * client (via Vite), so there is exactly one implementation of the domain model
 * and no build step between them to fall out of sync.
 */

export * from './types.ts';
export * from './rng.ts';
export * from './geo.ts';
export * from './constants.ts';
export * from './streams.ts';
export * from './pathways.ts';
export * from './network.ts';
export * from './carbon.ts';
export * from './economics.ts';
export * from './mincostflow.ts';
export * from './optimizer.ts';
export * from './routing.ts';
export * from './forecast.ts';
export * from './bottleneck.ts';
export * from './scenario.ts';
export * from './state.ts';
export * from './copilot.ts';

export const PRODUCT = {
  name: 'TERRAFLUX',
  tagline: 'Circular Carbon Network Operating System',
  problemStatement: 'HackOut’26 PS11 — Waste-to-Carbon Value Chain',
  region: 'Punjab · Haryana · Chandigarh',
  dataNotice:
    'All entity names, volumes and capacities are synthetic. District coordinates are real. Emission factors, prices and scientific relations are cited from published sources at the point of use.',
} as const;
