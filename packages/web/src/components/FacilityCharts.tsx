/**
 * FacilityCharts — pure-SVG visualisations for the Facility Manager module.
 *
 * Conventions mirror Charts.tsx:
 *   - One analytical question per component
 *   - Hairline grids, tabular mono figures, direct labels
 *   - No external dependencies
 *   - Tooltips via the shared charttip class
 */

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { num, pct, inr, inrExact } from '../format.ts';
import { Factory, Zap, Leaf, AlertTriangle, MinusCircle } from 'lucide-react';
import { PATHWAY_COLOR, PATHWAY_SHORT } from './NetworkMap.tsx';
import type { PathwayId } from '../../../engine/src/types.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Shared tooltip helper (mirrors Charts.tsx pattern)
// ─────────────────────────────────────────────────────────────────────────────

interface Tip {
  x: number;
  y: number;
  content: ReactNode;
}

function TipLayer({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div className="charttip" style={{ left: tip.x, top: tip.y }}>
      {tip.content}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FleetBar — horizontal stacked capacity-distribution bar
//
// Primary question: where is capacity available and where is it constrained?
// Each segment represents one facility, width proportional to nameplate capacity.
// Fill level within the segment shows utilisation. Status is a subtle indicator,
// not the dominant message.
// ─────────────────────────────────────────────────────────────────────────────

export interface FleetSegment {
  id: string;
  name: string;
  pathway: string;
  /** nameplate t/d */
  capacityTpd: number;
  /** current throughput for window */
  loadT: number;
  /** nameplate × availability × windowDays */
  capWindow: number;
  utilisationPct: number;
  status: string;
  /** is this a binding capacity constraint */
  binding: boolean;
}

export function FleetBar({
  segments,
  height = 48,
  onHover,
  onClick,
}: {
  segments: FleetSegment[];
  height?: number;
  onHover?: (id: string | null) => void;
  onClick?: (id: string) => void;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const totalCap = segments.reduce((s, f) => s + Math.max(f.capacityTpd, 0.1), 0);

  if (segments.length === 0) return null;

  return (
    <div style={{ position: 'relative' }} ref={wrap}>
      <style>{`
        @keyframes pulseConstrained {
          0% { box-shadow: 0 0 0 0 rgba(220,38,38,0.6); }
          70% { box-shadow: 0 0 0 6px rgba(220,38,38,0); }
          100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
        }
      `}</style>
      <div
        className="fleet-bar"
        style={{ height, display: 'flex', border: '1px solid var(--rule-2)', overflow: 'hidden', borderRadius: 4 }}
      >
        {segments.map((seg) => {
          const widthPct = (seg.capacityTpd / totalCap) * 100;
          const fillPct = Math.min(100, seg.utilisationPct);
          const isIdle = seg.status === 'offline' || seg.utilisationPct < 1;
          const isConstrained = seg.binding || seg.utilisationPct >= 97;
          
          const isDimmed = hoveredId !== null && hoveredId !== seg.id;

          const fillColor = isIdle
            ? 'var(--surface-sunken)'
            : 'var(--blue-400, #4a90d9)'; 
          const bgColor = isIdle ? 'var(--surface-sunken)' : 'var(--surface)';

          const borderTint = isConstrained
            ? '1px solid var(--warn)'
            : '1px solid var(--rule)';

          return (
            <div
              key={seg.id}
              title={seg.name}
              style={{
                width: `${widthPct}%`,
                minWidth: 4,
                position: 'relative',
                background: bgColor,
                borderRight: borderTint,
                cursor: onClick ? 'pointer' : 'default',
                flexShrink: 0,
                opacity: isDimmed ? 0.3 : 1,
                transition: 'opacity var(--t-fast)',
              }}
              onClick={() => onClick?.(seg.id)}
              onMouseEnter={(e) => {
                setHoveredId(seg.id);
                const r = wrap.current?.getBoundingClientRect();
                if (!r) return;
                setTip({
                  x: e.clientX - r.left,
                  y: e.clientY - r.top,
                  content: (
                    <>
                      <div className="t-l">{seg.name}</div>
                      <div style={{ color: 'var(--ink-3)' }}>
                        {seg.pathway.replace(/_/g, ' ')} · {num(seg.capacityTpd)} t/d nameplate
                      </div>
                      <div>
                        {isIdle
                          ? '⬜ Idle / offline — no feedstock allocated'
                          : isConstrained
                            ? `🟡 Constrained — ${pct(seg.utilisationPct, 0)} utilised (binding)`
                            : `🟢 ${pct(seg.utilisationPct, 0)} utilised — spare capacity available`}
                      </div>
                    </>
                  ),
                });
                onHover?.(seg.id);
              }}
              onMouseLeave={() => {
                setHoveredId(null);
                setTip(null);
                onHover?.(null);
              }}
            >
              {/* utilisation fill — shows how much of the segment is "used" */}
              {!isIdle && (
                <div
                  style={{
                    position: 'absolute',
                    inset: '0 auto 0 0',
                    width: `${fillPct}%`,
                    background: isConstrained
                      ? 'linear-gradient(90deg, rgba(200,130,30,0.65) 0%, rgba(220,38,38,0.7) 100%)'
                      : 'linear-gradient(90deg, rgba(74,144,217,0.65) 0%, rgba(37,99,235,0.7) 100%)',
                    transition: 'width var(--t-med)',
                  }}
                />
              )}

              {/* idle stripe pattern */}
              {isIdle && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage:
                      'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(0,0,0,0.03) 6px, rgba(0,0,0,0.03) 7px)',
                  }}
                />
              )}

              {/* status corner dot — subtle, not dominant */}
              <div
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: isIdle
                    ? 'var(--ink-4)'
                    : isConstrained
                      ? '#ef4444'
                      : 'var(--green-500)',
                  animation: isConstrained ? 'pulseConstrained 2s infinite' : 'none',
                }}
              />

              {/* Labels — only if segment wide enough */}
              {widthPct > 5 && (
                <>
                  {/* Utilisation % — primary label */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: 5,
                      right: 10,
                      transform: 'translateY(-60%)',
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: isIdle ? 'var(--ink-4)' : 'var(--ink)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      pointerEvents: 'none',
                    }}
                  >
                    {isIdle ? 'Idle' : `${pct(seg.utilisationPct, 0)}`}
                  </div>
                  {/* Nameplate capacity — secondary label */}
                  {widthPct > 7 && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 3,
                        left: 5,
                        right: 3,
                        fontSize: 8.5,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--ink-4)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        pointerEvents: 'none',
                      }}
                    >
                      {num(seg.capacityTpd)} t/d
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <TipLayer tip={tip} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CapacityGauge — dominant visual for the command header
//
// Shows nameplate, minimum viable, and current load on one axis.
// ─────────────────────────────────────────────────────────────────────────────

export function CapacityGauge({
  current,
  nameplate,
  minViable,
  height = 28,
}: {
  current: number;
  nameplate: number;
  minViable: number;
  height?: number;
}) {
  if (nameplate <= 0) return null;
  const fillPct = Math.min(100, (current / nameplate) * 100);
  const minPct = Math.min(100, (minViable / nameplate) * 100);
  const isConstrained = fillPct >= 97;
  const isBelowMin = current < minViable && current > 0;

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          position: 'relative',
          height,
          background: 'var(--surface-sunken)',
          border: '1px solid var(--rule-2)',
          overflow: 'visible',
        }}
      >
        {/* fill */}
        <div
          style={{
            position: 'absolute',
            inset: '0 auto 0 0',
            width: `${fillPct}%`,
            background: isConstrained
              ? 'linear-gradient(90deg, rgba(200,130,30,0.85) 0%, rgba(220,38,38,0.9) 100%)'
              : isBelowMin
                ? 'linear-gradient(90deg, rgba(163,65,43,0.85) 0%, rgba(220,38,38,0.9) 100%)'
                : 'linear-gradient(90deg, rgba(46,125,91,0.85) 0%, rgba(20,80,58,0.9) 100%)',
            transition: 'width var(--t-med)',
          }}
        />
        {/* minimum viable marker */}
        <div
          style={{
            position: 'absolute',
            top: -4,
            bottom: -4,
            left: `${minPct}%`,
            width: 1,
            background: 'var(--ink-3)',
          }}
          title={`Minimum viable: ${num(minViable)} t/d`}
        />
        {/* inline label */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 8,
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: fillPct > 40 ? 'var(--surface)' : 'var(--ink)',
            pointerEvents: 'none',
            fontWeight: 600,
          }}
        >
          {num(current, 1)} / {num(nameplate)} t/d · {pct(fillPct, 0)}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 9.5,
          color: 'var(--ink-4)',
          marginTop: 3,
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span>0</span>
        <span>Min viable {num(minViable)} t/d</span>
        <span>Nameplate {num(nameplate)} t/d</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FeedstockOutlookChart — availability vs allocation vs capacity
//
// X axis: weeks (from forecast). Three series:
//   1. Available supply forecast (area, green band)
//   2. Current allocation (horizontal dashed line — optimisation decision)
//   3. Facility nameplate capacity (horizontal solid line)
// ─────────────────────────────────────────────────────────────────────────────

export interface OutlookPoint {
  weekIndex: number;
  label: string;
  availableT: number;
  lowerT: number;
  upperT: number;
}

export function FeedstockOutlookChart({
  points,
  allocationTpd,
  nameplateT,
  windowDays,
  height = 200,
}: {
  points: OutlookPoint[];
  /** current allocation expressed as t/day, converted internally to window total */
  allocationTpd: number;
  /** facility nameplate in t/day */
  nameplateT: number;
  windowDays: number;
  height?: number;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const W = 760;
  const H = height;
  const m = { t: 10, r: 12, b: 24, l: 52 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;

  const maxVal = useMemo(() => {
    const vals = points.flatMap((p) => [p.upperT, p.availableT]);
    return Math.max(nameplateT, allocationTpd, ...vals, 1) * 1.08;
  }, [points, nameplateT, allocationTpd]);

  if (points.length === 0) return null;

  const X = (i: number) => m.l + (i / Math.max(1, points.length - 1)) * iw;
  const Y = (v: number) => m.t + ih - (v / maxVal) * ih;

  // Upper/lower band path
  let band = '';
  for (let i = 0; i < points.length; i++) {
    band += `${band ? 'L' : 'M'}${X(i).toFixed(1)},${Y(points[i].upperT).toFixed(1)}`;
  }
  for (let i = points.length - 1; i >= 0; i--) {
    band += `L${X(i).toFixed(1)},${Y(points[i].lowerT).toFixed(1)}`;
  }
  band += 'Z';

  // Availability line
  const availLine = points
    .map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.availableT).toFixed(1)}`)
    .join('');

  // Allocation and capacity as horizontal lines
  const yAlloc = Y(allocationTpd);
  const yCap = Y(nameplateT);

  // Y-axis ticks
  const tickStep = maxVal / 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => +(tickStep * i).toFixed(0));

  return (
    <div style={{ position: 'relative' }} ref={wrap}>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ height }}
      >
        {/* grid + y-axis ticks */}
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-l" x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} />
            <text className="tick" x={m.l - 6} y={Y(t) + 3} textAnchor="end">
              {num(t)}
            </text>
          </g>
        ))}

        {/* uncertainty band */}
        <path d={band} fill="var(--green-300)" opacity={0.18} />

        {/* availability line */}
        <path
          d={availLine}
          fill="none"
          stroke="var(--green-500)"
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* capacity line */}
        <line
          x1={m.l}
          x2={W - m.r}
          y1={yCap}
          y2={yCap}
          stroke="var(--ink-3)"
          strokeWidth={1}
          strokeDasharray="none"
        />
        <text
          style={{ fontSize: 8.5, fill: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}
          x={W - m.r + 3}
          y={yCap + 3}
          textAnchor="start"
        >
          Capacity
        </text>

        {/* allocation line */}
        <line
          x1={m.l}
          x2={W - m.r}
          y1={yAlloc}
          y2={yAlloc}
          stroke="var(--ink)"
          strokeWidth={1.4}
          strokeDasharray="5 3"
        />
        <text
          style={{ fontSize: 8.5, fill: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}
          x={W - m.r + 3}
          y={yAlloc + 3}
          textAnchor="start"
        >
          Allocation
        </text>

        {/* x-axis */}
        <line className="axis" x1={m.l} x2={W - m.r} y1={m.t + ih} y2={m.t + ih} />
        {points.map((p, i) =>
          i % Math.max(1, Math.round(points.length / 6)) === 0 ? (
            <text key={p.label} className="tick" x={X(i)} y={H - 6} textAnchor="middle">
              {p.label}
            </text>
          ) : null,
        )}

        {/* hover areas */}
        {points.map((p, i) => (
          <rect
            key={i}
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
                    <div>Available: {num(p.availableT, 1)} t</div>
                    <div className="t-l">
                      Range: {num(p.lowerT, 1)}–{num(p.upperT, 1)} t
                    </div>
                  </>
                ),
              });
            }}
            onMouseLeave={() => setTip(null)}
          />
        ))}
      </svg>
      <TipLayer tip={tip} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AllocationFlow — current feedstock allocation as a flow diagram
//
// Source nodes (left) → facility node (right).
// Edge width proportional to tonnes. Click a source to see its details.
// ─────────────────────────────────────────────────────────────────────────────

export interface AllocSource {
  id: string;
  name: string;
  tonnes: number;
  distanceKm: number;
  stream: string;
  trips: number;
  marginInr: number;
}

export function AllocationFlow({
  sources,
  facilityName,
  onSourceClick,
  selectedSourceId,
  height,
}: {
  sources: AllocSource[];
  facilityName: string;
  onSourceClick?: (id: string | null) => void;
  selectedSourceId?: string | null;
  height?: number;
}) {
  if (sources.length === 0) return null;

  const ROWS = Math.min(sources.length, 14);
  const ROW_H = 34;
  const H = height ?? Math.max(120, ROWS * ROW_H + 24);
  const W = 560;
  const FAC_X = W - 90;
  const FAC_Y = H / 2;
  const FAC_H = Math.min(H - 20, ROWS * ROW_H * 0.9);
  const SRC_X = 10;

  const totalT = sources.reduce((s, x) => s + x.tonnes, 0);
  const maxT = Math.max(...sources.map((s) => s.tonnes), 1);

  // Assign y positions to each source
  const srcY = (i: number) => {
    const span = Math.min(H - 20, ROWS * ROW_H);
    const top = H / 2 - span / 2;
    return top + (i / Math.max(1, ROWS - 1)) * span;
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: H, display: 'block', overflow: 'visible' }}
    >
      {/* Facility box */}
      <rect
        x={FAC_X}
        y={FAC_Y - FAC_H / 2}
        width={80}
        height={FAC_H}
        fill="var(--green-100)"
        stroke="var(--green-500)"
        strokeWidth={1.5}
      />
      <text
        x={FAC_X + 40}
        y={FAC_Y - 7}
        textAnchor="middle"
        style={{ fontSize: 8.5, fill: 'var(--green-700)', fontFamily: 'var(--font-sans)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}
      >
        FACILITY
      </text>
      <text
        x={FAC_X + 40}
        y={FAC_Y + 8}
        textAnchor="middle"
        style={{ fontSize: 9.5, fill: 'var(--ink)', fontFamily: 'var(--font-mono)' }}
      >
        {num(totalT, 1)} t
      </text>

      {/* Flows + source nodes */}
      {sources.slice(0, ROWS).map((src, i) => {
        const y = srcY(i);
        const sw = Math.max(1, (src.tonnes / maxT) * 7);
        const isSelected = selectedSourceId === src.id;
        const midX = (SRC_X + 120 + FAC_X) / 2;
        const cp1x = midX;
        const cp1y = y;
        const cp2x = midX;
        const cp2y = FAC_Y;
        const d = `M${SRC_X + 120},${y} C${cp1x},${cp1y} ${cp2x},${cp2y} ${FAC_X},${FAC_Y}`;

        return (
          <g key={src.id}>
            {/* flow arc */}
            <path
              d={d}
              fill="none"
              stroke={isSelected ? 'var(--green-700)' : 'var(--green-300)'}
              strokeWidth={sw}
              opacity={isSelected ? 0.95 : 0.55}
              style={{ transition: 'stroke var(--t-fast), opacity var(--t-fast)' }}
            />

            {/* source node */}
            <rect
              x={SRC_X}
              y={y - 12}
              width={120}
              height={24}
              fill={isSelected ? 'var(--green-100)' : 'var(--surface)'}
              stroke={isSelected ? 'var(--green-500)' : 'var(--rule-2)'}
              strokeWidth={isSelected ? 1.5 : 1}
              style={{ cursor: 'pointer', transition: 'fill var(--t-fast)' }}
              onClick={() => onSourceClick?.(isSelected ? null : src.id)}
            />
            <text
              x={SRC_X + 5}
              y={y - 2}
              style={{
                fontSize: 9,
                fill: 'var(--ink-2)',
                fontFamily: 'var(--font-sans)',
                pointerEvents: 'none',
              }}
            >
              {src.name.length > 16 ? src.name.slice(0, 15) + '…' : src.name}
            </text>
            <text
              x={SRC_X + 5}
              y={y + 9}
              style={{
                fontSize: 9.5,
                fill: 'var(--ink)',
                fontFamily: 'var(--font-mono)',
                pointerEvents: 'none',
                fontWeight: 600,
              }}
            >
              {num(src.tonnes, 1)} t
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WhatIfBars — before/after horizontal bars for scenario preview results
// ─────────────────────────────────────────────────────────────────────────────

export interface WhatIfMetric {
  label: string;
  before: number;
  after: number;
  unit: string;
  higherIsBetter: boolean;
  format?: (v: number) => string;
}

export function WhatIfBars({ metrics }: { metrics: WhatIfMetric[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {metrics.map((m) => {
        const max = Math.max(Math.abs(m.before), Math.abs(m.after), 1);
        const beforePct = (Math.abs(m.before) / max) * 100;
        const afterPct = (Math.abs(m.after) / max) * 100;
        const delta = m.after - m.before;
        const isGood = (delta > 0) === m.higherIsBetter;
        const deltaColor = Math.abs(delta) < 1e-9 ? 'var(--ink-3)' : isGood ? 'var(--green-500)' : 'var(--neg)';
        const fmt = m.format ?? ((v: number) => `${num(v, 1)} ${m.unit}`);

        return (
          <div key={m.label}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
                color: 'var(--ink-3)',
                marginBottom: 3,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              <span>{m.label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: deltaColor, fontWeight: 600 }}>
                {delta > 0 ? '+' : delta < 0 ? '−' : ''}
                {fmt(Math.abs(delta))}
              </span>
            </div>
            {/* before */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
              <span style={{ width: 36, fontSize: 9.5, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                Before
              </span>
              <div style={{ flex: 1, height: 10, background: 'var(--surface-sunken)', position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: '0 auto 0 0',
                    width: `${beforePct}%`,
                    background: 'var(--ink-3)',
                    transition: 'width var(--t-slow)',
                  }}
                />
              </div>
              <span style={{ width: 70, fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)', textAlign: 'right' }}>
                {fmt(m.before)}
              </span>
            </div>
            {/* after */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 36, fontSize: 9.5, color: 'var(--ink)', fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 600 }}>
                After
              </span>
              <div style={{ flex: 1, height: 10, background: 'var(--surface-sunken)', position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: '0 auto 0 0',
                    width: `${afterPct}%`,
                    background: isGood ? 'var(--green-500)' : Math.abs(delta) < 1e-9 ? 'var(--ink-3)' : 'var(--neg)',
                    transition: 'width var(--t-slow)',
                  }}
                />
              </div>
              <span style={{ width: 70, fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--ink)', textAlign: 'right', fontWeight: 600 }}>
                {fmt(m.after)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UtilisationRing — reusable SVG donut ring showing utilisation %
// ─────────────────────────────────────────────────────────────────────────────

export function UtilisationRing({
  pct: utilPct,
  size = 48,
  strokeWidth = 6,
  idle = false,
}: {
  pct: number;
  size?: number;
  strokeWidth?: number;
  idle?: boolean;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const fill = idle ? 0 : Math.min(100, utilPct);
  const dash = (fill / 100) * circ;
  const color =
    idle
      ? 'var(--ink-4)'
      : utilPct >= 97
        ? '#ef4444'
        : utilPct >= 85
          ? 'var(--warn)'
          : 'var(--green-500)';
  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}
    >
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth={strokeWidth} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.4s ease' }}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontSize: size * 0.22,
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          fill: color,
          transform: `rotate(90deg)`,
          transformOrigin: `${cx}px ${cy}px`,
        }}
      >
        {idle ? '—' : `${Math.round(utilPct)}%`}
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FacilityCard — card-mode rendering for the fleet grid view
// ─────────────────────────────────────────────────────────────────────────────

export interface FacilityCardData {
  id: string;
  name: string;
  pathway: PathwayId;
  district: string;
  capacityTpd: number;
  utilisationPct: number;
  remainingT: number;
  status: string;
  binding: boolean;
  carbonIntensity: number;
  marginPerT: number;
  load: number;
}

export function FacilityCard({
  data,
  onClick,
}: {
  data: FacilityCardData;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isIdle = data.utilisationPct < 1 || data.status === 'offline';
  const isConstrained = data.binding || data.utilisationPct >= 97;

  const statusLabel = isIdle ? 'Idle' : isConstrained ? 'Constrained' : 'Operating';
  const statusColor = isIdle ? 'var(--ink-4)' : isConstrained ? '#ef4444' : 'var(--green-500)';
  const StatusIcon = isIdle ? MinusCircle : isConstrained ? AlertTriangle : Zap;
  const pathwayColor = PATHWAY_COLOR[data.pathway] ?? '#555';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: `1px solid ${hovered ? pathwayColor : 'var(--rule)'}`,
        borderTop: `3px solid ${pathwayColor}`,
        background: 'var(--surface)',
        borderRadius: 6,
        padding: '12px 14px',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        boxShadow: hovered ? '0 2px 12px rgba(0,0,0,0.10)' : '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* Header: ring + name + pathway badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <UtilisationRing pct={data.utilisationPct} size={44} strokeWidth={5} idle={isIdle} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Factory size={11} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
            <span style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--ink)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {data.name}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: 3,
              background: pathwayColor,
              color: '#fff',
              letterSpacing: '0.03em',
            }}>
              {PATHWAY_SHORT[data.pathway] ?? data.pathway}
            </span>
            <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{data.district}</span>
          </div>
        </div>
      </div>

      {/* Status chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: statusColor }}>
        <StatusIcon size={11} />
        {statusLabel}
        {isConstrained && (
          <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--ink-3)', marginLeft: 2 }}>
            — binding
          </span>
        )}
      </div>

      {/* Utilisation bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-3)', marginBottom: 3 }}>
          <span>Utilisation</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {isIdle ? '—' : `${num(data.capacityTpd - (data.load > 0 ? data.load / 30 : 0), 0)} t/d free`}
          </span>
        </div>
        <div style={{ height: 5, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, data.utilisationPct)}%`,
            background: isConstrained
              ? 'linear-gradient(90deg, rgba(200,130,30,0.9) 0%, #ef4444 100%)'
              : isIdle
                ? 'var(--ink-4)'
                : 'linear-gradient(90deg, var(--green-500) 0%, #2563eb 100%)',
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Metrics row */}
      {data.load > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 6,
          borderTop: '1px solid var(--rule)',
          paddingTop: 6,
        }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              <Leaf size={8} style={{ display: 'inline', marginRight: 2 }} />tCO₂e/t
            </div>
            <div style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink)' }}>
              {data.carbonIntensity.toFixed(2)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Margin/t</div>
            <div style={{
              fontSize: 11.5,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              color: data.marginPerT >= 0 ? 'var(--green-500)' : '#ef4444',
            }}>
              {inr(data.marginPerT)}
            </div>
          </div>
        </div>
      )}

      {/* CTA */}
      <div style={{
        fontSize: 10,
        color: hovered ? pathwayColor : 'var(--ink-4)',
        fontWeight: 600,
        letterSpacing: '0.04em',
        transition: 'color 0.15s ease',
        textAlign: 'right',
      }}>
        Command →
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CapacityHeatmap — Pathway × District grid
// ─────────────────────────────────────────────────────────────────────────────

export interface HeatmapCell {
  facilityId: string;
  facilityName: string;
  utilisationPct: number;
  capacityTpd: number;
  status: string;
  binding: boolean;
}

export function CapacityHeatmap({
  pathways,
  districts,
  cells,
}: {
  pathways: PathwayId[];
  districts: string[];
  cells: Map<string, HeatmapCell[]>;
}) {
  const [tip, setTip] = useState<{ x: number; y: number; content: ReactNode } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  if (pathways.length === 0 || districts.length === 0) return null;

  function cellKey(p: string, d: string) { return `${p}__${d}`; }

  function utilColor(u: number): string {
    if (u >= 97) return `rgba(220,38,38,${0.20 + (u / 100) * 0.60})`;
    if (u >= 70) return `rgba(200,130,30,${0.18 + ((u - 70) / 30) * 0.50})`;
    return `rgba(46,125,91,${0.12 + (u / 70) * 0.45})`;
  }

  return (
    <div ref={wrap} style={{ position: 'relative', overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11, tableLayout: 'auto' }}>
        <thead>
          <tr>
            <th style={{
              textAlign: 'left',
              padding: '4px 8px',
              fontSize: 10,
              color: 'var(--ink-3)',
              fontWeight: 600,
              width: 88,
              borderBottom: '2px solid var(--rule)',
            }}>
              Pathway / District
            </th>
            {districts.map((d) => (
              <th key={d} style={{
                padding: '4px 8px',
                fontSize: 10,
                color: 'var(--ink-3)',
                fontWeight: 600,
                textAlign: 'center',
                borderBottom: '2px solid var(--rule)',
                whiteSpace: 'nowrap',
              }}>
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pathways.map((pw) => (
            <tr key={pw}>
              <td style={{
                padding: '5px 8px',
                fontWeight: 600,
                fontSize: 10.5,
                color: PATHWAY_COLOR[pw] ?? 'var(--ink)',
                borderBottom: '1px solid var(--rule)',
                whiteSpace: 'nowrap',
              }}>
                {PATHWAY_SHORT[pw] ?? pw}
              </td>
              {districts.map((d) => {
                const key = cellKey(pw, d);
                const slot = cells.get(key) ?? [];
                const isEmpty = slot.length === 0;
                const maxUtil = isEmpty ? 0 : Math.max(...slot.map((c) => c.utilisationPct));
                const names = slot.map((c) => c.facilityName).join(', ');
                const bindingCount = slot.filter((c) => c.binding).length;

                return (
                  <td
                    key={d}
                    style={{
                      borderBottom: '1px solid var(--rule)',
                      borderLeft: '1px solid var(--rule)',
                      textAlign: 'center',
                      padding: '5px 8px',
                      background: isEmpty
                        ? 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.025) 4px, rgba(0,0,0,0.025) 5px)'
                        : utilColor(maxUtil),
                      cursor: isEmpty ? 'default' : 'help',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      if (isEmpty) return;
                      const r = wrap.current?.getBoundingClientRect();
                      if (!r) return;
                      setTip({
                        x: e.clientX - r.left,
                        y: e.clientY - r.top,
                        content: (
                          <>
                            <div className="t-l" style={{ marginBottom: 3 }}>{names}</div>
                            <div style={{ color: 'var(--ink-3)' }}>{PATHWAY_SHORT[pw]} · {d}</div>
                            <div style={{ marginTop: 4 }}>
                              Max util: <strong>{pct(maxUtil, 0)}</strong>
                              {slot.length > 1 && ` (${slot.length} facilities)`}
                              {bindingCount > 0 && ` · ${bindingCount} binding`}
                            </div>
                          </>
                        ),
                      });
                    }}
                    onMouseLeave={() => setTip(null)}
                  >
                    {isEmpty ? (
                      <span style={{ color: 'var(--ink-4)', fontSize: 9.5 }}>—</span>
                    ) : (
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        fontSize: 11,
                        color: maxUtil >= 85 ? '#fff' : 'var(--ink)',
                      }}>
                        {pct(maxUtil, 0)}
                      </span>
                    )}
                    {slot.length > 1 && (
                      <span style={{
                        position: 'absolute',
                        top: 2,
                        right: 3,
                        fontSize: 8,
                        fontWeight: 700,
                        color: maxUtil >= 85 ? 'rgba(255,255,255,0.8)' : 'var(--ink-3)',
                        lineHeight: 1,
                      }}>
                        {slot.length}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Colour legend */}
      <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 10, color: 'var(--ink-3)', alignItems: 'center' }}>
        {[
          { color: 'rgba(46,125,91,0.5)', label: 'Under 70%' },
          { color: 'rgba(200,130,30,0.6)', label: '70–97%' },
          { color: 'rgba(220,38,38,0.75)', label: '97%+ (binding)' },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
            {label}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            width: 10, height: 10, borderRadius: 2,
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)',
            display: 'inline-block',
            border: '1px solid var(--rule)',
          }} />
          No facility
        </span>
      </div>

      {tip && (
        <div className="charttip" style={{ left: tip.x, top: tip.y }}>
          {tip.content}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SourceScoreBar — horizontal stacked breakdown bar per allocated source
// ─────────────────────────────────────────────────────────────────────────────

export interface SourceScore {
  id: string;
  name: string;
  distanceKm: number;
  tonnes: number;
  marginInr: number;
  carbonPerT: number;
}

function scoreSource(
  s: SourceScore,
  maxDistKm: number,
  maxT: number,
  maxMargin: number,
  maxCarbon: number,
) {
  const dist   = maxDistKm > 0 ? Math.max(0, 1 - s.distanceKm / maxDistKm) : 1;
  const vol    = maxT > 0 ? s.tonnes / maxT : 0;
  const carbon = maxCarbon > 0 ? Math.max(0, 1 - s.carbonPerT / maxCarbon) : 1;
  const margin = maxMargin > 0 ? Math.max(0, s.marginInr / maxMargin) : 0;
  return { dist, vol, carbon, margin, total: dist * 0.35 + vol * 0.25 + carbon * 0.25 + margin * 0.15 };
}

export function SourceScoreBar({ sources }: { sources: SourceScore[] }) {
  const [tip, setTip] = useState<{ x: number; y: number; content: ReactNode } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const scored = useMemo(() => {
    if (sources.length === 0) return [];
    const maxDistKm = Math.max(...sources.map((s) => s.distanceKm), 1);
    const maxT      = Math.max(...sources.map((s) => s.tonnes), 1);
    const maxMargin = Math.max(...sources.map((s) => s.marginInr), 1);
    const maxCarbon = Math.max(...sources.map((s) => s.carbonPerT), 0.01);
    return sources
      .map((s) => ({ ...s, sc: scoreSource(s, maxDistKm, maxT, maxMargin, maxCarbon) }))
      .sort((a, b) => b.sc.total - a.sc.total)
      .slice(0, 4);
  }, [sources]);

  if (scored.length === 0) return null;

  const SEGMENTS = [
    { key: 'dist',   label: 'Distance', color: '#4a6b78',  weight: 0.35 },
    { key: 'vol',    label: 'Volume',   color: '#2563eb',  weight: 0.25 },
    { key: 'carbon', label: 'Carbon',   color: '#14503a',  weight: 0.25 },
    { key: 'margin', label: 'Margin',   color: '#6d8a3c',  weight: 0.15 },
  ] as const;

  return (
    <div ref={wrap} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 7 }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, fontSize: 9.5, color: 'var(--ink-3)', marginBottom: 1 }}>
        {SEGMENTS.map((seg) => (
          <span key={seg.key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, display: 'inline-block' }} />
            {seg.label}
          </span>
        ))}
      </div>

      {scored.map((s) => {
        const sc = s.sc;
        const rawSum = sc.dist * 0.35 + sc.vol * 0.25 + sc.carbon * 0.25 + sc.margin * 0.15;
        const segs = [
          { key: 'dist',   w: rawSum > 0 ? (sc.dist   * 0.35 / rawSum) * 100 : 0, color: '#4a6b78', label: 'Distance', val: `${num(s.distanceKm, 0)} km` },
          { key: 'vol',    w: rawSum > 0 ? (sc.vol    * 0.25 / rawSum) * 100 : 0, color: '#2563eb', label: 'Volume',   val: `${num(s.tonnes, 0)} t` },
          { key: 'carbon', w: rawSum > 0 ? (sc.carbon * 0.25 / rawSum) * 100 : 0, color: '#14503a', label: 'Carbon',   val: `${s.carbonPerT.toFixed(3)} tCO₂e/t` },
          { key: 'margin', w: rawSum > 0 ? (sc.margin * 0.15 / rawSum) * 100 : 0, color: '#6d8a3c', label: 'Margin',   val: inr(s.marginInr) },
        ];

        return (
          <div key={s.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginBottom: 3 }}>
              <span style={{ fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                {s.name}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                {pct(sc.total * 100, 0)}
              </span>
            </div>
            <div
              style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--surface-sunken)' }}
              onMouseEnter={(e) => {
                const r = wrap.current?.getBoundingClientRect();
                if (!r) return;
                setTip({
                  x: e.clientX - r.left,
                  y: e.clientY - r.top,
                  content: (
                    <>
                      <div className="t-l" style={{ marginBottom: 4 }}>{s.name}</div>
                      {segs.map((seg) => (
                        <div key={seg.key} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 1, background: seg.color, display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ color: 'var(--ink-3)' }}>{seg.label}:</span>
                          <strong>{seg.val}</strong>
                        </div>
                      ))}
                      <div style={{ marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 4 }}>
                        Match score: <strong>{pct(sc.total * 100, 0)}</strong>
                      </div>
                    </>
                  ),
                });
              }}
              onMouseLeave={() => setTip(null)}
            >
              {segs.map((seg) =>
                seg.w > 0 ? (
                  <div key={seg.key} style={{ width: `${seg.w}%`, background: seg.color, transition: 'width 0.3s ease' }} />
                ) : null,
              )}
            </div>
          </div>
        );
      })}

      {tip && (
        <div className="charttip" style={{ left: tip.x, top: tip.y }}>
          {tip.content}
        </div>
      )}
    </div>
  );
}
