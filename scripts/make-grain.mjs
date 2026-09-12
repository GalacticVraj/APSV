/**
 * Generates the paper-grain tile used behind the landing page.
 *
 * Why generated rather than hand-drawn or faked in CSS:
 *
 * I measured a real one first — YouTube's www-refreshbg tile, 149x149. Its grey
 * channel is Gaussian, mean 235, sd 2.14, and the mean absolute difference
 * between neighbouring pixels is FLAT at ~2.4 across every lag from 1 to 10.
 * Flat means zero spatial correlation: it is pure per-pixel white noise, not
 * cloud noise. That single measurement decides the implementation.
 *
 *   - SVG feTurbulence is wrong. Even at high baseFrequency it produces
 *     correlated, cloudy noise, and it rasterises differently in every browser
 *     and again at every devicePixelRatio, so the grain size changes per display.
 *   - Layered CSS gradients are wrong. Gradients are smooth by construction;
 *     you cannot build an uncorrelated field out of them.
 *
 * White noise is also why a tile this small can repeat without a visible seam:
 * there is no structure to misalign. The odd, non-round size is deliberate —
 * it keeps the repeat period from landing on a round number of pixels where the
 * eye starts to find rhythm.
 *
 * The tile is mid-grey with a varying alpha, so one file serves both grounds:
 * over the cream acts it darkens very slightly, over the dark hero it lightens.
 *
 * Deterministic: same seed, same bytes, so re-running this never produces a
 * spurious diff. Run with `node scripts/make-grain.mjs`.
 *
 * No dependencies — PNG is assembled by hand over zlib, which ships with Node.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SIZE = 137; // odd and prime — see the note about repeat rhythm above
const ALPHA_MEAN = 9; // ~3.5% coverage
const ALPHA_SD = 5;
const GREY = 128; // mid, so the same tile darkens light grounds and lifts dark ones
const SEED = 20260912;

// ── PNG plumbing ─────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let x = 0xffffffff;
  for (const b of buf) x = CRC_TABLE[(x ^ b) & 255] ^ (x >>> 8);
  return (x ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// ── Noise ────────────────────────────────────────────────────────────────────

/** mulberry32 — small, fast, and identical on every platform. */
function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller. Gaussian matters: uniform noise reads as digital dither. */
function gaussian(rand) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ── Build ────────────────────────────────────────────────────────────────────

const rand = mulberry32(SEED);
const BPP = 2; // colour type 4: grey + alpha
const stride = SIZE * BPP + 1;
const raw = Buffer.alloc(SIZE * stride);

for (let y = 0; y < SIZE; y++) {
  const row = y * stride;
  raw[row] = 0; // filter type 0 — filtering white noise only makes it larger
  for (let x = 0; x < SIZE; x++) {
    const a = Math.round(ALPHA_MEAN + gaussian(rand) * ALPHA_SD);
    raw[row + 1 + x * BPP] = GREY;
    raw[row + 2 + x * BPP] = Math.max(0, Math.min(255, a));
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 4; // colour type: greyscale + alpha

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'web', 'src', 'assets', 'grain.png');
writeFileSync(out, png);
console.log(`grain.png  ${SIZE}x${SIZE}  ${(png.length / 1024).toFixed(1)} KB  →  ${out}`);
