/**
 * The network map.
 *
 * Rendered as hand-built SVG over real district geometry embedded in the bundle —
 * no tile server, no map library, no network request. That is a deliberate
 * trade: it costs us basemap detail we do not need and buys complete control over
 * how flows animate, plus a map that cannot fail in front of an audience.
 *
 * Visual grammar:
 *   source  = small square, size by tonnage, hollow when unplaced
 *   facility = shape by pathway, fill by operating state, ring by utilisation
 *   flow    = arc, width by tonnage, colour by pathway, drawn on change
 *
 * The arc curvature does the work an arrowhead would: flows bow consistently in
 * the direction of travel, so a facility with many inbound flows reads as a fan
 * rather than a tangle.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Allocation, Facility, PathwayId, WasteSource } from '../../../engine/src/types.ts';
import region from '../data/region.json';
import { num, tonnes } from '../format.ts';

type Ring = number[][];
type Poly = Ring[];
interface DistrictShape {
  d: string;
  s: string;
  p: Poly[];
}

const REGION = region as unknown as { core: DistrictShape[]; context: DistrictShape[] };

export const PATHWAY_COLOR: Record<PathwayId, string> = {
  pyrolysis_biochar: '#14503a',
  anaerobic_digestion_cbg: '#4a6b78',
  pellet_cofiring: '#8a5a3c',
  composting: '#6d8a3c',
  gasification_power: '#7a5f7d',
};

export const PATHWAY_SHORT: Record<PathwayId, string> = {
  pyrolysis_biochar: 'Biochar',
  anaerobic_digestion_cbg: 'Bio-CNG',
  pellet_cofiring: 'Pellets',
  composting: 'Compost',
  gasification_power: 'Power',
};

// ─────────────────────────────────────────────────────────────────────────────
// Projection
// ─────────────────────────────────────────────────────────────────────────────

export const VB_W = 1000;
export const VB_H = 720;

/**
 * Web-Mercator northing, expressed in the same units as longitude (degrees).
 *
 * The 180/π factor matters: without it, x is in degrees and y is in radians, and
 * the map comes out squashed vertically by a factor of about six. Keeping both
 * axes in degree-equivalents is what makes the single uniform `scale` below
 * correct.
 */
const RAD_TO_DEG = 180 / Math.PI;

function mercY(lat: number): number {
  return RAD_TO_DEG * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
}

const BOUNDS = (() => {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const d of REGION.core) {
    for (const poly of d.p) {
      for (const ring of poly) {
        for (const [lon, lat] of ring) {
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
      }
    }
  }
  return { minLon, maxLon, minLat, maxLat };
})();

export const PROJ = (() => {
  const pad = 26;
  const x0 = BOUNDS.minLon;
  const x1 = BOUNDS.maxLon;
  const y0 = mercY(BOUNDS.minLat);
  const y1 = mercY(BOUNDS.maxLat);
  const spanX = x1 - x0;
  const spanY = y1 - y0;
  const scale = Math.min((VB_W - pad * 2) / spanX, (VB_H - pad * 2) / spanY);
  const offX = pad + (VB_W - pad * 2 - spanX * scale) / 2;
  const offY = pad + (VB_H - pad * 2 - spanY * scale) / 2;
  return {
    scale,
    x: (lon: number) => offX + (lon - x0) * scale,
    y: (lat: number) => offY + (y1 - mercY(lat)) * scale,
  };
})();

/** Kilometres per viewBox unit at the centre latitude — used for the scale bar. */
const KM_PER_UNIT = (() => {
  const lat = (BOUNDS.minLat + BOUNDS.maxLat) / 2;
  const degPerUnit = 1 / PROJ.scale;
  return degPerUnit * 111.32 * Math.cos((lat * Math.PI) / 180);
})();

function pathOf(polys: Poly[]): string {
  let d = '';
  for (const poly of polys) {
    for (const ring of poly) {
      for (let i = 0; i < ring.length; i++) {
        const [lon, lat] = ring[i];
        d += `${i ? 'L' : 'M'}${PROJ.x(lon).toFixed(1)},${PROJ.y(lat).toFixed(1)}`;
      }
      d += 'Z';
    }
  }
  return d;
}

export const CORE_PATHS = REGION.core.map((d, i) => ({ key: `${d.s}/${d.d}/${i}`, name: d.d, d: pathOf(d.p) }));
export const CONTEXT_PATHS = REGION.context.map((d, i) => ({ key: `${d.s}/${d.d}/${i}`, d: pathOf(d.p) }));

// ─────────────────────────────────────────────────────────────────────────────
// Markers
// ─────────────────────────────────────────────────────────────────────────────

function facilityShape(pathway: PathwayId, x: number, y: number, r: number): string {
  switch (pathway) {
    case 'pyrolysis_biochar': // diamond
      return `M${x},${y - r} L${x + r},${y} L${x},${y + r} L${x - r},${y} Z`;
    case 'pellet_cofiring': // triangle
      return `M${x},${y - r} L${x + r * 0.92},${y + r * 0.7} L${x - r * 0.92},${y + r * 0.7} Z`;
    case 'composting': // square
      return `M${x - r * 0.82},${y - r * 0.82} H${x + r * 0.82} V${y + r * 0.82} H${x - r * 0.82} Z`;
    case 'gasification_power': {
      // pentagon
      let d = '';
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        d += `${i ? 'L' : 'M'}${(x + Math.cos(a) * r).toFixed(2)},${(y + Math.sin(a) * r).toFixed(2)}`;
      }
      return d + 'Z';
    }
    default: {
      // circle, approximated so every marker is one <path>
      const k = r * 0.5523;
      return `M${x},${y - r} C${x + k},${y - r} ${x + r},${y - k} ${x + r},${y} C${x + r},${y + k} ${x + k},${y + r} ${x},${y + r} C${x - k},${y + r} ${x - r},${y + k} ${x - r},${y} C${x - r},${y - k} ${x - k},${y - r} ${x},${y - r} Z`;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export type Selection =
  | { kind: 'source'; id: string }
  | { kind: 'facility'; id: string }
  | { kind: 'flow'; sourceId: string; facilityId: string }
  | null;

export function NetworkMap({
  sources,
  facilities,
  allocations,
  selection,
  onSelect,
  highlightIds,
  showFlows = true,
  showLabels = true,
  showLegend = true,
  focusIds,
}: {
  sources: WasteSource[];
  facilities: Facility[];
  allocations: Allocation[];
  selection: Selection;
  onSelect: (s: Selection) => void;
  highlightIds?: Set<string>;
  showFlows?: boolean;
  showLabels?: boolean;
  /** The legend is worth its space on the full map screen and in the way elsewhere. */
  showLegend?: boolean;
  focusIds?: Set<string>;
}) {
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  const [panning, setPanning] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const facById = useMemo(() => new Map(facilities.map((f) => [f.id, f])), [facilities]);
  const srcById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);

  const allocatedBySource = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of allocations) m.set(a.sourceId, (m.get(a.sourceId) ?? 0) + a.tonnes);
    return m;
  }, [allocations]);

  const loadByFacility = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of allocations) m.set(a.facilityId, (m.get(a.facilityId) ?? 0) + a.tonnes);
    return m;
  }, [allocations]);

  const maxAlloc = useMemo(
    () => Math.max(...allocations.map((a) => a.tonnes), 1),
    [allocations],
  );
  const maxSource = useMemo(() => Math.max(...sources.map((s) => s.availableT), 1), [sources]);

  // Track which flows are new so they can draw themselves in.
  const prevKeys = useRef<Set<string>>(new Set());
  const [drawKeys, setDrawKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    const now = new Set(allocations.map((a) => `${a.sourceId}>${a.facilityId}`));
    const fresh = new Set<string>();
    for (const k of now) if (!prevKeys.current.has(k)) fresh.add(k);
    prevKeys.current = now;
    setDrawKeys(fresh);
    if (fresh.size === 0) return;
    const t = window.setTimeout(() => setDrawKeys(new Set()), 700);
    return () => window.clearTimeout(t);
  }, [allocations]);

  // ── Interaction ───────────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * VB_W;
    const py = ((e.clientY - rect.top) / rect.height) * VB_H;
    setView((v) => {
      const k = Math.max(1, Math.min(9, v.k * (e.deltaY < 0 ? 1.16 : 1 / 1.16)));
      // Keep the point under the cursor fixed while zooming.
      const tx = px - ((px - v.tx) / v.k) * k;
      const ty = py - ((py - v.ty) / v.k) * k;
      return clampView({ k, tx, ty });
    });
  }, []);

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
    setPanning(true);
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const sx = VB_W / rect.width;
    const sy = VB_H / rect.height;
    setView((v) =>
      clampView({ k: v.k, tx: d.tx + (e.clientX - d.x) * sx, ty: d.ty + (e.clientY - d.y) * sy }),
    );
  };
  const onUp = () => {
    dragRef.current = null;
    setPanning(false);
  };

  function clampView(v: { k: number; tx: number; ty: number }) {
    const maxX = 0;
    const minX = VB_W - VB_W * v.k;
    const maxY = 0;
    const minY = VB_H - VB_H * v.k;
    return {
      k: v.k,
      tx: Math.min(maxX, Math.max(minX, v.tx)),
      ty: Math.min(maxY, Math.max(minY, v.ty)),
    };
  }

  const zoomBy = (f: number) =>
    setView((v) => {
      const k = Math.max(1, Math.min(9, v.k * f));
      const cx = VB_W / 2;
      const cy = VB_H / 2;
      return clampView({ k, tx: cx - ((cx - v.tx) / v.k) * k, ty: cy - ((cy - v.ty) / v.k) * k });
    });

  // ── Derived visual state ──────────────────────────────────────────────────
  const relatedSources = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === 'source') return new Set([selection.id]);
    if (selection.kind === 'facility')
      return new Set(allocations.filter((a) => a.facilityId === selection.id).map((a) => a.sourceId));
    if (selection.kind === 'flow') return new Set([selection.sourceId]);
    return null;
  }, [selection, allocations]);

  const relatedFacilities = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === 'facility') return new Set([selection.id]);
    if (selection.kind === 'source')
      return new Set(allocations.filter((a) => a.sourceId === selection.id).map((a) => a.facilityId));
    if (selection.kind === 'flow') return new Set([selection.facilityId]);
    return null;
  }, [selection, allocations]);

  const strokeScale = 1 / view.k;
  const labelZoom = view.k >= 1.9;

  /**
   * Greedy label placement.
   *
   * Facilities cluster around the same district towns, so simply labelling every
   * one of them produces overlapping text that is worse than no label at all.
   * Largest plants claim their space first; a label is dropped if its box would
   * collide with one already placed. Recomputed on zoom, so labels reappear as
   * the map opens up.
   */
  const labelledFacilities = useMemo(() => {
    if (!showLabels) return new Set<string>();
    const fontPx = 9 / view.k;
    const charW = fontPx * 0.58;
    const lineH = fontPx * 1.5;
    const placed: Array<{ x0: number; x1: number; y0: number; y1: number }> = [];
    const accepted = new Set<string>();

    for (const f of [...facilities].sort((a, b) => b.capacityTpd - a.capacityTpd)) {
      if (!labelZoom && f.capacityTpd < 100) continue;
      const text = labelZoom ? f.name : f.name.split(' ')[0];
      const x = PROJ.x(f.lon);
      const y = PROJ.y(f.lat);
      const r = (4.2 + Math.sqrt(f.capacityTpd / 200) * 4.4) / view.k / 0.8;
      const halfW = (text.length * charW) / 2;
      const box = {
        x0: x - halfW,
        x1: x + halfW,
        y0: y - r * 1.9 - lineH,
        y1: y - r * 1.9 + lineH * 0.25,
      };
      const clash = placed.some(
        (p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0,
      );
      if (clash) continue;
      placed.push(box);
      accepted.add(f.id);
    }
    return accepted;
  }, [facilities, view.k, labelZoom, showLabels]);

  // Scale bar
  const scaleKm = useMemo(() => {
    const target = 120 / view.k;
    const raw = target * KM_PER_UNIT;
    const nice = [5, 10, 20, 25, 50, 100, 150, 200].reduce((p, c) =>
      Math.abs(c - raw) < Math.abs(p - raw) ? c : p,
    );
    return { km: nice, px: nice / KM_PER_UNIT };
  }, [view.k]);

  return (
    <div className="mapstage">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className={panning ? 'panning' : ''}
        onWheel={onWheel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        role="img"
        aria-label="Network map of waste sources, processing facilities and active material flows across Punjab and Haryana"
      >
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          <g>
            {CONTEXT_PATHS.map((p) => (
              <path key={p.key} className="district context" d={p.d} strokeWidth={0.7 * strokeScale} />
            ))}
            {CORE_PATHS.map((p) => (
              <path key={p.key} className="district core" d={p.d} strokeWidth={1.0 * strokeScale} />
            ))}
          </g>

          {/* Flows */}
          {showFlows && (
            <g>
              {allocations.map((a) => {
                const s = srcById.get(a.sourceId);
                const f = facById.get(a.facilityId);
                if (!s || !f) return null;
                const x1 = PROJ.x(s.lon);
                const y1 = PROJ.y(s.lat);
                const x2 = PROJ.x(f.lon);
                const y2 = PROJ.y(f.lat);
                const mx = (x1 + x2) / 2;
                const my = (y1 + y2) / 2;
                const dx = x2 - x1;
                const dy = y2 - y1;
                const cx = mx - dy * 0.14;
                const cy = my + dx * 0.14;
                const d = `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
                const key = `${a.sourceId}>${a.facilityId}`;
                const w = (0.7 + (a.tonnes / maxAlloc) * 3.4) * strokeScale;
                const dim =
                  (relatedSources && !relatedSources.has(a.sourceId)) ||
                  (relatedFacilities && !relatedFacilities.has(a.facilityId));
                const len = Math.hypot(dx, dy) * 1.15;
                const isNew = drawKeys.has(key);
                return (
                  <path
                    key={key}
                    className={`flow ${dim ? 'dim' : ''} ${isNew ? 'draw' : ''}`}
                    d={d}
                    stroke={PATHWAY_COLOR[a.pathway]}
                    strokeWidth={w}
                    opacity={dim ? 0.1 : 0.58}
                    style={
                      isNew
                        ? ({ '--len': `${len}`, strokeDasharray: len } as React.CSSProperties)
                        : undefined
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect({ kind: 'flow', sourceId: a.sourceId, facilityId: a.facilityId });
                    }}
                  >
                    <title>{`${s.name} → ${f.name}: ${tonnes(a.tonnes)} t over ${num(a.distanceKm)} km`}</title>
                  </path>
                );
              })}
            </g>
          )}

          {/* Sources */}
          <g>
            {sources.map((s) => {
              const x = PROJ.x(s.lon);
              const y = PROJ.y(s.lat);
              const alloc = allocatedBySource.get(s.id) ?? 0;
              const share = s.availableT > 0 ? alloc / s.availableT : 0;
              const r = (1.7 + Math.sqrt(s.availableT / maxSource) * 3.6) * strokeScale * 1.4;
              const dim = relatedSources ? !relatedSources.has(s.id) : false;
              const hl = highlightIds?.has(s.id);
              const focused = focusIds?.has(s.id);
              return (
                <g key={s.id} className={dim ? 'node-dim' : undefined}>
                  {focused && (
                    <circle
                      className="focusring"
                      cx={x}
                      cy={y}
                      r={r * 1.6}
                      stroke="var(--neg)"
                      strokeWidth={1.4 * strokeScale}
                      style={{ ['--r0' as string]: `${r * 1.6}` }}
                    />
                  )}
                  <rect
                    className="node-src"
                    x={x - r}
                    y={y - r}
                    width={r * 2}
                    height={r * 2}
                    fill={share > 0.02 ? 'var(--ink)' : 'transparent'}
                    fillOpacity={share > 0.02 ? 0.25 + share * 0.6 : 0}
                    stroke={hl ? 'var(--neg)' : share > 0.02 ? 'var(--ink)' : 'var(--ink-4)'}
                    strokeWidth={(hl ? 1.6 : 0.9) * strokeScale}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect({ kind: 'source', id: s.id });
                    }}
                  >
                    <title>{`${s.name} — ${num(s.availableT)} t available, ${num(alloc)} t allocated`}</title>
                  </rect>
                </g>
              );
            })}
          </g>

          {/* Facilities */}
          <g>
            {facilities.map((f) => {
              const x = PROJ.x(f.lon);
              const y = PROJ.y(f.lat);
              const load = loadByFacility.get(f.id) ?? 0;
              const cap = f.capacityTpd * Math.max(f.availability, 0.001) * 30;
              const util = Math.max(0, Math.min(1, load / cap));
              const r = (4.2 + Math.sqrt(f.capacityTpd / 200) * 4.4) * strokeScale * 1.25;
              const offline = f.status === 'offline';
              const running = load > 0.5 && !offline;
              const dim = relatedFacilities ? !relatedFacilities.has(f.id) : false;
              const focused = focusIds?.has(f.id);

              return (
                <g key={f.id} className={dim ? 'node-dim' : undefined}>
                  {focused && (
                    <circle
                      className="focusring"
                      cx={x}
                      cy={y}
                      r={r * 1.5}
                      stroke={offline ? 'var(--neg)' : 'var(--green-500)'}
                      strokeWidth={1.6 * strokeScale}
                      style={{ ['--r0' as string]: `${r * 1.5}` }}
                    />
                  )}
                  {/* utilisation ring */}
                  {!offline && (
                    <circle
                      cx={x}
                      cy={y}
                      r={r * 1.55}
                      fill="none"
                      stroke="var(--rule-2)"
                      strokeWidth={1.5 * strokeScale}
                      opacity={0.8}
                    />
                  )}
                  {!offline && util > 0.02 && (
                    <circle
                      cx={x}
                      cy={y}
                      r={r * 1.55}
                      fill="none"
                      stroke={util > 0.97 ? 'var(--warn)' : 'var(--green-500)'}
                      strokeWidth={1.9 * strokeScale}
                      strokeDasharray={`${2 * Math.PI * r * 1.55 * util} ${2 * Math.PI * r * 1.55}`}
                      transform={`rotate(-90 ${x} ${y})`}
                      strokeLinecap="butt"
                    />
                  )}
                  <path
                    className="node-fac"
                    d={facilityShape(f.pathway, x, y, r)}
                    fill={offline ? 'var(--neg-bg)' : running ? PATHWAY_COLOR[f.pathway] : 'var(--surface)'}
                    stroke={offline ? 'var(--neg)' : PATHWAY_COLOR[f.pathway]}
                    strokeWidth={1.5 * strokeScale}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect({ kind: 'facility', id: f.id });
                    }}
                  >
                    <title>{`${f.name} — ${PATHWAY_SHORT[f.pathway]}, ${num(f.capacityTpd)} t/day, ${(util * 100).toFixed(0)}% utilised`}</title>
                  </path>
                  {offline && (
                    <g stroke="var(--neg)" strokeWidth={1.5 * strokeScale}>
                      <line x1={x - r * 0.7} y1={y - r * 0.7} x2={x + r * 0.7} y2={y + r * 0.7} />
                      <line x1={x + r * 0.7} y1={y - r * 0.7} x2={x - r * 0.7} y2={y + r * 0.7} />
                    </g>
                  )}
                  {labelledFacilities.has(f.id) && (
                    <text
                      className="maplabel fac"
                      x={x}
                      y={y - r * 1.9}
                      textAnchor="middle"
                      style={{ fontSize: 9 * strokeScale, strokeWidth: 2.4 * strokeScale }}
                    >
                      {labelZoom ? f.name : f.name.split(' ')[0]}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

        </g>
      </svg>

      <div className="mapctl">
        <div className="row">
          <button onClick={() => zoomBy(1.4)} title="Zoom in" aria-label="Zoom in">
            +
          </button>
          <button onClick={() => zoomBy(1 / 1.4)} title="Zoom out" aria-label="Zoom out">
            &minus;
          </button>
        </div>
        <div className="row">
          <button
            onClick={() => setView({ k: 1, tx: 0, ty: 0 })}
            title="Reset view"
            aria-label="Reset view"
            style={{ width: 54 }}
          >
            reset
          </button>
        </div>
      </div>

      <div className="mapscale">
        <svg width={Math.max(24, scaleKm.px)} height={9} style={{ display: 'block' }}>
          <line
            x1={0.5}
            y1={6}
            x2={Math.max(24, scaleKm.px) - 0.5}
            y2={6}
            stroke="var(--ink-2)"
            strokeWidth={1}
          />
          <line x1={0.5} y1={2} x2={0.5} y2={8} stroke="var(--ink-2)" strokeWidth={1} />
          <line
            x1={Math.max(24, scaleKm.px) - 0.5}
            y1={2}
            x2={Math.max(24, scaleKm.px) - 0.5}
            y2={8}
            stroke="var(--ink-2)"
            strokeWidth={1}
          />
        </svg>
        {scaleKm.km} km
      </div>

      {showLegend && (
      <div className="maplegend">
        <div className="lg-t">Conversion pathway</div>
        {(Object.keys(PATHWAY_COLOR) as PathwayId[]).map((p) => (
          <div className="lg-row" key={p}>
            <svg className="lg-sw" viewBox="0 0 12 12">
              <path d={facilityShape(p, 6, 6, 4.6)} fill={PATHWAY_COLOR[p]} />
            </svg>
            {PATHWAY_SHORT[p]}
          </div>
        ))}
        <div className="lg-t" style={{ marginTop: 8 }}>
          Reading the map
        </div>
        <div className="lg-row">
          <svg className="lg-sw" viewBox="0 0 12 12">
            <rect x={3} y={3} width={6} height={6} fill="var(--ink)" fillOpacity={0.7} />
          </svg>
          Source, filled by share collected
        </div>
        <div className="lg-row">
          <svg className="lg-sw" viewBox="0 0 12 12">
            <circle cx={6} cy={6} r={4.4} fill="none" stroke="var(--green-500)" strokeWidth={1.6} />
          </svg>
          Ring = facility utilisation
        </div>
        <div className="lg-row">
          <svg className="lg-sw" viewBox="0 0 12 12">
            <path d="M1 9 Q6 1 11 5" fill="none" stroke="var(--ink-3)" strokeWidth={1.6} />
          </svg>
          Flow, width by tonnage
        </div>
      </div>
      )}
    </div>
  );
}
