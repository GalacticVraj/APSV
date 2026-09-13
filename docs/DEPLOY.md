# Deploying TERRAFLUX

## What the deployment is

A static client plus one serverless function.

- `packages/web` builds to `packages/web/dist` — that is the site.
- `api/[...path].ts` is the API, running per-request. It delegates to the same
  `handleRequest` the local Node server uses, so there is one router and the
  deployed behaviour cannot drift from the local one.

`vercel.json` states all of this explicitly rather than relying on framework
auto-detection, which looks for `./dist` and would not find the output.

## Settings that must be right

| Setting | Value | Why |
|---|---|---|
| Production branch | `main` | Set in the Vercel dashboard, under Settings → Git. This cannot be set from the repository. |
| Node version | **22.x** | `engines` requires `>=22.6.0`. A project pinned to 20.x fails with *Found invalid Node.js Version*. |
| Install command | leave blank | `vercel.json` supplies it. A value typed into the dashboard **overrides** `vercel.json`. |
| Root directory | **the repository root** | Selecting `packages/web` makes Vercel ignore the root `vercel.json`, which means no API function and an app that cannot boot. `.vercelignore` hides the other package directories so the picker stops offering them. |

## The one failure that keeps coming back

```
sh: line 1: husky: command not found
npm error code 127
Error: Command "npm install" exited with 127
```

Two separate causes, both now fixed in the repository:

1. **Build hosts set `NODE_ENV=production`, and npm then omits
   devDependencies.** husky is a devDependency, so `prepare` invoked a binary
   that was never installed. The same omission removes **vite and typescript**,
   so even with husky silenced the build dies next on `vite build`.
   Fixed by `.npmrc` (`include=dev`), which npm reads no matter how the install
   is invoked — including when a dashboard Install Command overrides
   `vercel.json`.

2. **`prepare` ran husky's CLI directly.** It now runs
   `scripts/install-hooks.mjs`, which is node (guaranteed present, because npm
   is running), sets `core.hooksPath` with git rather than depending on husky
   resolving, and exits 0 on every path through it.

### If you still see it after those fixes

You are building an **old commit**. The offending script existed only between
`fbd4628` and `ac8a149`; no branch head contains it now. Pressing **Redeploy**
on a failed deployment rebuilds *that same commit*, fix included or not.

Trigger a fresh build instead: push, or use *Deploy* from the project's Git tab
against the current branch head.

## Verifying a deploy locally before pushing

This reproduces what the build host does, including the environment that caused
the failure above:

```bash
# from a copy of the tree with no .git and no node_modules
VERCEL=1 CI=1 NODE_ENV=production npm install --no-audit --no-fund
VERCEL=1 CI=1 NODE_ENV=production npm run build
ls packages/web/dist          # index.html + assets/
```

Expected: `[hooks] build environment detected, skipping git hooks.`,
**75 packages** installed (not 9), and a successful vite build.

## Running the twin serverless

Two honest limitations, neither of which breaks a demo:

- **State does not survive a cold start.** The twin is in-memory, so a changed
  objective or a committed scenario lasts only while the instance stays warm.
  The seed is deterministic, so a cold instance rebuilds the same baseline
  network — a reset, never a different answer.
- **The first request after a cold start pays for the first solve.** The local
  server warms the solver on `listen`; there is no equivalent moment in a
  function.

## AI Insights

Off unless configured. Set `GROQ_API_KEY` or `GEMINI_API_KEY` as a Vercel
environment variable. Without one the endpoint answers `503` with a plain
explanation rather than an error about JSON parsing.

Never commit a key. `.env` is gitignored and the pre-commit hook scans staged
files for Groq, xAI and Gemini key shapes — run `npm install` once locally to
install that hook.
