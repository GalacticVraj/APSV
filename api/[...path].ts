/**
 * The API, as a serverless function.
 *
 * Vercel serves `packages/web/dist` as static files, which is everything the
 * client needs except the part that matters: the client fetches relative
 * `/api/...` paths, and in development Vite proxies those to the Node server on
 * 5174. On a static host there is no proxy and no server, so every request 404s
 * and the app cannot boot at all.
 *
 * This is that server, running per-request instead of on a port. The filename is
 * Vercel's catch-all convention, so every /api/* path reaches it with the URL
 * the browser actually asked for — a rewrite would have handed the router the
 * destination path instead, and it dispatches on pathname.
 *
 * It delegates to the same `handleRequest` the long-lived process uses, so there
 * is exactly one router and one set of routes — nothing here can drift from what
 * runs locally.
 *
 * The import is dynamic and inside a try/catch on purpose. It pulls in the whole
 * engine, and if any part of that fails to load on the host — a module format
 * disagreement, a path that resolves differently, a missing file — the platform
 * would otherwise answer with an HTML error page. The client parses every
 * response as JSON, so the reader would see "The API returned a response that
 * was not JSON" and learn nothing. Answering with the real message in JSON turns
 * a dead end into something you can act on.
 *
 * Two honest limitations of running the twin this way:
 *
 *  1. **State does not survive a cold start.** The twin is in-memory, so
 *     changing the objective or committing a scenario persists only for as long
 *     as the instance stays warm. The seed is deterministic (RNG seed
 *     20260912), so a cold instance rebuilds exactly the same baseline network
 *     rather than a different one — a reset, never a surprise.
 *  2. **The first request after a cold start pays for the first solve.** The
 *     local server warms the solver on listen; there is no equivalent moment
 *     here.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const { handleRequest } = await import('../packages/api/src/index.ts');
    await handleRequest(req, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? (err.stack ?? '').split('\n').slice(0, 6) : [];
    console.error('[api] the engine failed to load or handle the request:', err);

    if (res.headersSent) {
      res.end();
      return;
    }
    const body = JSON.stringify({
      error: 'The carbon engine failed to start on this server.',
      detail: message,
      where: stack,
    });
    res.writeHead(500, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(body),
      'cache-control': 'no-store',
    });
    res.end(body);
  }
}
