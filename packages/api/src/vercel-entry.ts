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
 * The import below must stay STATIC. A dynamic `await import()` is not bundled:
 * the builder compiles this file to `api/[...path].js` and leaves the specifier
 * as a literal, so at runtime it looks for `/var/task/packages/api/src/index.ts`
 * — TypeScript source that was never deployed — and every request dies with
 * ERR_MODULE_NOT_FOUND. A static import lets esbuild inline the whole engine
 * into the compiled output, which is the only form that exists on the host.
 *
 * The try/catch therefore covers request handling rather than module loading.
 * A failure to load now happens at cold start, before this code runs at all,
 * and surfaces in the function's runtime logs.
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
import { handleRequest } from './index.ts';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    await handleRequest(req, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? (err.stack ?? '').split('\n').slice(0, 6) : [];
    console.error('[api] request failed:', err);

    if (res.headersSent) {
      res.end();
      return;
    }
    const body = JSON.stringify({
      error: 'The carbon engine failed to handle this request.',
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
