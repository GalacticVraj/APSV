/**
 * Charts.
 *
 * Written by hand in SVG rather than pulled from a library, for three reasons:
 * the page must work with no network access, the visual language has to match the
 * rest of the product exactly, and every chart here answers one specific analytical
 * question — so a general-purpose charting API would mostly be in the way.
 *
 * Conventions: one accent colour, hairline gridlines on the value axis only,
 * tabular figures on every tick, direct labelling in preference to legends, and no
 * chart that exists because "the dashboard needs a chart".
 */

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { num } from '../format.ts';

const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)'];
export function seriesColor(i: number): string {
  return SERIES[i % SERIES.length];
}

interface Tip {
  x: number;
  y: number;
  content: ReactNode;
}

function useTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  return { tip, setTip, wrap };
}

function TipLayer({ tip, wrap }: { tip: Tip | null; wrap: React.RefObject<HTMLDivElement> }) {
  if (!tip) return null;
  return (
    <div className="charttip" style={{ left: tip.x, top: tip.y }} ref={undefined}>
      {tip.content}
    </div>
  );
}

/** Nice axis ticks covering [0, max] or [min, max]. */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const span = max - min;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
  const first = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = first; v <= max + step * 0.001; v += step) out.push(+v.toFixed(10));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Line chart with an uncertainty band — used for supply forecasts
// ─────────────────────────────────────────────────────────────────────────────

export interface SeriesPoint {
  x: number;
  actual: number | null;
  predicted: number;
  lower?: number;
  upper?: number;
  label: string;
}

export function ForecastChart({
  points,
  height = 190,
  unit = 't',
  splitAt,
}: {
  points: SeriesPoint[];
  height?: number;
  unit?: string;
  splitAt?: number;
}) {
  const { tip, setTip, wrap } = useTip();
  const W = 760;
  const H = height;
  const m = { t: 10, r: 12, b: 22, l: 48 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;

  const { xs, yMax, yMin } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of points) {
      for (const v of [p.actual, p.predicted, p.lower, p.upper]) {
        if (v == null || !Number.isFinite(v)) continue;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    if (!Number.isFinite(lo)) {
      lo = 0;
      hi = 1;
    }
    return { xs: points.map((_, i) => i), yMax: hi * 1.06, yMin: Math.min(0, lo) };
  }, [points]);

  if (points.length === 0) return null;

  const X = (i: number) => m.l + (i / Math.max(1, points.length - 1)) * iw;
  const Y = (v: number) => m.t + ih - ((v - yMin) / Math.max(1e-9, yMax - yMin)) * ih;

  const path = (get: (p: SeriesPoint) => number | null | undefined, from = 0, to = points.length) => {
    let d = '';
    let pen = false;
    for (let i = from; i < to; i++) {
      const v = get(points[i]);
      if (v == null || !Number.isFinite(v)) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${X(i).toFixed(2)},${Y(v).toFixed(2)}`;
      pen = true;
    }
    return d;
  };

  const split = splitAt ?? points.findIndex((p) => p.actual === null);
  const bandStart = split < 0 ? points.length : split;

  let band = '';
  for (let i = bandStart; i < points.length; i++) {
    const u = points[i].upper;
    if (u == null) continue;
    band += `${band ? 'L' : 'M'}${X(i).toFixed(2)},${Y(u).toFixed(2)}`;
  }
  for (let i = points.length - 1; i >= bandStart; i--) {
    const l = points[i].lower;
    if (l == null) continue;
    band += `L${X(i).toFixed(2)},${Y(l).toFixed(2)}`;
  }
  if (band) band += 'Z';

  const ticks = niceTicks(yMin, yMax, 4);
  const xTickEvery = Math.max(1, Math.round(points.length / 8));

  return (
    <div style={{ position: 'relative' }} ref={wrap}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-l" x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} />
            <text className="tick" x={m.l - 6} y={Y(t) + 3} textAnchor="end">
              {num(t)}
            </text>
          </g>
        ))}

        {band && <path className="band" d={band} />}
        {bandStart < points.length && (
          <line
            className="grid-l"
            x1={X(bandStart)}
            x2={X(bandStart)}
            y1={m.t}
            y2={m.t + ih}
            stroke="var(--rule-2)"
            strokeDasharray="3 3"
          />
        )}
        {bandStart < points.length && (
          <text className="axis-label" x={X(bandStart) + 5} y={m.t + 9}>
            Forecast
          </text>
        )}

        <path className="line" d={path((p) => p.actual, 0, bandStart + 1)} stroke="var(--ink)" />
        <path
          className="line forecast"
          d={path((p) => p.predicted, Math.max(0, bandStart - 1))}
          stroke="var(--green-500)"
        />

        <line className="axis" x1={m.l} x2={W - m.r} y1={m.t + ih} y2={m.t + ih} />
        {points.map((p, i) =>
          i % xTickEvery === 0 ? (
            <text key={p.label + i} className="tick" x={X(i)} y={H - 6} textAnchor="middle">
              {p.label}
            </text>
          ) : null,
        )}

        {points.map((p, i) => (
          <rect
            key={`h${i}`}
            x={X(i) - iw / points.length / 2}
            y={m.t}
            width={iw / points.length}
            height={ih}
            fill="transparent"
            onMouseEnter={(e) => {
              const r = wrap.current?.getBoundingClientRect();
              if (!r) return;
              setTip({
                x: e.clientX - r.left,
                y: e.clientY - r.top,
                content: (
                  <>
                    <div className="t-l">{p.label}</div>
                    <div>
                      {p.actual != null ? `actual ${num(p.actual)}` : `forecast ${num(p.predicted)}`}{' '}
                      {unit}
                    </div>
                    {p.actual == null && p.lower != null && (
                      <div className="t-l">
                        {num(p.lower)} – {num(p.upper ?? 0)}
                      </div>
                    )}
                  </>
                ),
              });
            }}
            onMouseLeave={() => setTip(null)}
          />
        ))}
      </svg>
      <TipLayer tip={tip} wrap={wrap} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Horizontal bar list — ranked comparisons
// ─────────────────────────────────────────────────────────────────────────────

export function BarList({
  rows,
  format,
  height = 16,
  colorFor,
}: {
  rows: Array<{ label: string; value: number; sub?: string }>;
  format: (v: number) => string;
  height?: number;
  colorFor?: (row: { label: string; value: number }, i: number) => string;
}) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1e-9);
  return (
    <div>
      {rows.map((r, i) => (
        <div
          key={r.label + i}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 96px',
            gap: 10,
            alignItems: 'center',
            padding: '4px 0',
            borderBottom: '1px solid var(--rule)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {r.label}
            </div>
            <div style={{ position: 'relative', height: 6, background: 'var(--surface-sunken)', marginTop: 3 }}>
              <i
                style={{
                  position: 'absolute',
                  inset: '0 auto 0 0',
                  width: `${(Math.abs(r.value) / max) * 100}%`,
                  background: colorFor ? colorFor(r, i) : 'var(--green-500)',
                  transition: 'width var(--t-med)',
                }}
              />
            </div>
            {r.sub && <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>{r.sub}</div>}
          </div>
          <div className="num" style={{ textAlign: 'right', fontSize: 12 }}>
            {format(r.value)}
          </div>
        </div>
      ))}
      <div style={{ height: Math.max(0, height - 16) }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Waterfall — the carbon ledger
// ─────────────────────────────────────────────────────────────────────────────

export interface WaterfallItem {
  label: string;
  value: number;
  kind: string;
}

export function Waterfall({
  items,
  height = 300,
  unit = 'tCO₂e',
}: {
  items: WaterfallItem[];
  height?: number;
  unit?: string;
}) {
  const { tip, setTip, wrap } = useTip();
  const W = 1280;
  const H = height;
  // The bottom margin has to clear the rotated category labels. A 40-degree
  // label of N characters descends N * charWidth * sin(40) below its anchor, so
  // this is sized for the truncation limit applied further down.
  const m = { t: 12, r: 12, b: 96, l: 62 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;

  const steps = useMemo(() => {
    let acc = 0;
    const out: Array<{ label: string; from: number; to: number; value: number; kind: string }> = [];
    for (const it of items) {
      const from = acc;
      acc += it.value;
      out.push({ label: it.label, from, to: acc, value: it.value, kind: it.kind });
    }
    out.push({ label: 'Net', from: 0, to: acc, value: acc, kind: 'total' });
    return out;
  }, [items]);

  const lo = Math.min(0, ...steps.map((s) => Math.min(s.from, s.to)));
  const hi = Math.max(...steps.map((s) => Math.max(s.from, s.to)), 1);
  const pad = (hi - lo) * 0.08;
  const yMin = lo - pad;
  const yMax = hi + pad;

  const bw = iw / steps.length;
  const X = (i: number) => m.l + i * bw + bw * 0.18;
  const Y = (v: number) => m.t + ih - ((v - yMin) / Math.max(1e-9, yMax - yMin)) * ih;
  const ticks = niceTicks(yMin, yMax, 4);

  const colorOf = (kind: string, value: number) => {
    if (kind === 'total') return 'var(--ink)';
    if (kind === 'removal') return 'var(--green-700)';
    if (kind === 'avoided') return 'var(--green-500)';
    if (kind === 'substitution') return 'var(--s2)';
    if (value < 0) return 'var(--neg)';
    return 'var(--ink-3)';
  };

  return (
    <div style={{ position: 'relative' }} ref={wrap}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-l" x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} />
            <text className="tick" x={m.l - 6} y={Y(t) + 3} textAnchor="end">
              {num(t)}
            </text>
          </g>
        ))}
        <line className="axis" x1={m.l} x2={W - m.r} y1={Y(0)} y2={Y(0)} />

        {steps.map((s, i) => {
          const y0 = Y(Math.max(s.from, s.to));
          const y1 = Y(Math.min(s.from, s.to));
          const h = Math.max(1.5, y1 - y0);
          return (
            <g key={s.label + i}>
              <rect
                x={X(i)}
                y={y0}
                width={bw * 0.64}
                height={h}
                fill={colorOf(s.kind, s.value)}
                opacity={s.kind === 'total' ? 1 : 0.9}
                onMouseEnter={(e) => {
                  const r = wrap.current?.getBoundingClientRect();
                  if (!r) return;
                  setTip({
                    x: e.clientX - r.left,
                    y: e.clientY - r.top,
                    content: (
                      <>
                        <div className="t-l">{s.label}</div>
                        <div>
                          {s.value >= 0 ? '+' : '−'}
                          {num(Math.abs(s.value))} {unit}
                        </div>
                      </>
                    ),
                  });
                }}
                onMouseLeave={() => setTip(null)}
              />
              {i < steps.length - 2 && (
                <line
                  x1={X(i) + bw * 0.64}
                  x2={X(i + 1)}
                  y1={Y(s.to)}
                  y2={Y(s.to)}
                  stroke="var(--rule-2)"
                  strokeDasharray="2 2"
                />
              )}
              <text
                className="tick"
                x={X(i) + bw * 0.32}
                y={m.t + ih + 11}
                textAnchor="end"
                transform={`rotate(-40 ${X(i) + bw * 0.32} ${m.t + ih + 11})`}
                style={{ fontSize: 9, fontFamily: 'var(--font-sans)', fill: 'var(--ink-2)' }}
              >
                {s.label.length > 30 ? s.label.slice(0, 29) + '…' : s.label}
              </text>
            </g>
          );
        })}
      </svg>
      <TipLayer tip={tip} wrap={wrap} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scatter — the Pareto frontier
// ─────────────────────────────────────────────────────────────────────────────

export function ParetoChart({
  points,
  height = 250,
  xLabel,
  yLabel,
  formatX,
  formatY,
  onPick,
}: {
  points: Array<{ x: number; y: number; label: string; current?: boolean }>;
  height?: number;
  xLabel: string;
  yLabel: string;
  formatX: (v: number) => string;
  formatY: (v: number) => string;
  onPick?: (i: number) => void;
}) {
  const { tip, setTip, wrap } = useTip();
  const W = 640;
  const H = height;
  const m = { t: 14, r: 16, b: 40, l: 66 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;

  if (points.length === 0) return null;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xLo = Math.min(...xs);
  const xHi = Math.max(...xs);
  const yLo = Math.min(...ys);
  const yHi = Math.max(...ys);
  const xPad = (xHi - xLo) * 0.12 || 1;
  const yPad = (yHi - yLo) * 0.12 || 1;

  const X = (v: number) => m.l + ((v - (xLo - xPad)) / (xHi - xLo + 2 * xPad)) * iw;
  const Y = (v: number) => m.t + ih - ((v - (yLo - yPad)) / (yHi - yLo + 2 * yPad)) * ih;

  const xTicks = niceTicks(xLo - xPad, xHi + xPad, 4);
  const yTicks = niceTicks(yLo - yPad, yHi + yPad, 4);

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(2)},${Y(p.y).toFixed(2)}`).join('');

  return (
    <div style={{ position: 'relative' }} ref={wrap}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ height }}>
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line className="grid-l" x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} />
            <text className="tick" x={m.l - 6} y={Y(t) + 3} textAnchor="end">
              {formatY(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={`x${t}`} className="tick" x={X(t)} y={H - 22} textAnchor="middle">
            {formatX(t)}
          </text>
        ))}
        <line className="axis" x1={m.l} x2={W - m.r} y1={m.t + ih} y2={m.t + ih} />
        <line className="axis" x1={m.l} x2={m.l} y1={m.t} y2={m.t + ih} />

        <path d={line} fill="none" stroke="var(--green-300)" strokeWidth={1.4} />

        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={X(p.x)}
              cy={Y(p.y)}
              r={p.current ? 6 : 4}
              fill={p.current ? 'var(--green-700)' : 'var(--surface)'}
              stroke={p.current ? 'var(--green-700)' : 'var(--green-500)'}
              strokeWidth={1.6}
              style={{ cursor: onPick ? 'pointer' : 'default' }}
              onClick={onPick ? () => onPick(i) : undefined}
              onMouseEnter={(e) => {
                const r = wrap.current?.getBoundingClientRect();
                if (!r) return;
                setTip({
                  x: e.clientX - r.left,
                  y: e.clientY - r.top,
                  content: (
                    <>
                      <div className="t-l">{p.label}</div>
                      <div>
                        {yLabel}: {formatY(p.y)}
                      </div>
                      <div>
                        {xLabel}: {formatX(p.x)}
                      </div>
                    </>
                  ),
                });
              }}
              onMouseLeave={() => setTip(null)}
            />
            {p.current && (
              <text className="annot" x={X(p.x) + 9} y={Y(p.y) - 7}>
                current
              </text>
            )}
          </g>
        ))}

        <text className="axis-label" x={m.l} y={H - 6}>
          {xLabel} →
        </text>
        <text
          className="axis-label"
          x={-(m.t + ih)}
          y={13}
          transform="rotate(-90)"
          textAnchor="start"
        >
          {yLabel} →
        </text>
      </svg>
      <TipLayer tip={tip} wrap={wrap} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Histogram — Monte Carlo distribution
// ─────────────────────────────────────────────────────────────────────────────

export function Histogram({
  bins,
  p5,
  p50,
  p95,
  height = 130,
  unit = 'tCO₂e',
}: {
  bins: Array<{ bin: number; count: number }>;
  p5: number;
  p50: number;
  p95: number;
  height?: number;
  unit?: string;
}) {
  const W = 620;
  const H = height;
  const m = { t: 8, r: 10, b: 30, l: 10 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  if (bins.length === 0) return null;

  const lo = bins[0].bin;
  const hi = bins[bins.length - 1].bin;
  const maxC = Math.max(...bins.map((b) => b.count), 1);
  const X = (v: number) => m.l + ((v - lo) / Math.max(1e-9, hi - lo)) * iw;
  const bw = iw / bins.length;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }}>
      {bins.map((b, i) => {
        const h = (b.count / maxC) * ih;
        const inBand = b.bin >= p5 && b.bin <= p95;
        return (
          <rect
            key={i}
            x={m.l + i * bw}
            y={m.t + ih - h}
            width={Math.max(1, bw - 1)}
            height={h}
            fill={inBand ? 'var(--green-300)' : 'var(--rule-2)'}
          />
        );
      })}
      {[
        { v: p5, label: 'P5' },
        { v: p50, label: 'P50' },
        { v: p95, label: 'P95' },
      ].map((mk) => (
        <g key={mk.label}>
          <line
            x1={X(mk.v)}
            x2={X(mk.v)}
            y1={m.t}
            y2={m.t + ih}
            stroke={mk.label === 'P50' ? 'var(--ink)' : 'var(--green-700)'}
            strokeWidth={mk.label === 'P50' ? 1.6 : 1}
            strokeDasharray={mk.label === 'P50' ? undefined : '3 2'}
          />
          <text className="tick" x={X(mk.v)} y={H - 16} textAnchor="middle">
            {mk.label}
          </text>
          <text className="tick" x={X(mk.v)} y={H - 5} textAnchor="middle" style={{ fill: 'var(--ink-2)' }}>
            {num(mk.v)}
          </text>
        </g>
      ))}
      <text className="axis-label" x={m.l} y={H - 5}>
        {unit}
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stacked bar — pathway / stream composition
// ─────────────────────────────────────────────────────────────────────────────

export function StackedBar({
  segments,
  height = 26,
  format,
}: {
  segments: Array<{ label: string; value: number; color?: string }>;
  height?: number;
  format: (v: number) => string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return null;
  return (
    <div>
      <div style={{ display: 'flex', height, border: '1px solid var(--rule)' }}>
        {segments.map((s, i) => (
          <div
            key={s.label}
            title={`${s.label}: ${format(s.value)}`}
            style={{
              width: `${(s.value / total) * 100}%`,
              background: s.color ?? seriesColor(i),
              borderRight: i < segments.length - 1 ? '1px solid var(--surface)' : undefined,
              transition: 'width var(--t-med)',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 7 }}>
        {segments.map((s, i) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <span
              style={{
                width: 9,
                height: 9,
                background: s.color ?? seriesColor(i),
                flex: 'none',
              }}
            />
            <span style={{ color: 'var(--ink-2)' }}>{s.label}</span>
            <span className="num" style={{ color: 'var(--ink)' }}>
              {format(s.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sparkline
// ─────────────────────────────────────────────────────────────────────────────

export function Sparkline({
  values,
  width = 78,
  height = 20,
  color = 'var(--green-500)',
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - lo) / Math.max(1e-9, hi - lo)) * (height - 2) - 1;
      return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join('');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.2} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Decay curve — biochar permanence
// ─────────────────────────────────────────────────────────────────────────────

export function DecayCurve({
  curves,
  height = 180,
}: {
  curves: Array<{ label: string; color: string; points: Array<{ year: number; remaining: number }> }>;
  height?: number;
}) {
  const W = 560;
  const H = height;
  const m = { t: 10, r: 88, b: 28, l: 42 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const maxYear = 100;

  const X = (y: number) => m.l + (Math.min(y, maxYear) / maxYear) * iw;
  const Y = (v: number) => m.t + ih - v * ih;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ height }}>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line className="grid-l" x1={m.l} x2={m.l + iw} y1={Y(t)} y2={Y(t)} />
          <text className="tick" x={m.l - 6} y={Y(t) + 3} textAnchor="end">
            {(t * 100).toFixed(0)}%
          </text>
        </g>
      ))}
      {[0, 25, 50, 75, 100].map((y) => (
        <text key={y} className="tick" x={X(y)} y={H - 12} textAnchor="middle">
          {y}
        </text>
      ))}
      <text className="axis-label" x={m.l} y={H - 1}>
        Years after application
      </text>
      <line className="axis" x1={m.l} x2={m.l + iw} y1={m.t + ih} y2={m.t + ih} />

      {curves.map((c) => {
        const pts = c.points.filter((p) => p.year <= maxYear);
        const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.year).toFixed(1)},${Y(p.remaining).toFixed(1)}`).join('');
        const last = pts[pts.length - 1];
        return (
          <g key={c.label}>
            <path d={d} fill="none" stroke={c.color} strokeWidth={1.8} />
            <circle cx={X(last.year)} cy={Y(last.remaining)} r={3} fill={c.color} />
            <text
              x={X(last.year) + 7}
              y={Y(last.remaining) + 3.5}
              style={{ fontSize: 10, fill: c.color, fontFamily: 'var(--font-mono)' }}
            >
              {(last.remaining * 100).toFixed(1)}%
            </text>
            <text
              x={X(last.year) + 7}
              y={Y(last.remaining) + 15}
              style={{ fontSize: 9, fill: 'var(--ink-3)' }}
            >
              {c.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
