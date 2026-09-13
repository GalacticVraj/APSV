/**
 * Install the git hooks, and never, ever fail.
 *
 * This runs from npm's `prepare`, which means it runs on every `npm install` —
 * including on a build host, where there are no git hooks to install and
 * frequently no husky either, because build hosts set NODE_ENV=production and
 * npm then omits devDependencies. That combination is what took the Vercel
 * deploy down:
 *
 *     sh: line 1: husky: command not found
 *     npm error code 127
 *     Error: Command "npm install" exited with 127
 *
 * `husky || true` is the usual patch, but it depends on the host's shell
 * handling `||` the way you expect, and a deploy is a bad place to find out it
 * does not. This is a node script instead — node is guaranteed present, because
 * npm is running — and it exits 0 on every path there is.
 *
 * The hook itself is worth keeping: it scans staged files for Groq, xAI and
 * Gemini API keys and blocks the commit. That protection matters on a developer
 * machine and is meaningless on a build host.
 */

import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// A build host has no working tree to attach hooks to. Vercel, GitHub Actions
// and most CI set one of these.
const CI = process.env.CI || process.env.VERCEL || process.env.GITHUB_ACTIONS;

try {
  if (CI) {
    console.log('[hooks] build environment detected, skipping git hooks.');
  } else if (!existsSync('.git')) {
    console.log('[hooks] no .git directory, skipping git hooks.');
  } else if (!existsSync('.husky')) {
    console.log('[hooks] no .husky directory, skipping git hooks.');
  } else {
    // Point git at the committed hooks directly. This is the whole of what
    // husky's CLI does, and doing it here means the hooks install without
    // depending on husky resolving through npx — which it does not do reliably
    // inside a workspace, and cannot do at all when devDependencies are absent.
    execFileSync('git', ['config', 'core.hooksPath', '.husky'], { stdio: 'inherit' });
    console.log('[hooks] git hooks installed (core.hooksPath = .husky).');
  }
} catch {
  // Hooks are a developer convenience. Failing to install one is never a reason
  // to fail an install, let alone a deployment.
  console.log('[hooks] could not install git hooks, continuing.');
}

process.exit(0);
