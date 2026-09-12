/**
 * Carbon Command — the Carbon Manager's workspace.
 *
 * Everything a carbon manager needs to begin work is on one surface, in the order
 * the job is actually done: what the position is, where it is happening, what
 * needs attention, and what can be done about it. The eight analytical modules
 * are still there, but they are supporting capability reached from here rather
 * than a menu the reader has to understand first.
 *
 * Three rules this screen keeps:
 *
 *  1. **One dominant idea per level.** The position, then the network, then the
 *     decisions. No grid of equal cards — a card grid is what you build when you
 *     have not decided what matters.
 *  2. **Depth is optional.** Level 1 is four numbers and a map. "Why this number"
 *     opens the decomposition; that opens the Ledger; that opens Evidence. Nothing
 *     technical appears until it is asked for.
 *  3. **Nothing is computed here.** Every figure comes from `/api/brief`, which
 *     composes the modules that own them. The map draws the real allocation set.
 *     The pulse is the twin's own event log, not a generated ticker.
 *
 * "Optimise for carbon" is a real mutation: it re-solves the live twin under the
 * carbon-first objective and reports the measured difference. Everything else is
 * read-only or hands off to the module that owns the action.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, useResource, useTwin } from '../store.tsx';
import { ErrorState, Loading } from '../components/Primitives.tsx';
import { NetworkMap, type Selection } from '../components/NetworkMap.tsx';
import { Link, useRouter } from '../router.tsx';
import { dateFull, inr, num, pct, timeShort } from '../format.ts';
import type { AllocationTrace, TraceCandidate } from '../../../engine/src/trace.ts';
import type { CarbonBrief } from '../../../engine/src/brief.ts';

type Overlay = null | 'why' | 'follow';

export default function CarbonCommand() {
  const { boot, state, optimization, version, setObjective, busy } = useTwin();
  const { navigate } = useRouter();

  const brief = useResource(() => api.brief(), [version], [
    'Reading the carbon position…',
    'Collecting opportunities and contingencies…',
  ]);

  const [overlay, setOverlay] = useState<Overlay>(null);
  const [selection, setSelection] = useState<Selection>(null);

  /** Before/after of a live re-optimisation, held so the result can be shown. */
  const [optimised, setOptimised] = useState<{ beforeT: number; beforeObjective: string } | null>(
    null,
  );
  const [optimiseResult, setOptimiseResult] = useState<{
    deltaT: number;
    fromLabel: string;
  } | null>(null);

  const b = brief.data;

  // When the twin re-solves after an objective change, read the new position and
  // report the measured difference. The delta is two real ledger figures.
  useEffect(() => {
    if (!optimised || !b) return;
    if (b.objective === optimised.beforeObjective) return;
    setOptimiseResult({
      deltaT: b.position.netT - optimised.beforeT,
      fromLabel: optimised.beforeObjective.replace(/_/g, ' '),
    });
    setOptimised(null);
  }, [b, optimised]);

  const optimiseForCarbon = useCallback(async () => {
    if (!b || b.objective === 'carbon_first') return;
    setOptimiseResult(null);
    setOptimised({ beforeT: b.position.netT, beforeObjective: b.objective });
    await setObjective('carbon_first');
  }, [b, setObjective]);

  if (!boot || !state) return <Loading message="Loading…" />;
  if (brief.loading) return <Loading message={brief.message} />;
  if (brief.error) return <ErrorState message={brief.error} onRetry={brief.reload} />;
  if (!b) return null;

  const allocations = optimization?.result.allocations ?? [];

  return (
    <div className="cmd">
      <Masthead b={b} state={state} />

      <Position
        b={b}
        onWhy={() => setOverlay('why')}
        optimiseResult={optimiseResult}
        onDismissResult={() => setOptimiseResult(null)}
      />

      <LiveNetwork
        sources={boot.network.sources}
        facilities={boot.network.facilities}
        allocations={allocations}
        selection={selection}
        onSelect={setSelection}
        b={b}
      />

      <Decisions
        b={b}
        busy={busy !== null}
        onOptimise={optimiseForCarbon}
        onFollow={() => setOverlay('follow')}
        onSimulate={() =>
          b.risk &&
          navigate(
            `/carbon/scenarios?${new URLSearchParams({
              kind: b.risk.scenario.kind,
              ...Object.fromEntries(
                Object.entries(b.risk.scenario.params).map(([k, v]) => [k, String(v)]),
              ),
            }).toString()}`,
          )
        }
      />

      <Pulse events={state.events ?? []} />

      {overlay === 'why' && <WhyPanel b={b} onClose={() => setOverlay(null)} />}
      {overlay === 'follow' && (
        <FollowPanel version={version} onClose={() => setOverlay(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Masthead({
  b,
  state,
}: {
  b: CarbonBrief;
  state: NonNullable<ReturnType<typeof useTwin>['state']>;
}) {
  const scenarios = state.appliedScenarios.length;
  return (
    <header className="cmd-mast">
      <div>
        <div className="cmd-role">Carbon Control</div>
        <h1>Carbon Network</h1>
      </div>
      <dl className="cmd-status">
        <div>
          <dt>Planning window</dt>
          <dd>
            {b.windowDays} days to {dateFull(b.asOf)}
          </dd>
        </div>
        <div>
          <dt>Objective</dt>
          <dd className="cmd-obj">{b.objectiveLabel}</dd>
        </div>
        <div>
          <dt>Network</dt>
          <dd>
            <span className="cmd-live" aria-hidden /> Operational
            {scenarios > 0 && <span className="cmd-scen"> · {scenarios} applied</span>}
          </dd>
        </div>
      </dl>
    </header>
  );
}

function Position({
  b,
  onWhy,
  optimiseResult,
  onDismissResult,
}: {
  b: CarbonBrief;
  onWhy: () => void;
  optimiseResult: { deltaT: number; fromLabel: string } | null;
  onDismissResult: () => void;
}) {
  const t = b.trend;
  return (
    <section className="cmd-pos">
      <div className="cp-label">Net carbon position</div>
      <div className="cp-row">
        <div className="cp-value">
          {b.position.netT >= 0 ? '+' : '−'}
          {num(Math.abs(b.position.netT))}
          <span className="cp-unit">tCO₂e</span>
        </div>
        {t && (
          <div className={`cp-trend ${t.improving ? 'pos' : 'neg'}`}>
            {t.improving ? '↑' : '↓'} {pct(Math.abs(t.deltaPct), 1)}
            <span className="cp-trend-sub">vs previous {t.weeks}-week period</span>
          </div>
        )}
        <button className="cp-why" onClick={onWhy}>
          Why this number?
        </button>
      </div>

      {optimiseResult && (
        <div className={`cp-optres ${optimiseResult.deltaT >= 0 ? 'pos' : 'neg'}`}>
          <strong>
            Network re-solved on Carbon First — {optimiseResult.deltaT >= 0 ? '+' : '−'}
            {num(Math.abs(optimiseResult.deltaT))} tCO₂e
          </strong>
          <span>
            The optimiser reallocated material from the {optimiseResult.fromLabel} plan. The map
            below now shows the new routing.
          </span>
          <button onClick={onDismissResult} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * The signature visual: the real network, drawn from the real allocation set.
 *
 * Arcs redraw when the plan changes, which is where the "live" feeling comes from
 * — it is the optimiser's own output moving, not an animation loop. Selecting an
 * element opens the module that owns it rather than a tooltip.
 */
function LiveNetwork({
  sources,
  facilities,
  allocations,
  selection,
  onSelect,
  b,
}: {
  sources: NonNullable<ReturnType<typeof useTwin>['boot']>['network']['sources'];
  facilities: NonNullable<ReturnType<typeof useTwin>['boot']>['network']['facilities'];
  allocations: AllocationTrace['allocation'][];
  selection: Selection;
  onSelect: (s: Selection) => void;
  b: CarbonBrief;
}) {
  const selected = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === 'facility') {
      const f = facilities.find((x) => x.id === selection.id);
      return f ? { title: f.name, sub: f.district, to: '/carbon/facilities', cta: 'Facility carbon' } : null;
    }
    if (selection.kind === 'source') {
      const s = sources.find((x) => x.id === selection.id);
      return s ? { title: s.name, sub: s.district, to: '/carbon/pathways', cta: 'Compare pathways' } : null;
    }
    const s = sources.find((x) => x.id === selection.sourceId);
    const f = facilities.find((x) => x.id === selection.facilityId);
    return {
      title: `${s?.name ?? selection.sourceId} → ${f?.name ?? selection.facilityId}`,
      sub: 'One allocation in the current plan',
      to: `/carbon/ledger?source=${encodeURIComponent(selection.sourceId)}&facility=${encodeURIComponent(selection.facilityId)}`,
      cta: 'Trace this carbon',
    };
  }, [selection, sources, facilities]);

  return (
    <section className="cmd-net">
      <div className="cn-head">
        <span className="cn-title">Live carbon network</span>
        <span className="cn-sub">
          {num(sources.length)} sources · {num(facilities.length)} plants ·{' '}
          {num(allocations.length)} active flows · {num(b.position.divertedT)} t moving
        </span>
        <Link to="/carbon/facilities" className="cn-link">
          Open network
        </Link>
      </div>

      <div className="cn-canvas">
        <NetworkMap
          sources={sources}
          facilities={facilities}
          allocations={allocations}
          selection={selection}
          onSelect={onSelect}
          showLegend={false}
          showLabels
        />
      </div>

      <div className="cn-foot">
        {selected ? (
          <>
            <span className="cn-selname">{selected.title}</span>
            <span className="cn-selsub">{selected.sub}</span>
            <Link to={selected.to} className="btn sm primary">
              {selected.cta}
            </Link>
            <button className="btn sm" onClick={() => onSelect(null)}>
              Clear
            </button>
          </>
        ) : (
          <span className="cn-hint">
            Select a plant, a source or a flow to open its carbon detail. Arcs redraw whenever the
            optimiser produces a different plan.
          </span>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Decisions({
  b,
  busy,
  onOptimise,
  onFollow,
  onSimulate,
}: {
  b: CarbonBrief;
  busy: boolean;
  onOptimise: () => void;
  onFollow: () => void;
  onSimulate: () => void;
}) {
  const alreadyCarbon = b.objective === 'carbon_first';

  return (
    <section className="cmd-dec">
      <div className="cd-attention">
        <div className="cd-head">Needs attention</div>

        {b.action ? (
          <Link to="/carbon/opportunities" className="cd-item pos">
            <span className="cd-fig">+{num(b.action.carbonDeltaT)}</span>
            <span className="cd-unit">tCO₂e</span>
            <span className="cd-what">Best evaluated opportunity</span>
            <span className="cd-detail">{b.action.headline}</span>
          </Link>
        ) : (
          <div className="cd-item muted">
            <span className="cd-what">No improving change found</span>
          </div>
        )}

        {b.risk && (
          <Link to="/carbon/scenarios" className="cd-item neg">
            <span className="cd-fig">{num(b.risk.carbonDeltaT)}</span>
            <span className="cd-unit">tCO₂e</span>
            <span className="cd-what">Largest resilience risk</span>
            <span className="cd-detail">
              {b.risk.facilityName} offline · {pct(b.risk.carbonLossPct, 1)} of network carbon
            </span>
          </Link>
        )}

        {b.position.strandedT > 1 && (
          <Link to="/carbon/facilities" className="cd-item warn">
            <span className="cd-fig">{num(b.position.strandedT)}</span>
            <span className="cd-unit">t</span>
            <span className="cd-what">Material still unplaced</span>
            <span className="cd-detail">
              No feasible destination under the current estate and objective
            </span>
          </Link>
        )}
      </div>

      <div className="cd-actions">
        <div className="cd-head">Act</div>
        <button
          className="cd-btn primary"
          onClick={onOptimise}
          disabled={busy || alreadyCarbon}
          title={alreadyCarbon ? 'The network is already solved on Carbon First' : undefined}
        >
          <span className="cdb-main">Optimise for carbon</span>
          <span className="cdb-sub">
            {alreadyCarbon
              ? 'Already solved on Carbon First'
              : 'Re-solve the live network on the carbon objective'}
          </span>
        </button>

        <button className="cd-btn" onClick={onSimulate} disabled={!b.risk}>
          <span className="cdb-main">Simulate a shock</span>
          <span className="cdb-sub">
            {b.risk ? `Take ${b.risk.facilityName} offline and re-solve` : 'No contingency available'}
          </span>
        </button>

        <button className="cd-btn" onClick={onFollow}>
          <span className="cdb-main">Follow a tonne</span>
          <span className="cdb-sub">Trace material from field to carbon outcome</span>
        </button>

        <Link to="/carbon/report" className="cd-btn">
          <span className="cdb-main">Open the brief</span>
          <span className="cdb-sub">The full position, in one page</span>
        </Link>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/** The twin's own event log. Not a ticker — these are recorded, timestamped events. */
function Pulse({
  events,
}: {
  events: Array<{ id: string; ts: string; kind: string; title: string; detail: string }>;
}) {
  if (events.length === 0) return null;
  return (
    <section className="cmd-pulse">
      <span className="cpul-label">Network activity</span>
      <div className="cpul-track">
        {events.slice(0, 6).map((e) => (
          <span key={e.id} className={`cpul-item k-${e.kind}`}>
            <span className="cpul-ts mono">{timeShort(e.ts)}</span>
            <span className="cpul-title">{e.title}</span>
          </span>
        ))}
      </div>
      <Link to="/activity" className="cpul-more">
        All activity
      </Link>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlays — depth on request, never on arrival
// ─────────────────────────────────────────────────────────────────────────────

function WhyPanel({ b, onClose }: { b: CarbonBrief; onClose: () => void }) {
  const p = b.position;
  const rows = [
    { k: 'Durable removal', v: p.removalT, op: '+' },
    { k: 'Avoided disposal', v: p.avoidedT, op: '+' },
    { k: 'Fossil displacement', v: p.substitutionT, op: '+' },
    { k: 'Transport emissions', v: -p.transportT, op: '−' },
    { k: 'Processing emissions', v: -p.processT, op: '−' },
  ].filter((r) => Math.abs(r.v) > 1e-6);
  const max = Math.max(...rows.map((r) => Math.abs(r.v)), 1);

  return (
    <Drawer title="Why this number?" onClose={onClose}>
      <p className="dr-lead">
        The position is the sum of five terms. Removal, avoidance and displacement are kept apart —
        they are different commodities and this product never adds them into one figure.
      </p>
      <div className="dr-decomp">
        {rows.map((r) => (
          <div key={r.k} className="drd-row">
            <span className="drd-op">{r.op}</span>
            <span className="drd-label">{r.k}</span>
            <span className="drd-track">
              <span
                className={`drd-fill ${r.v >= 0 ? 'pos' : 'neg'}`}
                style={{ width: `${(Math.abs(r.v) / max) * 100}%` }}
              />
            </span>
            <span className={`drd-val mono ${r.v >= 0 ? 'pos' : 'neg'}`}>{num(Math.abs(r.v))}</span>
          </div>
        ))}
        <div className="drd-row drd-net">
          <span className="drd-op">=</span>
          <span className="drd-label">Net carbon</span>
          <span className="drd-track" />
          <span className="drd-val mono">{num(p.netT)}</span>
        </div>
      </div>
      {p.uncertainty && (
        <p className="dr-note">
          <span className="mono">
            {num(p.uncertainty.p5)}–{num(p.uncertainty.p95)}
          </span>{' '}
          across {num(p.uncertainty.draws)} Monte Carlo draws over every emission factor at once.
        </p>
      )}
      <div className="dr-cta">
        <Link to="/carbon/ledger" className="btn sm primary">
          Open the Ledger
        </Link>
        <Link to="/carbon/evidence" className="btn sm">
          Inspect evidence
        </Link>
      </div>
      <div className="dr-foot">
        <span className="q-tag">Modelled estimate</span>
        Not measured, not verified, and not a carbon credit.
      </div>
    </Drawer>
  );
}

/**
 * Follow a tonne: pick a real allocation, watch it become carbon.
 *
 * Reuses the Ledger's trace endpoint verbatim; the stages, figures and wording
 * are the engine's. The drawer is a shortcut into that experience, not a copy.
 */
function FollowPanel({ version, onClose }: { version: number; onClose: () => void }) {
  const cands = useResource(() => api.traceCandidates(), [version], ['Ranking contributions…']);
  const [picked, setPicked] = useState<TraceCandidate | null>(null);
  const [trace, setTrace] = useState<AllocationTrace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearInterval(timer.current);
    if (!trace) {
      setRevealed(0);
      return;
    }
    setRevealed(0);
    const total = trace.stages.length;
    timer.current = window.setInterval(() => {
      setRevealed((r) => {
        if (r >= total) {
          if (timer.current) window.clearInterval(timer.current);
          return r;
        }
        return r + 1;
      });
    }, 230);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [trace]);

  const pick = async (c: TraceCandidate) => {
    setPicked(c);
    setTrace(null);
    setError(null);
    try {
      setTrace(await api.trace(c.sourceId, c.facilityId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That contribution could not be traced.');
    }
  };

  const running = trace
    ? trace.stages.slice(0, revealed).reduce((a, s) => a + (s.carbonT ?? 0), 0)
    : 0;

  return (
    <Drawer title="Follow a tonne" onClose={onClose} wide>
      {!picked && (
        <>
          <p className="dr-lead">
            Pick a consignment in the current plan. It will be followed through collection,
            haulage, the receiving plant and conversion, with the carbon booked at the stage that
            physically causes it.
          </p>
          {cands.loading && <p className="muted">{cands.message}</p>}
          <div className="dr-cands">
            {(cands.data ?? []).slice(0, 8).map((c) => (
              <button key={c.key} className="drc-item" onClick={() => pick(c)}>
                <span className="drc-src">{c.sourceName}</span>
                <span className="drc-sub">
                  {c.streamLabel} → {c.facilityName}
                </span>
                <span className="drc-t mono">{num(c.tonnes)} t</span>
                <span className="drc-c mono pos">{num(c.netCarbonT)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {picked && (
        <>
          <div className="dr-tracehead">
            <div>
              <div className="drt-title">
                {num(picked.tonnes)} t {picked.streamLabel.toLowerCase()}
              </div>
              <div className="drt-sub">
                {picked.sourceName} → {picked.facilityName} · {picked.pathwayLabel}
              </div>
            </div>
            <div className="drt-run">
              <span className="drt-runlabel">Running total</span>
              <span className={`drt-runval mono ${running >= 0 ? 'pos' : 'neg'}`}>
                {running >= 0 ? '+' : '−'}
                {num(Math.abs(running))}
              </span>
            </div>
          </div>

          {error && <p className="neg">{error}</p>}
          {!error && !trace && <p className="muted">Tracing…</p>}

          {trace && (
            <>
              <ol className="dr-stages">
                {trace.stages.map((s, i) => (
                  <li
                    key={s.key}
                    className={`drs ${i < revealed ? 'on' : ''} ${s.kind ? `k-${s.kind}` : ''}`}
                  >
                    <span className="drs-rail" aria-hidden>
                      <span className="drs-dot" />
                    </span>
                    <span className="drs-body">
                      <span className="drs-label">{s.label}</span>
                      <span className="drs-head">{s.headline}</span>
                      <span className="drs-detail">{s.detail}</span>
                    </span>
                    <span className="drs-c">
                      {s.carbonT === null ? (
                        <span className="drs-none">—</span>
                      ) : (
                        <span className={`mono ${s.carbonT >= 0 ? 'pos' : 'neg'}`}>
                          {s.carbonT >= 0 ? '+' : '−'}
                          {num(Math.abs(s.carbonT))}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="dr-note">{trace.why}</p>
              <div className="dr-cta">
                <Link
                  to={`/carbon/ledger?source=${encodeURIComponent(picked.sourceId)}&facility=${encodeURIComponent(picked.facilityId)}`}
                  className="btn sm primary"
                >
                  Open full trace
                </Link>
                <button className="btn sm" onClick={() => setPicked(null)}>
                  Follow another
                </button>
              </div>
            </>
          )}
        </>
      )}
    </Drawer>
  );
}

function Drawer({
  title,
  onClose,
  wide,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  // Escape closes, because a drawer that traps the reader is worse than a page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="dr-scrim" onClick={onClose} aria-hidden />
      <aside className={`drawer ${wide ? 'wide' : ''}`} role="dialog" aria-label={title}>
        <header className="dr-head">
          <h2>{title}</h2>
          <button className="dr-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="dr-body">{children}</div>
      </aside>
    </>
  );
}
