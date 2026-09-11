/**
 * Dev launcher.
 *
 * Runs the API and the Vite client together with no dependency on `concurrently`
 * or any other tool. Prefixes and colourises each stream so it is obvious which
 * process is talking, and shuts both down cleanly on Ctrl-C.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';

const procs = [];

function run(name, colour, command, args, cwd, useShell = false) {
  // Only .cmd shims need a shell. Running node.exe through one breaks on
  // Windows because its path contains a space ("C:\Program Files\nodejs").
  const child = spawn(command, args, {
    cwd,
    shell: useShell,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  const prefix = `\x1b[${colour}m${name.padEnd(6)}\x1b[0m │ `;
  const pipe = (stream) => {
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) process.stdout.write(prefix + line + '\n');
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);

  child.on('exit', (code) => {
    process.stdout.write(prefix + `exited with code ${code}\n`);
    shutdown(code ?? 0);
  });

  procs.push(child);
  return child;
}

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const p of procs) {
    try {
      p.kill();
    } catch {
      /* already gone */
    }
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run('api', '32', process.execPath, ['--experimental-strip-types', '--watch', 'src/index.ts'], resolve(root, 'packages/api'));
run('web', '36', 'npx', ['vite'], resolve(root, 'packages/web'), isWin);

console.log(`
  TERRAFLUX dev
  API  http://127.0.0.1:5174
  Web  http://localhost:5173   <- open this
`);
