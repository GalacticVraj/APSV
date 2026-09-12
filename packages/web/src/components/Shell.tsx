/**
 * Application shell: the terminal header and the section rail.
 *
 * The header is a status line, not a navigation bar. It carries the four things an
 * operator needs visible at all times — what the network state is, which objective
 * is active, when it was last solved, and whether anything is currently computing.
 */

import type { ReactNode } from 'react';
import { Link, useRouter } from '../router.tsx';
import { useTwin } from '../store.tsx';
import type { ObjectiveMode } from '../../../engine/src/types.ts';
import { dateFull, num, pct } from '../format.ts';

interface NavGroup {
  group: string;
  items: Array<{ to: string; label: string }>;
  /** rendered larger and first: the workspace's primary surface */
  primary?: boolean;
}

/**
 * Two workspaces, not one menu.
 *
 * A Carbon Manager's job is not a subset of network operations, and a rail that
 * lists both as peers makes the product feel like an admin tool with a carbon
 * section. Selecting CARBON makes the whole rail carbon-first: one command
 * surface, with the analytical modules beneath it as supporting capability.
 *
 * The structure is deliberately extensible — GENERATOR, FACILITY, ECONOMICS and
 * DIRECTOR workspaces slot in beside these without touching the shell.
 */
const WORKSPACES: Record<string, { label: string; tagline: string; nav: NavGroup[] }> = {
  carbon: {
    label: 'Carbon',
    tagline: 'Carbon Network',
    nav: [
      {
        group: 'Command',
        primary: true,
        items: [{ to: '/carbon', label: 'Carbon Command' }],
      },
      {
        group: 'Explore',
        items: [
          { to: '/carbon/impact', label: 'Impact' },
          { to: '/carbon/facilities', label: 'Network' },
          { to: '/carbon/pathways', label: 'Pathways' },
          { to: '/carbon/ledger', label: 'Trace' },
          { to: '/carbon/opportunities', label: 'Opportunities' },
          { to: '/carbon/scenarios', label: 'Scenarios' },
          { to: '/carbon/evidence', label: 'Evidence' },
          { to: '/carbon/report', label: 'Brief' },
        ],
      },
    ],
  },
  network: {
    label: 'Network',
    tagline: 'Operations',
    nav: [
      {
        group: 'Portals',
        items: [
          { to: '/', label: 'Landing' },
          { to: '/entry', label: 'Choose Persona' },
          { to: '/generator', label: 'Farmer Waste App' },
        ],
      },
      {
        group: 'Operations',
        items: [
          { to: '/overview', label: 'Overview' },
          { to: '/map', label: 'Network Map' },
          { to: '/activity', label: 'Network Activity' },
        ],
      },
      {
        group: 'Assets',
        items: [
          { to: '/sources', label: 'Waste Sources' },
          { to: '/facilities', label: 'Facilities' },
          { to: '/siting', label: 'Siting Screener' },
          { to: '/logistics', label: 'Logistics' },
        ],
      },
      {
        group: 'Intelligence',
        items: [
          { to: '/optimization', label: 'Optimization' },
          { to: '/scenarios', label: 'Scenarios' },
          { to: '/bottlenecks', label: 'Bottlenecks' },
          { to: '/copilot', label: 'Copilot' },
        ],
      },
      {
        group: 'Accounting',
        items: [
          { to: '/economics', label: 'Economics' },
          { to: '/system', label: 'System & Data' },
        ],
      },
    ],
  },
};

/** The workspace a path belongs to, so a deep link lands in the right rail. */
function workspaceFor(path: string): 'carbon' | 'network' {
  return path.startsWith('/carbon') ? 'carbon' : 'network';
}

export function Shell({ children, demoActive }: { children: ReactNode; demoActive: boolean }) {
  const { boot, state, optimization, busy, setObjective, reset } = useTwin();
  const { navigate, path } = useRouter();
  const workspace = workspaceFor(path);
  const ws = WORKSPACES[workspace];

  const objectives = boot?.reference.objectives ?? {};
  const current = state?.objective ?? 'balanced';
  const totals = optimization?.result.totals;
  const telemetry = optimization?.result.telemetry;
  const scenarioCount = state?.appliedScenarios.length ?? 0;

  return (
    <div className="shell" style={demoActive ? { paddingBottom: 96 } : undefined}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">TERRAFLUX</span>
          <span className="brand-sub">Circular Carbon Network</span>
        </div>

        <div className="topbar-div tb-region" />
        <div className="topbar-field tb-region">
          <span className="k">Region</span>
          <span className="v">{boot?.product.region ?? '—'}</span>
        </div>

        <div className="topbar-div tb-asof" />
        <div className="topbar-field tb-asof">
          <span className="k">As of</span>
          <span className="v">{state ? dateFull(state.asOf) : '—'}</span>
        </div>

        <div className="topbar-div tb-window" />
        <div className="topbar-field tb-window">
          <span className="k">Window</span>
          <span className="v">{state ? `${state.assumptions.windowDays} d` : '—'}</span>
        </div>

        <div className="topbar-div tb-diverted" />
        <div className="topbar-field tb-diverted">
          <span className="k">Diverted</span>
          <span className="v">
            {totals ? `${num(totals.divertedT)} t · ${pct(totals.divertedPct, 0)}` : '—'}
          </span>
        </div>

        <div className="topbar-div" />
        <div className="topbar-field">
          <span className="k">Solver</span>
          <span className="v">
            {busy ? (
              <span style={{ color: 'var(--green-300)' }}>computing…</span>
            ) : telemetry ? (
              `${telemetry.solveMs} ms · gap ${telemetry.gapPct.toFixed(2)}%`
            ) : (
              '—'
            )}
          </span>
        </div>

        {scenarioCount > 0 && (
          <>
            <div className="topbar-div" />
            <div className="topbar-field">
              <span className="k">Scenarios applied</span>
              <span className="v" style={{ color: '#e8b98a' }}>
                {scenarioCount}
              </span>
            </div>
          </>
        )}

        <div className="topbar-spacer" />

        <div className="objswitch" role="group" aria-label="Optimisation objective">
          {(Object.keys(objectives) as ObjectiveMode[]).map((k) => (
            <button
              key={k}
              aria-pressed={current === k}
              title={objectives[k].description}
              disabled={!!busy}
              onClick={() => setObjective(k)}
            >
              {objectives[k].short}
            </button>
          ))}
        </div>

        {scenarioCount > 0 && (
          <button className="topbtn" onClick={() => reset()} disabled={!!busy} title="Discard all applied scenarios and restore the baseline network">
            Reset
          </button>
        )}

        <button
          className="topbtn accent"
          onClick={() => navigate('/generator')}
          title="Open the Farmer Waste Generator module"
        >
          Farmer App 🌾
        </button>

        <button
          className="topbtn accent"
          onClick={() => navigate('/demo')}
          title="Run the guided three-minute walkthrough"
        >
          Demo
        </button>
      </header>

      <div className="body">
        <nav className="rail" aria-label="Sections">
          <div className="wsswitch" role="tablist" aria-label="Workspace">
            {(Object.keys(WORKSPACES) as Array<'carbon' | 'network'>).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={workspace === k}
                className={`wss-btn ${workspace === k ? 'on' : ''}`}
                onClick={() => navigate(k === 'carbon' ? '/carbon' : '/')}
              >
                {WORKSPACES[k].label}
              </button>
            ))}
          </div>
          <div className="ws-tagline">{ws.tagline}</div>

          {ws.nav.map((g) => (
            <div className={`rail-group ${g.primary ? 'primary' : ''}`} key={g.group}>
              {!g.primary && <div className="rail-group-label">{g.group}</div>}
              {g.items.map((it) => (
                <Link key={it.to} to={it.to}>
                  <span>{it.label}</span>
                  <RailBadge to={it.to} />
                </Link>
              ))}
            </div>
          ))}
          <div className="rail-foot">
            Synthetic demo data.
            <br />
            District coordinates are real.
            <br />
            Factors cited in System &amp; Data.
          </div>
        </nav>

        <main className="main">{children}</main>
      </div>
    </div>
  );
}

/** Small live counters in the rail, so the nav itself carries state. */
function RailBadge({ to }: { to: string }) {
  const { optimization, state } = useTwin();
  const r = optimization?.result;
  if (!r) return null;

  if (to === '/facilities') return <span className="badge">{r.openFacilities.length}</span>;
  if (to === '/sources') return <span className="badge">{state?.sources.length ?? 0}</span>;
  if (to === '/scenarios' && (state?.appliedScenarios.length ?? 0) > 0)
    return <span className="badge alert">{state?.appliedScenarios.length}</span>;
  if (to === '/optimization')
    return <span className="badge">{r.telemetry.solveMs}ms</span>;
  return null;
}
