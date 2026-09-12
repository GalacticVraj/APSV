/**
 * The front door.
 *
 * Four people arrive here and they are not the same person.
 *
 * A farmer with a phone and a field of paddy straw needs one answer: who takes
 * this and what does it pay. A plant manager needs to know what is running and
 * what is limiting the rest. A carbon manager needs the arithmetic, because his
 * number will be argued with. An economist needs the portfolio, because her
 * question is which tonnes to do first.
 *
 * So the four doors are not four interchangeable tiles. Reading left to right,
 * confidence falls and evidence rises:
 *
 *   decide FOR them  →  decide WITH them  →  let them decide
 *
 * The farmer card carries the fewest words and the biggest single figure. The
 * carbon and economics cards carry a method line the other two do not have,
 * because for those two readers the basis *is* the value proposition. What does
 * not change is the paint: same greens, same charcoal, same type everywhere. If
 * the farmer app and the carbon ledger looked like different companies, the
 * "one network, four seats at it" story falls apart in front of a judge.
 *
 * Every number on this page comes from the live solve. Nothing is typed in.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from '../router.tsx';
import { api, useResource, useTwin } from '../store.tsx';
import {
  CORE_PATHS,
  CONTEXT_PATHS,
  PROJ,
  VB_W,
  VB_H,
} from '../components/NetworkMap.tsx';
import { inr, num } from '../format.ts';
import '../styles/landing.css';

// ─────────────────────────────────────────────────────────────────────────────
// Reveal-on-scroll
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adds `.seen` once, the first time a section crosses into view. Once is the
 * point: a section that re-animates every time it scrolls past is a section the
 * reader learns to ignore.
 */
function useReveal<T extends HTMLElement>() {
  const io = useRef<IntersectionObserver | null>(null);

  // A callback ref, not useEffect. The page returns null until the first solve
  // arrives, so an effect with [] deps would run once against a ref that was
  // still null and never observe anything — the sections would sit at opacity 0
  // forever. A callback ref fires whenever the node actually attaches.
  return useCallback((el: T | null) => {
    if (!el) return;
    if (!io.current) {
      io.current = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add('seen');
              io.current?.unobserve(e.target);
            }
          }
        },
        { threshold: 0.16, rootMargin: '0px 0px -8% 0px' },
      );
    }
    // Anything already on screen when it mounts should be visible immediately,
    // not wait for a scroll event that may never come.
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('seen');
    else io.current.observe(el);
  }, []);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero map
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The region, laid back in 3D.
 *
 * Real district geometry and real coordinates — the same projection the Network
 * Map uses, imported rather than copied, so the front door can never drift from
 * the product behind it. The plane leans away from the reader so the region
 * reads as ground rather than as a chart.
 */
function HeroMap({
  sources,
  facilities,
  flows,
}: {
  sources: Array<{ x: number; y: number; r: number }>;
  facilities: Array<{ x: number; y: number }>;
  flows: string[];
}) {
  const planeRef = useRef<HTMLDivElement>(null);

  // A slow drift toward the pointer. Written straight to the transform, never
  // through state, so moving the mouse does not re-render the tree.
  useEffect(() => {
    const el = planeRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;

    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const tick = () => {
      cx += (tx - cx) * 0.045;
      cy += (ty - cy) * 0.045;
      // Baseline matches .lp-plane in landing.css — keep the two in step or the
      // map jumps the moment the pointer first moves.
      el.style.transform =
        `translate(-50%, -50%) rotateX(${58 - cy * 4}deg) rotateZ(${-7 + cx * 5}deg) scale(1)`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="lp-stage" aria-hidden="true">
      <div className="lp-plane" ref={planeRef}>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet">
          {CONTEXT_PATHS.map((p) => (
            <path key={p.key} className="lp-ctx" d={p.d} />
          ))}
          {CORE_PATHS.map((p) => (
            <path key={p.key} className="lp-core" d={p.d} />
          ))}

          {flows.map((d, i) => (
            <path
              key={i}
              className="lp-flow"
              d={d}
              style={{
                strokeWidth: 1.1,
                animationDelay: `${(i % 14) * 0.19}s`,
              }}
            />
          ))}

          {sources.map((s, i) => (
            <rect
              key={i}
              className="lp-src"
              x={s.x - s.r}
              y={s.y - s.r}
              width={s.r * 2}
              height={s.r * 2}
              style={{ animationDelay: `${(i % 22) * 0.24}s` }}
            />
          ))}

          {facilities.map((f, i) => (
            <g key={i}>
              <circle
                className="lp-fac-ring"
                cx={f.x}
                cy={f.y}
                r={5}
                style={{ animationDelay: `${(i % 9) * 0.37}s` }}
              />
              <circle className="lp-fac" cx={f.x} cy={f.y} r={3.1} />
            </g>
          ))}
        </svg>
      </div>
      <div className="lp-horizon" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Role cards
// ─────────────────────────────────────────────────────────────────────────────

interface Role {
  id: string;
  title: string;
  sub: string;
  owner: string;
  /** what this reader is promised, in their own register */
  body: string;
  stat: string;
  statLabel: string;
  /** only the two analytical doors carry a basis line — see the file header */
  method?: string;
  route: string;
  icon: JSX.Element;
}

/**
 * A card that leans toward the pointer.
 *
 * Rotation and the light position are written as custom properties on the
 * element itself. React is not involved in the movement at all — a state update
 * per pointermove would re-render four cards sixty times a second to move a
 * shadow.
 */
function RoleCard({ role, delay, onGo }: { role: Role; delay: number; onGo: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);

  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--ry', `${(px - 0.5) * 9}deg`);
    el.style.setProperty('--rx', `${(0.5 - py) * 9}deg`);
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
  };

  const reset = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--rx', '0deg');
  };

  return (
    <button
      ref={ref}
      className="lp-role"
      style={{ ['--d' as string]: `${delay}ms` }}
      onPointerMove={onMove}
      onPointerLeave={reset}
      onClick={onGo}
      aria-label={`Enter ${role.title} — ${role.sub}`}
    >
      <span className="lp-role-owner">{role.owner}</span>
      <span className="lp-role-top">
        <span className="lp-role-icon">{role.icon}</span>
        <h3>{role.title}</h3>
        <div className="lp-role-sub">{role.sub}</div>
      </span>
      <span className="lp-role-body">
        <p>{role.body}</p>
        <div className="lp-role-stat">
          {role.stat}
          <small>{role.statLabel}</small>
        </div>
        {role.method && <p style={{ marginTop: 14, fontSize: 11.5, color: '#7d8884' }}>{role.method}</p>}
        <div className="lp-role-go">
          Enter <span>→</span>
        </div>
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons — one stroke weight, one language, four subjects
// ─────────────────────────────────────────────────────────────────────────────

const ICON = {
  stroke: { fill: 'none', stroke: '#1d6b4c', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const },
};

const IconFarmer = (
  <svg viewBox="0 0 48 48" {...ICON.stroke}>
    <path d="M8 38h32" />
    <path d="M14 38V26c0-5 4-9 10-9s10 4 10 9v12" />
    <path d="M24 17V9" />
    <path d="M24 12c-3-3-7-3-9-1 2 3 6 4 9 1Z" />
    <path d="M24 12c3-3 7-3 9-1-2 3-6 4-9 1Z" />
  </svg>
);

const IconFacility = (
  <svg viewBox="0 0 48 48" {...ICON.stroke}>
    <path d="M7 39h34" />
    <path d="M11 39V21l9 6v-6l9 6V15l9 5v19" />
    <path d="M17 39v-6h5v6" />
    <path d="M31 27v3" />
  </svg>
);

const IconCarbon = (
  <svg viewBox="0 0 48 48" {...ICON.stroke}>
    <circle cx="24" cy="24" r="13" />
    <path d="M24 11v26" />
    <path d="M11 24h26" />
    <path d="M18 18c4 3 8 3 12 0" />
    <path d="M18 30c4-3 8-3 12 0" />
  </svg>
);

const IconEconomics = (
  <svg viewBox="0 0 48 48" {...ICON.stroke}>
    <path d="M8 38h32" />
    <path d="M13 38V28" />
    <path d="M21 38V20" />
    <path d="M29 38V25" />
    <path d="M37 38V13" />
    <path d="M11 22l9-8 7 5 10-9" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function Landing() {
  const { navigate } = useRouter();
  const { boot, state, optimization, version } = useTwin();
  const carbon = useResource(() => api.carbon(), [version], ['Reading the carbon ledger…']);

  const [pastHero, setPastHero] = useState(false);
  const progRef = useRef<HTMLDivElement>(null);

  // Progress bar and the brand's colour flip, in one rAF-throttled listener.
  useEffect(() => {
    let raf = 0;
    let queued = false;
    const read = () => {
      queued = false;
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const p = max > 0 ? h.scrollTop / max : 0;
      if (progRef.current) progRef.current.style.transform = `scaleX(${p})`;
      setPastHero(h.scrollTop > h.clientHeight * 0.72);
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const actProblem = useReveal<HTMLElement>();
  const actChain = useReveal<HTMLElement>();
  const actRoles = useReveal<HTMLElement>();

  // Project the real network onto the hero plane.
  const geo = useMemo(() => {
    if (!state || !optimization) return { sources: [], facilities: [], flows: [] };

    const maxT = Math.max(...state.sources.map((s) => s.availableT), 1);
    const sources = state.sources.map((s) => ({
      x: PROJ.x(s.lon),
      y: PROJ.y(s.lat),
      r: 1.6 + (s.availableT / maxT) * 3.2,
    }));

    const byId = new Map(state.facilities.map((f) => [f.id, f]));
    const facilities = optimization.result.openFacilities
      .map((id) => byId.get(id))
      .filter((f): f is NonNullable<typeof f> => !!f)
      .map((f) => ({ x: PROJ.x(f.lon), y: PROJ.y(f.lat) }));

    const srcById = new Map(state.sources.map((s) => [s.id, s]));
    const flows: string[] = [];
    for (const a of optimization.result.allocations) {
      const s = srcById.get(a.sourceId);
      const f = byId.get(a.facilityId);
      if (!s || !f) continue;
      const x1 = PROJ.x(s.lon);
      const y1 = PROJ.y(s.lat);
      const x2 = PROJ.x(f.lon);
      const y2 = PROJ.y(f.lat);
      // Bow consistently, the same way the Network Map does, so the flows fan
      // instead of tangling where many arrive at one plant.
      const mx = (x1 + x2) / 2 + (y2 - y1) * 0.14;
      const my = (y1 + y2) / 2 - (x2 - x1) * 0.14;
      flows.push(`M${x1.toFixed(1)} ${y1.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`);
    }
    return { sources, facilities, flows };
  }, [state, optimization]);

  const T = optimization?.result.totals;
  const netT = carbon.data?.ledger.netT;

  // The paddy-straw window, straight out of the engine's crop calendar. This is
  // the whole reason the product exists, so it is drawn, not asserted.
  const season = useMemo(() => {
    const s = boot?.reference.season?.paddy_straw as
      | { peakWeek: number; widthWeeks: number; baseline: number }
      | undefined;
    if (!s) return [];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return MONTHS.map((m, i) => {
      const week = i * 4.345 + 2;
      const d = week - s.peakWeek;
      const g = Math.exp(-(d * d) / (2 * s.widthWeeks * s.widthWeeks));
      const f = s.baseline + (1 - s.baseline) * g;
      return { m, f, peak: Math.abs(d) <= s.widthWeeks };
    });
  }, [boot]);

  if (!state || !optimization || !T) return null;

  const roles: Role[] = [
    {
      id: 'generator',
      title: 'Waste Generator',
      sub: 'Farmer · Mandi · Mill',
      owner: 'Sukruti',
      body: 'Tell us what you have and where. We tell you who collects it, when, and what it pays. Four languages, works on one bar of signal.',
      stat: `${num(T.suppliedT)} t`,
      statLabel: 'offered across 42 collection points',
      route: '/generator',
      icon: IconFarmer,
    },
    {
      id: 'facility',
      title: 'Facility',
      sub: 'Plant Operations',
      owner: 'Aditya',
      body: 'What is running, what is full, and what is holding the rest back. Open a plant to see its feedstock, its headroom and where the next tonne should go.',
      stat: `${optimization.result.openFacilities.length} / ${state.facilities.length}`,
      statLabel: 'plants operating this window',
      route: '/facilities',
      icon: IconFacility,
    },
    {
      id: 'carbon',
      title: 'Carbon',
      sub: 'Ledger · Permanence · Evidence',
      owner: 'Vraj',
      body: 'The net atmospheric effect of the plan in force, and the arithmetic that produces it. Every term opens into the tonnes, the factor and the citation behind it.',
      stat: netT != null ? `${num(netT)} tCO₂e` : '—',
      statLabel: 'net, current planning window',
      method: 'Removal, avoidance and substitution kept apart. Permanence modelled to 100 years, not claimed.',
      route: '/carbon',
      icon: IconCarbon,
    },
    {
      id: 'economics',
      title: 'Economics',
      sub: 'Margin · Abatement · Investment',
      owner: 'Preetansh',
      body: 'Which tonnes to do first. The abatement curve puts every flow in order, and everything left of the zero line pays for itself before any carbon price.',
      stat: inr(T.marginInr),
      statLabel: `operating margin · ${inr(T.marginPerTonneInr)}/t`,
      method: 'Marginal abatement cost per flow, from the same solve the other three screens read.',
      route: '/economics',
      icon: IconEconomics,
    },
  ];

  const CHAIN = [
    {
      n: '01',
      h: 'It is offered',
      p: 'A farmer has paddy straw and twenty days before wheat sowing. Burning is the default because it is free and fast.',
      v: `${num(T.suppliedT)} t`,
      vl: 'offered this window',
    },
    {
      n: '02',
      h: 'It is routed',
      p: 'The solver matches every tonne to a plant that can take it, against distance, capacity and what the plant pays.',
      v: `${num(T.divertedT)} t`,
      vl: `moved · ${T.divertedPct.toFixed(0)}% of supply`,
    },
    {
      n: '03',
      h: 'It is converted',
      p: 'Pyrolysis, digestion, pellets, compost or gasification — whichever the material and the market actually favour.',
      v: `${optimization.result.openFacilities.length}`,
      vl: 'plants running',
    },
    {
      n: '04',
      h: 'It is accounted',
      p: 'Carbon fixed in char, emissions avoided, fossil fuel displaced — recorded separately, never summed into one flattering figure.',
      v: netT != null ? `${num(netT)}` : '—',
      vl: 'tCO₂e net',
    },
  ];

  return (
    <div className={`lp${pastHero ? ' past-hero' : ''}`}>
      <div className="lp-prog" ref={progRef} style={{ width: '100%' }} />

      <div className="lp-top">
        <div className="lp-mark">
          TERRAFLUX
          <span>Circular Carbon Network</span>
        </div>
        <button className="lp-skip" onClick={() => navigate('/overview')}>
          Skip to Control Tower
        </button>
      </div>

      {/* ── Act 1 ─────────────────────────────────────────────────────────── */}
      <section className="lp-hero">
        <HeroMap sources={geo.sources} facilities={geo.facilities} flows={geo.flows} />

        <div className="lp-hero-copy">
          <div className="lp-eyebrow">Punjab · Haryana · Chandigarh</div>
          <h1 className="lp-title">
            {'TERRAFLUX'.split('').map((c, i) => (
              <span key={i} className="lp-ch" style={{ animationDelay: `${140 + i * 55}ms` }}>
                {c}
              </span>
            ))}
          </h1>
          <p className="lp-sub">
            An operating system for turning crop residue into carbon. One network, four
            seats at it — the farmer who has the straw, the plant that takes it, the
            manager who accounts for it, and the desk that decides what it is worth.
          </p>

          <div className="lp-live">
            <div>
              <b>{num(T.divertedT)} t</b>
              <i>Residue routed</i>
            </div>
            <div>
              <b>{netT != null ? num(netT) : '—'}</b>
              <i>tCO₂e net</i>
            </div>
            <div>
              <b>{optimization.result.openFacilities.length}</b>
              <i>Plants running</i>
            </div>
            <div>
              <b>{optimization.result.telemetry?.solveMs ?? '—'} ms</b>
              <i>Last solve</i>
            </div>
          </div>
        </div>

        <div className="lp-cue">Scroll</div>
      </section>

      {/* ── Act 2 ─────────────────────────────────────────────────────────── */}
      <section className="lp-act lp-dark lp-rise" ref={actProblem}>
        <div className="lp-in lp-split">
          <div>
            <div className="lp-kicker">The twenty-day window</div>
            <h2 className="lp-h">Burning is not ignorance. It is arithmetic.</h2>
            <p className="lp-p">
              Paddy comes off the field in mid-October. Wheat has to be sown by mid-November.
              In between sits about twenty days and several tonnes an acre of straw with no
              buyer, no store and no time. Fire is free and it takes an afternoon.
            </p>
            <p className="lp-p">
              Anything that replaces it has to beat that on the farmer's terms — collected on
              time, paid for on the spot. That is the constraint this whole network is built
              around, and it is why the front of it is a phone app in four languages rather
              than a dashboard.
            </p>
          </div>

          <div className="lp-season">
            {season.map((s) => (
              <div key={s.m} className={`lp-mo${s.peak ? ' peak' : ''}`}>
                <span>{s.m}</span>
                <span className="lp-bar">
                  <i style={{ ['--f' as string]: s.f.toFixed(3) }} />
                </span>
                <b>{(s.f * 100).toFixed(0)}%</b>
              </div>
            ))}
            <p style={{ fontSize: 11, color: 'rgba(244,241,232,0.42)', marginTop: 10, lineHeight: 1.6 }}>
              Paddy straw availability by month, from the crop calendar the engine solves
              against. Peak weeks shown in amber.
            </p>
          </div>
        </div>
      </section>

      {/* ── Act 3 ─────────────────────────────────────────────────────────── */}
      <section className="lp-act lp-rise" ref={actChain}>
        <div className="lp-in">
          <div className="lp-kicker">What actually happens to a tonne</div>
          <h2 className="lp-h">Four steps, and a number at every one.</h2>
          <p className="lp-p">
            These are not illustrations. Each figure below is read from the solve running
            behind this page right now, on a thirty-day planning window.
          </p>

          <div className="lp-chain">
            {CHAIN.map((s, i) => (
              <div key={s.n} className="lp-step" style={{ ['--d' as string]: `${i * 110}ms` }}>
                <div className="lp-step-n">{s.n}</div>
                <h4>{s.h}</h4>
                <p>{s.p}</p>
                <div className="lp-step-v">
                  {s.v}
                  <small>{s.vl}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Act 4 ─────────────────────────────────────────────────────────── */}
      <section className="lp-act lp-roles lp-rise" ref={actRoles}>
        <div className="lp-in">
          <div className="lp-kicker">Choose your seat</div>
          <h2 className="lp-h">Same network. Four very different jobs.</h2>
          <p className="lp-p">
            Each door opens on the same solve, shown at the depth that job needs. The farmer
            gets one answer. The analyst gets the working.
          </p>

          <div className="lp-grid">
            {roles.map((r, i) => (
              <RoleCard key={r.id} role={r} delay={i * 120} onGo={() => navigate(r.route)} />
            ))}
          </div>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-in">
          <div>
            <b>TERRAFLUX</b>
            <p>
              Circular Carbon Network Operating System. Built for HackOut'26, PS11 —
              waste-to-carbon value chain across Punjab, Haryana and Chandigarh.
            </p>
          </div>
          <div>
            <p style={{ maxWidth: '44ch' }}>
              All demo data is synthetic. District coordinates are real. Emission factors and
              prices are cited from published sources on the{' '}
              <a href="/system" onClick={(e) => { e.preventDefault(); navigate('/system'); }}>
                System &amp; Data
              </a>{' '}
              screen, together with what this model cannot do.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
