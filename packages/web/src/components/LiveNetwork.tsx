/**
 * The living network.
 *
 * Not a map with a chart under it — the network *is* the screen, and it moves.
 * Material travels the arcs it is actually allocated to, plants pulse at a rate
 * set by what they are actually receiving, and selecting anything illuminates
 * what it is connected to while the rest softens.
 *
 * What "alive" means here, precisely
 * ---------------------------------
 * Every moving thing is a modelled quantity, never a fabricated one. A token on
 * an arc means the optimiser placed tonnes on that arc in the plan currently in
 * force. Its size is that tonnage; its speed is the haul distance. There is no
 * GPS, no vehicle, no clock, no telemetry, and nothing on screen implies a truck
 * is at a position right now. The label says "modelled network activity" because
 * that is what it is.
 *
 * How it stays cheap
 * ------------------
 * Tokens ride CSS `offset-path` and animate exactly one property,
 * `offset-distance`, which the compositor can run without touching layout or
 * paint. Thirty-six tokens cost about as much as one. React renders the SVG once
 * per plan change and never during motion — there is no per-frame state, no
 * requestAnimationFrame loop, no re-render while material moves. Animation is
 * paused wholesale when the tab is hidden or the network scrolls out of view,
 * and switched off entirely under `prefers-reduced-motion`.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CORE_PATHS,
  CONTEXT_PATHS,
  PATHWAY_COLOR,
  PROJ,
  VB_W,
  VB_H,
} from './NetworkMap.tsx';
import type { Allocation, Facility, WasteSource } from '../../../engine/src/types.ts';
import '../styles/live-network.css';

export type LiveSelection =
  | null
  | { kind: 'facility'; id: string }
  | { kind: 'source'; id: string }
  | { kind: 'flow'; sourceId: string; facilityId: string };

interface Arc {
  key: string;
  sourceId: string;
  facilityId: string;
  d: string;
  tonnes: number;
  pathway: string;
  /** seconds for one token to traverse — longer hauls take longer */
  dur: number;
  delay: number;
  width: number;
  tokenR: number;
}

export function LiveNetwork({
  sources,
  facilities,
  allocations,
  selection,
  onSelect,
  /** dimmed and slowed while the engine is re-solving */
  busy = false,
  /** ids the current scenario knocked out — drawn as offline */
  offlineIds,
}: {
  sources: WasteSource[];
  facilities: Facility[];
  allocations: Allocation[];
  selection: LiveSelection;
  onSelect: (s: LiveSelection) => void;
  busy?: boolean;
  offlineIds?: Set<string>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(true);

  // Stop the animation when it cannot be seen. A tab in the background paying
  // for thirty-six compositor animations is pure waste, and on a laptop running
  // a demo it is battery the presenter needs.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let visible = !document.hidden;
    let onScreen = true;
    const sync = () => setRunning(visible && onScreen);

    const onVis = () => {
      visible = !document.hidden;
      sync();
    };
    document.addEventListener('visibilitychange', onVis);

    // Sync once on mount: visibilitychange only fires on a change, so a page that
    // mounts in a background tab would otherwise animate for nobody.
    sync();

    const io = new IntersectionObserver(
      ([e]) => {
        onScreen = e.isIntersecting;
        sync();
      },
      { threshold: 0.05 },
    );
    io.observe(host);

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      io.disconnect();
    };
  }, []);

  const geo = useMemo(() => {
    const srcById = new Map(sources.map((s) => [s.id, s]));
    const facById = new Map(facilities.map((f) => [f.id, f]));

    const maxT = Math.max(...allocations.map((a) => a.tonnes), 1);

    const arcs: Arc[] = [];
    allocations.forEach((a, i) => {
      const s = srcById.get(a.sourceId);
      const f = facById.get(a.facilityId);
      if (!s || !f) return;

      const x1 = PROJ.x(s.lon);
      const y1 = PROJ.y(s.lat);
      const x2 = PROJ.x(f.lon);
      const y2 = PROJ.y(f.lat);

      // Bow consistently in the direction of travel, so many flows arriving at
      // one plant read as a fan rather than a tangle. Same convention the
      // Network Map uses, so the two never look like different networks.
      const cx = (x1 + x2) / 2 + (y2 - y1) * 0.16;
      const cy = (y1 + y2) / 2 - (x2 - x1) * 0.16;
      const d = `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;

      const share = a.tonnes / maxT;
      arcs.push({
        key: `${a.sourceId}>${a.facilityId}`,
        sourceId: a.sourceId,
        facilityId: a.facilityId,
        d,
        tonnes: a.tonnes,
        pathway: a.pathway,
        // Distance sets duration: a long haul genuinely takes longer. Clamped so
        // nothing crawls or darts.
        dur: Math.min(14, Math.max(5, a.distanceKm / 11)),
        delay: -((i * 0.83) % 6),
        width: 0.7 + share * 2.1,
        tokenR: 1.5 + share * 2.4,
      });
    });

    // Throughput per plant, for the pulse rate and the node radius.
    const inbound = new Map<string, number>();
    for (const a of allocations) {
      inbound.set(a.facilityId, (inbound.get(a.facilityId) ?? 0) + a.tonnes);
    }
    const maxIn = Math.max(...inbound.values(), 1);

    const facNodes = facilities.map((f) => {
      const t = inbound.get(f.id) ?? 0;
      const load = t / maxIn;
      return {
        f,
        x: PROJ.x(f.lon),
        y: PROJ.y(f.lat),
        t,
        r: 2.6 + load * 3.6,
        // A busy plant pulses faster. Idle plants do not pulse at all.
        period: t > 0 ? Math.max(1.9, 4.2 - load * 2.0) : 0,
      };
    });

    const placed = new Set(allocations.map((a) => a.sourceId));
    const maxAvail = Math.max(...sources.map((s) => s.availableT), 1);
    const srcNodes = sources.map((s) => ({
      s,
      x: PROJ.x(s.lon),
      y: PROJ.y(s.lat),
      r: 1.3 + (s.availableT / maxAvail) * 2.6,
      placed: placed.has(s.id),
    }));

    return { arcs, facNodes, srcNodes };
  }, [sources, facilities, allocations]);

  /** What the current selection connects to — everything else softens. */
  const lit = useMemo(() => {
    if (!selection) return null;
    const arcs = new Set<string>();
    const facs = new Set<string>();
    const srcs = new Set<string>();

    for (const a of geo.arcs) {
      const hit =
        (selection.kind === 'facility' && a.facilityId === selection.id) ||
        (selection.kind === 'source' && a.sourceId === selection.id) ||
        (selection.kind === 'flow' &&
          a.sourceId === selection.sourceId &&
          a.facilityId === selection.facilityId);
      if (!hit) continue;
      arcs.add(a.key);
      facs.add(a.facilityId);
      srcs.add(a.sourceId);
    }
    if (selection.kind === 'facility') facs.add(selection.id);
    if (selection.kind === 'source') srcs.add(selection.id);
    return { arcs, facs, srcs };
  }, [selection, geo.arcs]);

  const cls = [
    'ln',
    running ? '' : 'paused',
    selection ? 'focused' : '',
    busy ? 'busy' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} ref={hostRef}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice" role="img"
           aria-label="Modelled carbon network: sources, haul routes and processing plants">
        {/* Ground */}
        <g className="ln-geo" aria-hidden>
          {CONTEXT_PATHS.map((p) => (
            <path key={p.key} className="ln-ctx" d={p.d} />
          ))}
          {CORE_PATHS.map((p) => (
            <path key={p.key} className="ln-core" d={p.d} />
          ))}
        </g>

        {/* Routes */}
        <g className="ln-arcs">
          {geo.arcs.map((a) => (
            <path
              key={a.key}
              className={`ln-arc${lit ? (lit.arcs.has(a.key) ? ' on' : ' off') : ''}`}
              d={a.d}
              stroke={PATHWAY_COLOR[a.pathway as keyof typeof PATHWAY_COLOR]}
              strokeWidth={a.width}
              onClick={(e) => {
                e.stopPropagation();
                onSelect({ kind: 'flow', sourceId: a.sourceId, facilityId: a.facilityId });
              }}
            >
              <title>{`${Math.round(a.tonnes)} t moving on this route`}</title>
            </path>
          ))}
        </g>

        {/* Material in transit. One token per allocated route. */}
        <g className="ln-tokens" aria-hidden>
          {geo.arcs.map((a) => (
            <circle
              key={a.key}
              className={`ln-token${lit ? (lit.arcs.has(a.key) ? ' on' : ' off') : ''}`}
              r={a.tokenR}
              fill={PATHWAY_COLOR[a.pathway as keyof typeof PATHWAY_COLOR]}
              style={{
                offsetPath: `path('${a.d}')`,
                animationDuration: `${a.dur}s`,
                animationDelay: `${a.delay}s`,
              }}
            />
          ))}
        </g>

        {/* Sources */}
        <g className="ln-srcs">
          {geo.srcNodes.map((n) => (
            <rect
              key={n.s.id}
              className={`ln-src${n.placed ? '' : ' idle'}${
                lit ? (lit.srcs.has(n.s.id) ? ' on' : ' off') : ''
              }`}
              x={n.x - n.r}
              y={n.y - n.r}
              width={n.r * 2}
              height={n.r * 2}
              onClick={(e) => {
                e.stopPropagation();
                onSelect({ kind: 'source', id: n.s.id });
              }}
            >
              <title>{`${n.s.name} — ${Math.round(n.s.availableT)} t available`}</title>
            </rect>
          ))}
        </g>

        {/* Plants */}
        <g className="ln-facs">
          {geo.facNodes.map((n) => {
            const offline = offlineIds?.has(n.f.id);
            const on = lit ? lit.facs.has(n.f.id) : null;
            return (
              <g
                key={n.f.id}
                className={`ln-fac${offline ? ' offline' : ''}${
                  on === null ? '' : on ? ' on' : ' off'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect({ kind: 'facility', id: n.f.id });
                }}
              >
                {n.period > 0 && !offline && (
                  <circle
                    className="ln-pulse"
                    cx={n.x}
                    cy={n.y}
                    r={n.r}
                    stroke={PATHWAY_COLOR[n.f.pathway]}
                    style={{ animationDuration: `${n.period}s` }}
                  />
                )}
                <circle
                  className="ln-node"
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill={offline ? 'var(--neg)' : n.t > 0 ? PATHWAY_COLOR[n.f.pathway] : 'none'}
                  stroke={offline ? 'var(--neg)' : PATHWAY_COLOR[n.f.pathway]}
                />
                <title>
                  {offline
                    ? `${n.f.name} — offline in this scenario`
                    : `${n.f.name} — ${Math.round(n.t)} t received`}
                </title>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Clicking the ground clears the selection. */}
      <button className="ln-clear" onClick={() => onSelect(null)} aria-label="Clear selection" />
    </div>
  );
}
