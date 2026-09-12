/**
 * Carbon Ledger — the trust surface.
 *
 * Carbon Home answers "how much". This screen answers "where exactly did that
 * number come from", and it has to survive someone who does not believe it.
 *
 * The structure follows how a sceptic actually reads a number: the total, what
 * created it, where that came from, and only then the arithmetic. So the page is
 * one decomposition, one trace, and one evidence panel — not a wall of widgets:
 *
 *   Basis strip     what is being measured, before any number is shown
 *   Net carbon      the figure under examination
 *   Decomposition   the ledger's own groups, expanding to its own lines
 *   Evidence        contextual panel: contribution, why, inputs, citations
 *   Follow carbon   one contribution traced from field to net result
 *
 * The thing that makes this defensible rather than decorative: a traced
 * contribution is built by the engine from the same three functions the network
 * ledger uses, so traced lines sum into network lines exactly. Following a tonne
 * dims the ledger lines it does not touch — the connection between the trace and
 * the total is shown, not asserted.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, useResource, useTwin } from '../store.tsx';
import { ErrorState, Loading, Panel, SectionHead, Tag } from '../components/Primitives.tsx';
import { useRouter } from '../router.tsx';
import { dateFull, num, pct } from '../format.ts';
import type {
  AllocationTrace,
  ProvenanceRow,
  TraceCandidate,
} from '../../../engine/src/trace.ts';
import type { CarbonLedger as Ledger, LedgerLine } from '../../../engine/src/types.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Grouping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The ledger's own kinds, in reading order. Removal, avoidance and substitution
 * stay apart: they are different commodities and merging them to tidy the UI
 * would destroy the distinction the engine works hardest to preserve.
 */
const GROUPS: Array<{
  kind: LedgerLine['kind'];
  label: string;
  note: string;
  sign: 'plus' | 'minus';
}> = [
  {
    kind: 'removal',
    label: 'Durable removal',
    note: 'Carbon taken out of the atmosphere and held in solid form.',
    sign: 'plus',
  },
  {
    kind: 'avoided',
    label: 'Avoided emissions',
    note: 'Gases the counterfactual fate would have released. Not a removal.',
    sign: 'plus',
  },
  {
    kind: 'substitution',
    label: 'Fossil displacement',
    note: 'Fossil energy and synthetic nitrogen the products replaced.',
    sign: 'plus',
  },
  {
    kind: 'emission',
    label: 'Emissions caused',
    note: 'What the network itself burned, drew and vented to do the work.',
    sign: 'minus',
  },
  {
    kind: 'adjustment',
    label: 'Adjustments',
    note: 'Corrections applied to gross figures, such as 100-year permanence.',
    sign: 'minus',
  },
];

interface Group {
  kind: LedgerLine['kind'];
  label: string;
  note: string;
  sign: 'plus' | 'minus';
  lines: LedgerLine[];
  valueT: number;
}

function groupLedger(ledger: Ledger): Group[] {
  return GROUPS.map((g) => {
    const lines = ledger.lines.filter((l) => l.kind === g.kind);
    return { ...g, lines, valueT: lines.reduce((a, l) => a + l.valueT, 0) };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function CarbonLedger() {
  const { boot, state, version } = useTwin();
  const carbon = useResource(() => api.carbon(), [version], [
    'Aggregating physical inventory across allocations…',
    'Applying the Q10 permanence correction…',
    'Running Monte Carlo over every emission factor…',
  ]);

  const { search } = useRouter();
  const [openLine, setOpenLine] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [trace, setTrace] = useState<AllocationTrace | null>(null);
  const [traceError, setTraceError] = useState<string | null>(null);

  /**
   * Deep link from another screen: /carbon/ledger?source=…&facility=…
   *
   * Facilities and Pathways hand a specific contribution over rather than
   * reimplementing the trace, so the reader lands already following it.
   */
  const deepLink = useMemo(() => {
    const q = new URLSearchParams(search);
    const source = q.get('source');
    const facility = q.get('facility');
    return source && facility ? { source, facility } : null;
  }, [search]);

  useEffect(() => {
    if (!deepLink) return;
    let cancelled = false;
    setFollowing(true);
    setOpenLine(null);
    setTraceError(null);
    api
      .trace(deepLink.source, deepLink.facility)
      .then((t) => !cancelled && setTrace(t))
      .catch((e) => {
        if (cancelled) return;
        setTrace(null);
        setTraceError(e instanceof Error ? e.message : 'That contribution could not be traced.');
      });
    return () => {
      cancelled = true;
    };
  }, [deepLink]);

  // Following a contribution clears any open evidence panel: they compete for
  // the same attention and the trace is the larger idea.
  const startFollow = useCallback(() => {
    setOpenLine(null);
    setFollowing(true);
  }, []);

  const stopFollow = useCallback(() => {
    setFollowing(false);
    setTrace(null);
    setTraceError(null);
  }, []);

  if (!boot || !state) return <Loading message="Loading…" />;
  if (carbon.loading) return <Loading message={carbon.message} />;
  if (carbon.error) return <ErrorState message={carbon.error} onRetry={carbon.reload} />;
  if (!carbon.data) return null;

  const { ledger, totals, provenance } = carbon.data;

  if (ledger.lines.length === 0) {
    return (
      <div className="page">
        <div className="page-head">
          <h1>Carbon Ledger</h1>
        </div>
        <div className="section">
          <div className="empty">
            <h4>No ledger for this plan</h4>
            <p>
              The optimiser placed no material in the current window, so there is nothing to
              account for. Nothing is being hidden — there is genuinely no carbon to report.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const groups = groupLedger(ledger);
  const selected = openLine ? ledger.lines.find((l) => l.key === openLine) ?? null : null;

  // When a trace is active, the lines it feeds stay lit and the rest recede.
  const tracedKeys = trace ? new Set(trace.ledger.lines.map((l) => l.key)) : null;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Carbon Ledger</h1>
          <div className="lede">
            Every figure here resolves to a physical quantity, a published factor and a citation.
            Open any line for its evidence, or follow a single contribution from the field to the
            net result.
          </div>
        </div>
        <div className="head-actions">
          <button
            className={`btn ${following ? '' : 'primary'}`}
            onClick={following ? stopFollow : startFollow}
          >
            {following ? 'Close trace' : 'Follow carbon'}
          </button>
        </div>
      </div>

      <BasisStrip
        windowDays={state.assumptions.windowDays}
        asOf={state.asOf}
        version={version}
        objective={state.objective}
        suppliedT={totals.suppliedT}
        divertedT={totals.divertedT}
      />

      {following && (
        <FollowCarbon
          trace={trace}
          setTrace={setTrace}
          error={traceError}
          setError={setTraceError}
          version={version}
        />
      )}

      <div className="section">
        <SectionHead
          title="What created this number"
          note={
            tracedKeys
              ? 'Lit lines are the ones the traced contribution feeds'
              : 'Select any line for its inputs, factors and citation'
          }
        />
        <div className={`ledger-split ${selected ? 'with-evidence' : ''}`}>
          <Decomposition
            ledger={ledger}
            groups={groups}
            openLine={openLine}
            setOpenLine={setOpenLine}
            tracedKeys={tracedKeys}
          />
          {selected && (
            <Evidence
              line={selected}
              rows={provenance[selected.key] ?? null}
              ledger={ledger}
              onClose={() => setOpenLine(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Basis
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What is being measured, stated before any number is shown.
 *
 * A planning-window estimate is not a historical measurement, and the fastest way
 * to lose a carbon audit is to let someone assume it was.
 */
function BasisStrip({
  windowDays,
  asOf,
  version,
  objective,
  suppliedT,
  divertedT,
}: {
  windowDays: number;
  asOf: string;
  version: number;
  objective: string;
  suppliedT: number;
  divertedT: number;
}) {
  const items = [
    { label: 'Planning window', value: `${windowDays} days to ${dateFull(asOf)}` },
    {
      label: 'Supply basis',
      value: `${num(divertedT)} t placed of ${num(suppliedT)} t offered`,
    },
    { label: 'Objective', value: objective },
    { label: 'Twin version', value: `v${version}` },
  ];
  return (
    <div className="section">
      <div className="basis">
        {items.map((i) => (
          <div key={i.label} className="basis-item">
            <span className="basis-label">{i.label}</span>
            <span className="basis-value">{i.value}</span>
          </div>
        ))}
        <div className="basis-status">
          <span className="q-tag">Modelled estimate</span>
          Forward-looking plan, not measured emissions. Not verified and not a carbon credit.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Decomposition
// ─────────────────────────────────────────────────────────────────────────────

function Decomposition({
  ledger,
  groups,
  openLine,
  setOpenLine,
  tracedKeys,
}: {
  ledger: Ledger;
  groups: Group[];
  openLine: string | null;
  setOpenLine: (k: string | null) => void;
  tracedKeys: Set<string> | null;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const maxAbs = Math.max(...groups.map((g) => Math.abs(g.valueT)), 1);

  // A group whose lines the trace touches opens itself, so the connection is
  // visible without the reader hunting for it.
  useEffect(() => {
    if (!tracedKeys) return;
    const hit = groups.filter((g) => g.lines.some((l) => tracedKeys.has(l.key))).map((g) => g.kind);
    setExpanded(new Set(hit));
  }, [tracedKeys, ledger]);

  const toggle = (kind: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  return (
    <div className="ledger-main">
      <div className="lhero">
        <div className="lhero-label">Net carbon impact</div>
        <div className="lhero-value">
          {ledger.netT >= 0 ? '+' : '−'}
          {num(Math.abs(ledger.netT))}
          <span className="lhero-unit">tCO₂e</span>
        </div>
        {ledger.uncertainty && (
          <div className="lhero-band">
            <span className="mono">
              {num(ledger.uncertainty.p5)}–{num(ledger.uncertainty.p95)}
            </span>{' '}
            across {num(ledger.uncertainty.draws)} Monte Carlo draws (P5–P95)
          </div>
        )}
      </div>

      <div className="lgroups">
        {groups.map((g) => {
          const open = expanded.has(g.kind);
          const empty = g.lines.length === 0;
          const dim = tracedKeys ? !g.lines.some((l) => tracedKeys.has(l.key)) : false;

          return (
            <div key={g.kind} className={`lgroup ${open ? 'open' : ''} ${dim ? 'dim' : ''}`}>
              <button
                className="lgroup-row"
                onClick={() => !empty && toggle(g.kind)}
                aria-expanded={open}
                disabled={empty}
              >
                <span className="lg-op">{g.sign === 'plus' ? '+' : '−'}</span>
                <span className="lg-label">
                  {g.label}
                  <span className="lg-note">{g.note}</span>
                </span>
                <span className="lg-bar">
                  <span
                    className={`lg-fill ${g.sign === 'plus' ? 'pos' : 'neg'}`}
                    style={{ width: `${(Math.abs(g.valueT) / maxAbs) * 100}%` }}
                  />
                </span>
                <span className={`lg-value mono ${g.sign === 'plus' ? 'pos' : 'neg'}`}>
                  {empty ? '—' : num(Math.abs(g.valueT))}
                </span>
                <span className="lg-count mono">
                  {empty ? 'none' : `${g.lines.length} line${g.lines.length > 1 ? 's' : ''}`}
                </span>
                <span className="lg-chev">{empty ? '' : open ? '−' : '+'}</span>
              </button>

              {empty && (
                <div className="lgroup-empty">
                  No {g.label.toLowerCase()} in this plan. The pathways currently operating do not
                  produce this kind of effect — the figure is absent, not zeroed.
                </div>
              )}

              {open && !empty && (
                <div className="llines">
                  {g.lines.map((l) => {
                    const lit = tracedKeys ? tracedKeys.has(l.key) : true;
                    return (
                      <button
                        key={l.key}
                        className={`lline ${openLine === l.key ? 'sel' : ''} ${lit ? '' : 'dim'}`}
                        onClick={() => setOpenLine(openLine === l.key ? null : l.key)}
                      >
                        <span className="ll-label">{l.label}</span>
                        <span className="ll-unc mono">±{l.uncertaintyPct}%</span>
                        <span className={`ll-value mono ${l.valueT >= 0 ? 'pos' : 'neg'}`}>
                          {num(l.valueT)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div className="lgroup-total">
          <span className="lg-op">=</span>
          <span className="lg-label">Net carbon impact</span>
          <span className="lg-bar" />
          <span className="lg-value mono">{num(ledger.netT)}</span>
          <span className="lg-count mono">tCO₂e</span>
          <span className="lg-chev" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The contextual panel. Deliberately not a modal: the reader keeps the ledger in
 * view, so a line and its evidence are read together rather than in sequence.
 */
function Evidence({
  line,
  rows,
  ledger,
  onClose,
}: {
  line: LedgerLine;
  rows: ProvenanceRow[] | null;
  ledger: Ledger;
  onClose: () => void;
}) {
  const [deep, setDeep] = useState(false);
  const share = ledger.netT !== 0 ? (line.valueT / Math.abs(ledger.netT)) * 100 : 0;

  return (
    <aside className="evidence">
      <header className="ev-head">
        <div>
          <div className="ev-kind">{line.kind}</div>
          <h3>{line.label}</h3>
        </div>
        <button className="ev-close" onClick={onClose} aria-label="Close evidence">
          ×
        </button>
      </header>

      <div className="ev-value">
        <span className={`ev-num mono ${line.valueT >= 0 ? 'pos' : 'neg'}`}>
          {line.valueT >= 0 ? '+' : '−'}
          {num(Math.abs(line.valueT))}
        </span>
        <span className="ev-unit">tCO₂e</span>
        <span className="ev-share">
          {pct(Math.abs(share))} of the net figure · ±{line.uncertaintyPct}% published uncertainty
        </span>
      </div>

      <section className="ev-block">
        <h4>Why this number?</h4>
        <p className="ev-why">{line.basis}</p>
      </section>

      <section className="ev-block">
        <h4>Inputs</h4>
        {rows === null || rows.length === 0 ? (
          <div className="ev-missing">
            <strong>No inputs recorded for this line.</strong>
            <p>
              The line was produced by the ledger but no provenance mapping exists for it yet. The
              calculation basis above is still authoritative; what is missing is the itemised
              breakdown, and that gap is shown rather than filled with a guess.
            </p>
          </div>
        ) : (
          <table className="ev-table">
            <thead>
              <tr>
                <th>Input</th>
                <th className="r">Value</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.input}>
                  <td>
                    {r.input}
                    {r.factor && <span className="ev-factor">{r.factor}</span>}
                    {deep && r.factorSource && <span className="ev-src">{r.factorSource}</span>}
                  </td>
                  <td className="r mono">
                    {num(r.value, r.value !== 0 && Math.abs(r.value) < 100 ? 3 : 0)}
                  </td>
                  <td className="ev-unitcell">{r.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <button className="ev-deeper" onClick={() => setDeep(!deep)}>
        {deep ? 'Hide calculation detail' : 'Calculation detail'}
      </button>

      {deep && (
        <section className="ev-block ev-deep">
          <h4>Source</h4>
          <p className="ev-source">{line.source}</p>
          <h4>Uncertainty</h4>
          <p className="ev-source">
            ±{line.uncertaintyPct}% at one sigma, propagated into the network band by Monte Carlo
            over every factor simultaneously rather than added in quadrature.
          </p>
          <h4>Ledger key</h4>
          <p className="ev-source mono">{line.key}</p>
        </section>
      )}

      <div className="ev-status">
        <span className="q-tag">Modelled estimate</span>
        Not measured, not verified, and not a carbon credit.
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Follow carbon
// ─────────────────────────────────────────────────────────────────────────────

function FollowCarbon({
  trace,
  setTrace,
  error,
  setError,
  version,
}: {
  trace: AllocationTrace | null;
  setTrace: (t: AllocationTrace | null) => void;
  error: string | null;
  setError: (e: string | null) => void;
  version: number;
}) {
  const cands = useResource(() => api.traceCandidates(), [version], ['Ranking contributions…']);
  const [busy, setBusy] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(0);
  const timer = useRef<number | null>(null);

  // The reveal is the explanation: stages arrive in causal order and the running
  // total moves as each one lands, so the reader watches carbon accrue and be
  // charged rather than being handed a finished figure.
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
    }, 240);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [trace]);

  const pick = async (c: TraceCandidate) => {
    setBusy(c.key);
    setError(null);
    try {
      setTrace(await api.trace(c.sourceId, c.facilityId));
    } catch (e) {
      setTrace(null);
      setError(e instanceof Error ? e.message : 'That contribution could not be traced.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="section">
      <SectionHead
        title="Follow carbon"
        note="One contribution, traced from the field to the net result"
      />

      <Panel flush>
        <div className="follow">
          <div className="fc-picker">
            <div className="fc-picker-head">
              Contributions in this plan
              <span className="muted"> · largest first</span>
            </div>
            {cands.loading && <div className="fc-loading">Ranking contributions…</div>}
            {cands.error && <div className="fc-loading neg">{cands.error}</div>}
            {cands.data && cands.data.length === 0 && (
              <div className="fc-loading">
                No allocations in the current plan, so there is nothing to follow.
              </div>
            )}
            <div className="fc-list">
              {(cands.data ?? []).map((c) => (
                <button
                  key={c.key}
                  className={`fc-item ${trace?.key === c.key ? 'sel' : ''} ${
                    trace && trace.key !== c.key ? 'dim' : ''
                  }`}
                  onClick={() => pick(c)}
                  disabled={busy !== null}
                >
                  <span className="fc-i-main">
                    <span className="fc-i-src">{c.sourceName}</span>
                    <span className="fc-i-sub">
                      {c.streamLabel} → {c.facilityName}
                    </span>
                  </span>
                  <span className="fc-i-nums">
                    <span className="mono">{num(c.tonnes)} t</span>
                    <span className={`mono ${c.netCarbonT >= 0 ? 'pos' : 'neg'}`}>
                      {num(c.netCarbonT)}
                    </span>
                  </span>
                  {busy === c.key && <span className="fc-i-busy">tracing…</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="fc-stage">
            {error && (
              <div className="fc-empty">
                <h4>That contribution could not be traced</h4>
                <p>{error}</p>
              </div>
            )}
            {!error && !trace && (
              <div className="fc-empty">
                <h4>Choose a contribution</h4>
                <p>
                  Pick any row on the left. It will be followed through collection, haulage, the
                  receiving plant and conversion, with the carbon booked at the stage that
                  physically causes it.
                </p>
              </div>
            )}
            {!error && trace && <TraceChain trace={trace} revealed={revealed} />}
          </div>
        </div>
      </Panel>
    </div>
  );
}

/** The chain itself: stages, running total, route geometry and the plain answer. */
function TraceChain({ trace, revealed }: { trace: AllocationTrace; revealed: number }) {
  const running = useMemo(() => {
    let acc = 0;
    return trace.stages.map((s) => {
      acc += s.carbonT ?? 0;
      return acc;
    });
  }, [trace]);

  const maxAbs = Math.max(...trace.stages.map((s) => Math.abs(s.carbonT ?? 0)), 1);
  const shown = Math.min(revealed, trace.stages.length);
  const total = shown > 0 ? running[shown - 1] : 0;

  return (
    <div className="chain">
      <header className="chain-head">
        <div>
          <div className="chain-title">
            {num(trace.tonnes)} t {trace.streamLabel.toLowerCase()}
          </div>
          <div className="chain-sub">
            {trace.sourceName} → {trace.facilityName} · {trace.pathwayLabel} ·{' '}
            {num(trace.distanceKm)} km
          </div>
        </div>
        <div className="chain-total">
          <span className="ct-label">Running total</span>
          <span className={`ct-value mono ${total >= 0 ? 'pos' : 'neg'}`}>
            {total >= 0 ? '+' : '−'}
            {num(Math.abs(total))}
          </span>
          <span className="ct-unit">
            tCO₂e · {pct(Math.abs(trace.sharePct))} of network net
          </span>
        </div>
      </header>

      <RouteInset trace={trace} active={shown >= 3} />

      <ol className="chain-stages">
        {trace.stages.map((s, i) => {
          const on = i < shown;
          return (
            <li key={s.key} className={`cs ${on ? 'on' : ''} ${s.kind ? `k-${s.kind}` : ''}`}>
              <span className="cs-rail" aria-hidden>
                <span className="cs-dot" />
              </span>
              <span className="cs-body">
                <span className="cs-label">{s.label}</span>
                <span className="cs-headline">{s.headline}</span>
                <span className="cs-detail">{s.detail}</span>
              </span>
              <span className="cs-carbon">
                {s.carbonT === null ? (
                  <span className="cs-none">no carbon event</span>
                ) : (
                  <>
                    <span className={`cs-num mono ${s.carbonT >= 0 ? 'pos' : 'neg'}`}>
                      {s.carbonT >= 0 ? '+' : '−'}
                      {num(Math.abs(s.carbonT))}
                    </span>
                    <span className="cs-bar">
                      <span
                        className={`cs-fill ${s.carbonT >= 0 ? 'pos' : 'neg'}`}
                        style={{ width: on ? `${(Math.abs(s.carbonT) / maxAbs) * 100}%` : '0%' }}
                      />
                    </span>
                    <span className="cs-cl">{s.carbonLabel}</span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="chain-why">
        <h4>Why this number?</h4>
        <p>{trace.why}</p>
      </div>

      <details className="chain-deep">
        <summary>Calculation detail for this contribution</summary>
        <div className="cd-grid">
          <div>
            <h5>Route</h5>
            <ul className="dd-list">
              <li>
                <span>Road distance</span>
                <span className="mono">{num(trace.route.roadKm, 1)} km</span>
              </li>
              <li>
                <span>Straight line</span>
                <span className="mono">{num(trace.route.straightKm, 1)} km</span>
              </li>
              <li>
                <span>Circuity</span>
                <span className="mono">{num(trace.route.circuity, 2)}×</span>
              </li>
              <li>
                <span>Vehicle</span>
                <span className="mono">{trace.vehicle.label}</span>
              </li>
              <li>
                <span>Trips</span>
                <span className="mono">{num(trace.vehicle.trips)}</span>
              </li>
              <li>
                <span>Diesel</span>
                <span className="mono">{num(trace.route.dieselL)} L</span>
              </li>
            </ul>
          </div>
          <div>
            <h5>Counterfactual</h5>
            <p className="cd-text">
              <strong>{trace.counterfactual.label}</strong> — {trace.counterfactual.basis}
            </p>
            <p className="cd-src">{trace.counterfactual.source}</p>
            <h5>Pathway</h5>
            <p className="cd-text">
              <strong>{trace.pathwayDef.label}</strong> — {trace.pathwayDef.maturity}
            </p>
          </div>
          <div>
            <h5>Ledger for this contribution</h5>
            <table className="ev-table">
              <tbody>
                {trace.ledger.lines
                  .filter((l) => l.kind !== 'total')
                  .map((l) => (
                    <tr key={l.key}>
                      <td>{l.label}</td>
                      <td className={`r mono ${l.valueT >= 0 ? 'pos' : 'neg'}`}>{num(l.valueT)}</td>
                    </tr>
                  ))}
                <tr className="cd-net">
                  <td>Net</td>
                  <td className="r mono">{num(trace.ledger.netT)}</td>
                </tr>
              </tbody>
            </table>
            <p className="cd-src">
              Built by the same ledger function as the network figure, on this allocation alone —
              so these lines sum into the lines above rather than agreeing with them by
              coincidence.
            </p>
          </div>
        </div>
      </details>

      <div className="chain-status">
        <span className="q-tag">Modelled estimate</span>
        Supply for this source was last updated {num(trace.source.telemetryAgeH)} h ago. Not
        measured, not verified, and not a carbon credit.
      </div>
    </div>
  );
}

/**
 * Real geography, drawn small.
 *
 * Two points and the haul between them, from the actual coordinates. The straight
 * line is what the map can show; the road distance is what the carbon was charged
 * on, and the gap between them is the circuity factor, so both are labelled.
 */
function RouteInset({ trace, active }: { trace: AllocationTrace; active: boolean }) {
  const W = 560;
  const H = 104;
  const pad = 30;
  /** Keeps the arc apex and its distance label inside the viewBox on any geometry. */
  const TOP = 22;

  const { source, facility } = trace;
  const minLon = Math.min(source.lon, facility.lon);
  const maxLon = Math.max(source.lon, facility.lon);
  const minLat = Math.min(source.lat, facility.lat);
  const maxLat = Math.max(source.lat, facility.lat);
  const spanLon = maxLon - minLon || 0.01;
  const spanLat = maxLat - minLat || 0.01;

  const x = (lon: number) => pad + ((lon - minLon) / spanLon) * (W - 2 * pad);
  const y = (lat: number) => H / 2 - ((lat - (minLat + maxLat) / 2) / spanLat) * (H * 0.34);

  const x1 = x(source.lon);
  const y1 = y(source.lat);
  const x2 = x(facility.lon);
  const y2 = y(facility.lat);
  const cx = (x1 + x2) / 2;
  const cy = Math.max(TOP, Math.min(y1, y2) - 22);

  return (
    <div className="route-inset">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Haul geometry">
        <path
          d={`M${x1},${y1} Q${cx},${cy} ${x2},${y2}`}
          className={`ri-arc ${active ? 'on' : ''}`}
        />
        <circle cx={x1} cy={y1} r={4} className="ri-src" />
        <circle cx={x2} cy={y2} r={5} className="ri-fac" />
        <text x={x1} y={y1 + 16} className="ri-lab" textAnchor="middle">
          {source.district}
        </text>
        <text x={x2} y={y2 + 17} className="ri-lab" textAnchor="middle">
          {facility.district}
        </text>
        <text x={cx} y={cy - 5} className="ri-dist" textAnchor="middle">
          {num(trace.route.roadKm, 1)} km by road · {num(trace.route.straightKm, 1)} km direct
        </text>
      </svg>
    </div>
  );
}
