/**
 * TERRAFLUX API.
 *
 * Node's built-in http server with a small hand-rolled router. No Express, no
 * middleware stack, no dependencies at all — which means `npm install` at the root
 * pulls nothing for the backend and the server starts in milliseconds. For a system
 * whose credibility rests on running reliably in front of an audience, that is
 * worth more than any framework convenience.
 *
 * The engine is imported as TypeScript source and executed via Node's native type
 * stripping, so there is no build step between editing the model and running it.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Twin } from '../../engine/src/state.ts';
import { ask, comparePathways, SUGGESTED_QUESTIONS, TOOL_DEFS } from '../../engine/src/copilot.ts';
import { scenarioDefs } from '../../engine/src/scenario.ts';
import { validateScenarioParams } from './validate.ts';
import { STREAMS, COUNTERFACTUALS } from '../../engine/src/streams.ts';
import { PATHWAYS } from '../../engine/src/pathways.ts';
import { SEASON } from '../../engine/src/forecast.ts';
import {
  ASSUMPTION_META,
  CARBON_MARKETS,
  EF_LIST,
  OBJECTIVE_META,
  PRICE_LIST,
  VEHICLES,
} from '../../engine/src/constants.ts';
import { PRODUCT } from '../../engine/src/index.ts';
import type {
  ObjectiveMode,
  PathwayId,
  ScenarioInstance,
  StreamId,
} from '../../engine/src/types.ts';
import { DEMO_SCRIPT } from './demo.ts';

const PORT = Number(process.env.PORT ?? 5174);
const HOST = process.env.HOST ?? '127.0.0.1';

const twin = new Twin();

// ─────────────────────────────────────────────────────────────────────────────
// Plumbing
// ─────────────────────────────────────────────────────────────────────────────

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    // Nothing this API accepts is large; refuse anything that looks wrong.
    if (size > 512 * 1024) throw new Error('Request body too large');
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
  } catch {
    throw new Error('Request body is not valid JSON');
  }
}

const VALID_OBJECTIVES = new Set(Object.keys(OBJECTIVE_META));

/** Numeric assumption keys the client is allowed to change, with their bounds. */
const ASSUMPTION_BOUNDS = ASSUMPTION_META;

// ─────────────────────────────────────────────────────────────────────────────
// Static file serving (production build only; Vite serves the client in dev)
// ─────────────────────────────────────────────────────────────────────────────

const WEB_DIST = resolve(fileURLToPath(new URL('../../web/dist', import.meta.url)));

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

async function serveStatic(res: ServerResponse, urlPath: string): Promise<boolean> {
  // Normalise and confine to the dist directory: never serve outside it.
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let file = join(WEB_DIST, rel === '/' || rel === '\\' ? 'index.html' : rel);
  if (!file.startsWith(WEB_DIST)) return false;

  try {
    const st = await stat(file);
    if (st.isDirectory()) file = join(file, 'index.html');
  } catch {
    // Single-page app: unknown paths fall back to the shell.
    file = join(WEB_DIST, 'index.html');
  }

  try {
    const buf = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'content-length': buf.length,
    });
    res.end(buf);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
) => void | Promise<void>;

const GET: Record<string, Handler> = {
  '/api/health': (_req, res) => json(res, 200, { ok: true, version: twin.getVersion() }),

  /** Everything the client needs once, at boot. */
  '/api/bootstrap': (_req, res) => {
    const net = twin.getState();
    json(res, 200, {
      product: PRODUCT,
      network: {
        sources: net.sources,
        facilities: net.facilities,
        vehicles: net.vehicles,
        assumptions: net.assumptions,
        asOf: net.asOf,
      },
      reference: {
        streams: STREAMS,
        pathways: PATHWAYS,
        counterfactuals: COUNTERFACTUALS,
        season: SEASON,
        objectives: OBJECTIVE_META,
        assumptionMeta: ASSUMPTION_META,
        emissionFactors: EF_LIST,
        prices: PRICE_LIST,
        carbonMarkets: CARBON_MARKETS,
        vehicles: VEHICLES,
      },
      scenarios: scenarioDefs(net),
      copilot: { suggested: SUGGESTED_QUESTIONS, tools: TOOL_DEFS },
      demo: DEMO_SCRIPT,
    });
  },

  '/api/state': (_req, res) => {
    const net = twin.getState();
    json(res, 200, {
      version: twin.getVersion(),
      objective: twin.getObjective(),
      assumptions: net.assumptions,
      asOf: net.asOf,
      appliedScenarios: net.appliedScenarios,
      sources: net.sources,
      facilities: net.facilities,
      vehicles: net.vehicles,
      events: twin.getEvents().slice(0, 60),
    });
  },

  '/api/optimization': (_req, res) =>
    json(res, 200, {
      version: twin.getVersion(),
      objective: twin.getObjective(),
      result: twin.getResult(),
      baseline: twin.getBaseline().totals,
    }),

  '/api/routing': (_req, res) => json(res, 200, twin.getRouting()),

  '/api/carbon': (_req, res) =>
    json(res, 200, {
      ledger: twin.getLedger(),
      aggregate: twin.getCarbonAggregate(),
      totals: twin.getResult().totals,
      // Derived from the same aggregate the ledger was built from, so the
      // evidence panel cannot describe a different plan than the lines above it.
      provenance: twin.getProvenance(),
    }),

  '/api/opportunities': (_req, res) => json(res, 200, twin.getCarbonOpportunities()),

  '/api/evidence': (_req, res) => json(res, 200, twin.getEvidence()),

  '/api/evidence/contributors': (_req, res, url) => {
    const line = url.searchParams.get('line');
    if (!line) return json(res, 400, { error: 'A ledger line "line" key is required.' });
    const rows = twin.getLineContributors(line);
    if (rows.length === 0) {
      // Not an error: the line may exist but be produced by no allocation in this
      // plan, which is a real answer about the plan rather than a lookup failure.
      return json(res, 200, { line, contributors: [], note: 'No allocation in the current plan contributes to this line.' });
    }
    json(res, 200, { line, contributors: rows, note: null });
  },

  '/api/facilities/carbon': (_req, res) => json(res, 200, twin.getFacilityRanking()),

  '/api/facilities/profile': (_req, res, url) => {
    const id = url.searchParams.get('id');
    if (!id) return json(res, 400, { error: 'A facility "id" is required.' });
    const profile = twin.getFacilityCarbon(id);
    if (!profile) return json(res, 404, { error: `No facility "${id}" in the network.` });
    json(res, 200, profile);
  },

  '/api/facilities/compare': (_req, res, url) => {
    const a = url.searchParams.get('a');
    const b = url.searchParams.get('b');
    if (!a || !b) return json(res, 400, { error: 'Both "a" and "b" facility ids are required.' });
    if (a === b) return json(res, 400, { error: 'Pick two different facilities to compare.' });
    const cmp = twin.getFacilityComparison(a, b);
    if (!cmp) return json(res, 404, { error: 'One of those facilities is not in the network.' });
    json(res, 200, cmp);
  },

  '/api/materials': (_req, res) => json(res, 200, twin.getMaterials()),

  '/api/pathways/decision': (_req, res, url) => {
    const sourceId = url.searchParams.get('sourceId');
    if (!sourceId) return json(res, 400, { error: 'A "sourceId" is required.' });
    const lens = String(url.searchParams.get('lens') ?? 'carbon_first');
    if (!VALID_OBJECTIVES.has(lens)) {
      return json(res, 400, {
        error: `Unknown lens "${lens}". Expected one of: ${[...VALID_OBJECTIVES].join(', ')}.`,
      });
    }
    const decision = twin.getPathwayDecision(sourceId, lens as ObjectiveMode);
    if (!decision) return json(res, 404, { error: `No source "${sourceId}" in the network.` });
    json(res, 200, decision);
  },

  '/api/pathways/diff': (_req, res, url) => {
    const sourceId = url.searchParams.get('sourceId');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!sourceId || !from || !to) {
      return json(res, 400, { error: '"sourceId", "from" and "to" are all required.' });
    }
    const lens = String(url.searchParams.get('lens') ?? 'carbon_first');
    if (!VALID_OBJECTIVES.has(lens)) {
      return json(res, 400, { error: `Unknown lens "${lens}".` });
    }
    if (!(from in PATHWAYS) || !(to in PATHWAYS)) {
      return json(res, 400, {
        error: `Unknown pathway. Expected one of: ${Object.keys(PATHWAYS).join(', ')}.`,
      });
    }
    const diff = twin.getPathwayDiff(
      sourceId,
      lens as ObjectiveMode,
      from as PathwayId,
      to as PathwayId,
    );
    if (!diff) {
      // Both pathways exist but at least one produced no result for this material.
      return json(res, 404, {
        error:
          'Those two pathways cannot be compared for this material: at least one has no feasible destination in the current network.',
      });
    }
    json(res, 200, diff);
  },

  '/api/trace/candidates': (_req, res) => json(res, 200, twin.getTraceCandidates()),

  '/api/trace': (_req, res, url) => {
    const sourceId = url.searchParams.get('sourceId');
    const facilityId = url.searchParams.get('facilityId');
    if (!sourceId || !facilityId) {
      return json(res, 400, {
        error: 'Both "sourceId" and "facilityId" are required to trace a contribution.',
      });
    }
    const trace = twin.getTrace(sourceId, facilityId);
    if (!trace) {
      // Not an error: the pair may be stranded, or the plan may have moved since
      // the client last read the candidate list.
      return json(res, 404, {
        error: `No allocation from ${sourceId} to ${facilityId} in the current plan. It may have been stranded, or the plan may have changed.`,
      });
    }
    json(res, 200, trace);
  },

  // Split from /api/carbon because it costs twenty optimiser runs: the Carbon Home
  // renders its headline immediately and fills the trend in when this arrives.
  '/api/carbon/history': (_req, res) => json(res, 200, twin.getCarbonHistory()),

  '/api/economics': (_req, res) =>
    json(res, 200, {
      rollup: twin.getEconomics(),
      totals: twin.getResult().totals,
      allocations: twin.getResult().allocations,
    }),

  '/api/bottlenecks': (_req, res) =>
    json(res, 200, {
      bottlenecks: twin.getBottlenecks(),
      stranded: twin.getStranded(),
      opportunities: twin.getOpportunities(),
    }),

  '/api/resilience': (_req, res) => json(res, 200, twin.getResilience()),

  '/api/forecast': (_req, res, url) => {
    const sourceId = url.searchParams.get('sourceId');
    const f = twin.getForecast();
    if (sourceId) {
      const one = f.bySource[sourceId];
      if (!one) return json(res, 404, { error: `Unknown source ${sourceId}` });
      return json(res, 200, one);
    }
    json(res, 200, f);
  },

  '/api/pareto': (_req, res) => json(res, 200, twin.getPareto()),

  '/api/pathways': (_req, res, url) => {
    const stream = url.searchParams.get('stream') as StreamId | null;
    if (!stream || !(stream in STREAMS)) {
      return json(res, 400, { error: 'Query parameter "stream" is required and must be a known stream id.' });
    }
    json(res, 200, { stream, rows: comparePathways(twin, stream) });
  },

  '/api/events': (_req, res) => json(res, 200, twin.getEvents()),

  '/api/scenarios': (_req, res) => json(res, 200, scenarioDefs(twin.getState())),
};

const POST: Record<string, Handler> = {
  '/api/objective': async (req, res) => {
    const body = await readBody(req);
    const mode = String(body.mode ?? '');
    if (!VALID_OBJECTIVES.has(mode)) {
      return json(res, 400, {
        error: `Unknown objective "${mode}". Expected one of: ${[...VALID_OBJECTIVES].join(', ')}.`,
      });
    }
    twin.setObjective(mode as ObjectiveMode);
    json(res, 200, { objective: twin.getObjective(), version: twin.getVersion() });
  },

  '/api/assumptions': async (req, res) => {
    const body = await readBody(req);
    const patch: Record<string, number> = {};
    for (const [k, v] of Object.entries(body)) {
      const meta = ASSUMPTION_BOUNDS[k as keyof typeof ASSUMPTION_BOUNDS];
      if (!meta) {
        return json(res, 400, { error: `Unknown assumption "${k}".` });
      }
      const n = Number(v);
      if (!Number.isFinite(n)) {
        return json(res, 400, { error: `Assumption "${k}" must be a number.` });
      }
      if (n < meta.min || n > meta.max) {
        return json(res, 400, {
          error: `Assumption "${k}" must be between ${meta.min} and ${meta.max} ${meta.unit}.`,
        });
      }
      patch[k] = n;
    }
    twin.updateAssumptions(patch);
    json(res, 200, { assumptions: twin.getState().assumptions, version: twin.getVersion() });
  },

  '/api/shock': async (req, res) => {
    const body = await readBody(req);
    const kind = String(body.kind ?? '');
    const net = twin.getState();
    const defs = scenarioDefs(net);
    const def = defs.find((d) => d.kind === kind);
    if (!def) {
      return json(res, 400, {
        error: `Unknown scenario "${kind}". Expected one of: ${defs.map((d) => d.kind).join(', ')}.`,
      });
    }
    const checked = validateScenarioParams(def, net, body.params);
    if ('error' in checked) return json(res, 400, { error: checked.error });
    const scenario: ScenarioInstance = { kind: kind as ScenarioInstance['kind'], params: checked.params };

    const shock = twin.runShock(scenario);
    // The objective sweep costs eight solves, so it is opt-in per request.
    const objectives = body.compareObjectives === true ? twin.compareShockObjectives(scenario) : null;
    json(res, 200, { shock, objectives });
  },

  '/api/scenario': async (req, res) => {
    const body = await readBody(req);
    const kind = String(body.kind ?? '');
    const net = twin.getState();
    const defs = scenarioDefs(net);
    const def = defs.find((d) => d.kind === kind);
    if (!def) {
      return json(res, 400, {
        error: `Unknown scenario "${kind}". Expected one of: ${defs.map((d) => d.kind).join(', ')}.`,
      });
    }
    const checked = validateScenarioParams(def, net, body.params);
    if ('error' in checked) return json(res, 400, { error: checked.error });
    const scenario: ScenarioInstance = {
      kind: kind as ScenarioInstance['kind'],
      params: checked.params,
    };
    const commit = body.commit === true;
    const result = commit ? twin.commitScenario(scenario) : twin.previewScenario(scenario);
    json(res, 200, { committed: commit, version: twin.getVersion(), result });
  },

  '/api/copilot': async (req, res) => {
    const body = await readBody(req);
    const question = String(body.question ?? '').trim();
    if (!question) return json(res, 400, { error: 'A question is required.' });
    if (question.length > 2000) return json(res, 400, { error: 'Question is too long.' });
    json(res, 200, ask(twin, question));
  },

  '/api/reset': async (_req, res) => {
    twin.reset();
    json(res, 200, { ok: true, version: twin.getVersion() });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Server
// ─────────────────────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  // The client is same-origin in production and proxied by Vite in development,
  // so cross-origin access is never needed. Allow it only from localhost so a
  // developer can point another tool at the API without opening it to the world.
  const origin = req.headers.origin;
  if (origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('access-control-allow-headers', 'content-type');
    res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    if (req.method === 'GET' && GET[url.pathname]) {
      await GET[url.pathname](req, res, url);
    } else if (req.method === 'POST' && POST[url.pathname]) {
      await POST[url.pathname](req, res, url);
    } else if (url.pathname.startsWith('/api/')) {
      json(res, 404, { error: `No route for ${req.method} ${url.pathname}` });
    } else if (!(await serveStatic(res, url.pathname))) {
      json(res, 404, {
        error: 'Not found. In development the client is served by Vite on port 5173.',
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // Never leak a stack trace to the client; log it here instead.
    console.error(`[api] ${req.method} ${url.pathname} failed:`, err);
    if (!res.headersSent) json(res, 500, { error: message });
  }

  const ms = Date.now() - started;
  if (url.pathname.startsWith('/api/') && ms > 150) {
    console.log(`[api] ${req.method} ${url.pathname} ${ms}ms`);
  }
});

server.listen(PORT, HOST, () => {
  const t = Date.now();
  // Warm the solver so the first UI request is not the one that pays for it.
  twin.getResult();
  console.log(`
  TERRAFLUX  ${PRODUCT.tagline}
  ${PRODUCT.problemStatement}

  API      http://${HOST}:${PORT}
  Network  ${twin.getState().sources.length} sources, ${twin.getState().facilities.length} facilities, ${PRODUCT.region}
  Warmup   first solve in ${Date.now() - t} ms

  All demo data is synthetic. Emission factors and prices are cited from published sources.
`);
});
