/**
 * Carbon Opportunities — the system found something.
 *
 * Not a list of sustainability recommendations. Every item here is a real
 * `ScenarioInstance` that the engine applied to a clone of the network and
 * re-optimised; the improvement shown is the difference between two ledgers built
 * from two real solves. Nothing is extrapolated from a frontend formula.
 *
 * Three deliberate choices:
 *
 *  1. **The top finding leads.** One opportunity gets the space, with its before,
 *     its change, its after and its trade-off — because a page that opens with
 *     fourteen equal cards has not actually found anything.
 *  2. **Rejected candidates are shown.** "Solving on profit-first would cost 3,156
 *     tCO₂e" is measured, useful, and would be dishonest to hide behind a list of
 *     only the wins.
 *  3. **Every item says why the optimiser hasn't already done it.** An opportunity
 *     without that is a misleading recommendation, and the reason is read from real
 *     state — a binding capacity constraint, or the objective in force.
 */

import { useMemo, useState } from 'react';
import { api, useResource, useTwin } from '../store.tsx';
import { ErrorState, Loading, Panel, SectionHead } from '../components/Primitives.tsx';
import { Link } from '../router.tsx';
import { inr, num, pct } from '../format.ts';
import type { Opportunity, OpportunityReport } from '../../../engine/src/opportunity.ts';

export default function CarbonOpportunities() {
  const { boot, state, version } = useTwin();
  const res = useResource(() => api.opportunities(), [version], [
    'Applying each candidate change to a clone of the network…',
    'Re-optimising and rebuilding the ledger for each…',
  ]);

  const [openId, setOpenId] = useState<string | null>(null);

  if (!boot || !state) return <Loading message="Loading…" />;
  if (res.loading) return <Loading message={res.message} />;
  if (res.error) return <ErrorState message={res.error} onRetry={res.reload} />;
  if (!res.data) return null;

  const report = res.data;
  const [top, ...rest] = report.opportunities;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Carbon Opportunities</h1>
          <div className="lede">
            Each finding below was measured by applying the change to the network and re-running
            the optimiser. The improvement is the difference between two real solves, not an
            estimate — and every one says why the optimiser has not already taken it.
          </div>
        </div>
      </div>

      {report.opportunities.length === 0 ? (
        <NoneFound report={report} />
      ) : (
        <>
          <Upside report={report} top={top} />
          <TopFinding o={top} report={report} />
          {rest.length > 0 && (
            <Ranked
              opportunities={rest}
              report={report}
              openId={openId}
              onOpen={setOpenId}
            />
          )}
        </>
      )}

      <Rejected report={report} />

      <div className="op-basis">
        <span className="q-tag">Modelled improvement</span>
        {report.basis}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Upside
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The one visualisation: current net carbon, and the measured headroom above it.
 *
 * Proportional and literal — the bar is the network, the extension is what the
 * best single change added when it was actually run.
 */
function Upside({ report, top }: { report: OpportunityReport; top: Opportunity }) {
  const current = report.current.carbonT;
  const best = top.measure.carbonDeltaT;
  const combined = report.opportunities.reduce((a, o) => a + o.measure.carbonDeltaT, 0);
  const scale = current + combined;

  return (
    <div className="section">
      <div className="upside">
        <div className="up-fig">
          <div className="up-label">Best single improvement available</div>
          <div className="up-value">
            +{num(best)}
            <span className="up-unit">tCO₂e</span>
          </div>
          <div className="up-sub">
            {pct((best / Math.abs(current)) * 100, 1)} above the current plan ·{' '}
            {report.opportunities.length} of {report.candidatesTested} candidates improved carbon
          </div>
        </div>

        <div className="up-viz">
          <div className="uv-row">
            <span className="uv-key">Current network</span>
            <span className="uv-track">
              <span className="uv-fill current" style={{ width: `${(current / scale) * 100}%` }} />
            </span>
            <span className="uv-val mono">{num(current)}</span>
          </div>
          <div className="uv-row">
            <span className="uv-key">Best single change</span>
            <span className="uv-track">
              <span className="uv-spacer" style={{ width: `${(current / scale) * 100}%` }} />
              <span className="uv-fill best" style={{ width: `${(best / scale) * 100}%` }} />
            </span>
            <span className="uv-val mono pos">+{num(best)}</span>
          </div>
          <div className="uv-row">
            <span className="uv-key">All improving changes</span>
            <span className="uv-track">
              <span className="uv-spacer" style={{ width: `${(current / scale) * 100}%` }} />
              <span className="uv-fill all" style={{ width: `${(combined / scale) * 100}%` }} />
            </span>
            <span className="uv-val mono pos">+{num(combined)}</span>
          </div>
          <div className="uv-note">
            Each change was measured on its own against the current plan. They are not additive —
            several compete for the same stranded material, so the combined figure is an upper
            bound rather than a total.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top finding
// ─────────────────────────────────────────────────────────────────────────────

function TopFinding({ o, report }: { o: Opportunity; report: OpportunityReport }) {
  const m = o.measure;
  return (
    <div className="section">
      <SectionHead title="Strongest finding" note={`Measured in ${o.solveMs} ms of re-optimisation`} />
      <Panel flush>
        <div className="top-op">
          <div className="to-head">
            <div>
              <div className="to-kind">{o.kind === 'capacity' ? 'Capacity' : 'Objective'}</div>
              <h3>{o.headline}</h3>
            </div>
            <div className="to-delta">
              <span className="tod-value mono pos">+{num(m.carbonDeltaT)}</span>
              <span className="tod-unit">tCO₂e</span>
            </div>
          </div>

          <BeforeAfter o={o} />

          <div className="to-why">
            <div className="tw-block">
              <h4>Why it helps</h4>
              <p>{o.why}</p>
            </div>
            <div className="tw-block">
              <h4>Why the optimiser hasn’t done it</h4>
              <p>{o.whyNotAlready}</p>
            </div>
          </div>

          <Tradeoff m={m} />

          {o.flowChanges.length > 0 && (
            <div className="to-flows">
              <h4>What moves</h4>
              <ul className="tf-list">
                {o.flowChanges.map((f, i) => (
                  <li key={`${f.sourceId}-${i}`}>
                    <span className="tf-src">{f.sourceName}</span>
                    <span className="tf-move">
                      {f.changeType === 'added' && `newly placed at ${f.toFacilityName}`}
                      {f.changeType === 'dropped' && `no longer sent to ${f.fromFacilityName}`}
                      {f.changeType === 'rerouted' &&
                        `${f.fromFacilityName} → ${f.toFacilityName}`}
                      {(f.changeType === 'increased' || f.changeType === 'decreased') &&
                        `${f.changeType} at ${f.toFacilityName ?? f.fromFacilityName}`}
                    </span>
                    <span className="tf-t mono">{num(f.tonnes)} t</span>
                    <span className={`tf-c mono ${f.carbonDeltaT >= 0 ? 'pos' : 'neg'}`}>
                      {f.carbonDeltaT >= 0 ? '+' : '−'}
                      {num(Math.abs(f.carbonDeltaT))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Actions o={o} />
        </div>
      </Panel>
    </div>
  );
}

/** Current → change → re-optimised, with the figures from both real solves. */
function BeforeAfter({ o }: { o: Opportunity }) {
  const m = o.measure;
  const cols = [
    {
      key: 'before',
      label: 'Current network',
      rows: [
        ['Net carbon', `${num(m.carbonBeforeT)} tCO₂e`],
        ['Material placed', `${num(m.divertedBeforeT)} t`],
        ['Operating margin', inr(m.marginBeforeInr)],
      ],
    },
    {
      key: 'change',
      label: 'Proposed change',
      rows: [
        ['Change', o.scenarioLabel],
        ['Applied to', 'a clone of the live network'],
        ['Then', 'the optimiser re-solves from scratch'],
      ],
    },
    {
      key: 'after',
      label: 'Re-optimised',
      rows: [
        ['Net carbon', `${num(m.carbonAfterT)} tCO₂e`],
        ['Material placed', `${num(m.divertedAfterT)} t`],
        ['Operating margin', inr(m.marginAfterInr)],
      ],
    },
  ];

  return (
    <div className="ba">
      {cols.map((c, i) => (
        <div key={c.key} className={`ba-col ba-${c.key}`}>
          <div className="ba-label">{c.label}</div>
          <dl className="ba-rows">
            {c.rows.map(([k, v]) => (
              <div key={k} className="ba-row">
                <dt>{k}</dt>
                <dd className={c.key === 'change' ? '' : 'mono'}>{v}</dd>
              </div>
            ))}
          </dl>
          {i < cols.length - 1 && <span className="ba-arrow" aria-hidden />}
        </div>
      ))}
      <div className="ba-result">
        <span className="bar-label">Carbon difference</span>
        <span className="bar-value mono pos">+{num(o.measure.carbonDeltaT)} tCO₂e</span>
      </div>
    </div>
  );
}

/** The economic consequence, with an unambiguous sign either way. */
function Tradeoff({ m }: { m: Opportunity['measure'] }) {
  const gains = m.marginDeltaInr >= 0;
  const material = Math.abs(m.marginDeltaInr) > 1e5;
  return (
    <div className={`tradeoff ${material ? (gains ? 'agree' : 'conflict') : 'neutral'}`}>
      <div className="tr-item">
        <span className="tr-label">Carbon</span>
        <span className="tr-value pos mono">+{num(m.carbonDeltaT)} tCO₂e</span>
      </div>
      <div className="tr-item">
        <span className="tr-label">Operating margin</span>
        <span className={`tr-value mono ${gains ? 'pos' : 'neg'}`}>
          {gains ? '+' : '−'}
          {inr(Math.abs(m.marginDeltaInr))}
        </span>
      </div>
      <div className="tr-item">
        <span className="tr-label">Material placed</span>
        <span className="tr-value mono">
          {m.divertedDeltaT >= 0 ? '+' : '−'}
          {num(Math.abs(m.divertedDeltaT))} t
        </span>
      </div>
      <div className="tr-item">
        <span className="tr-label">Transport burden</span>
        <span className={`tr-value mono ${m.tkmDeltaPct <= 0 ? 'pos' : 'neg'}`}>
          {m.tkmDeltaPct >= 0 ? '+' : '−'}
          {pct(Math.abs(m.tkmDeltaPct), 1)}
        </span>
      </div>
      <div className="tr-verdict">
        {!material
          ? 'Carbon improves with no material change to operating margin.'
          : gains
            ? 'Carbon and economics agree on this change.'
            : 'This is a genuine trade-off: carbon improves at a cost to margin.'}
      </div>
    </div>
  );
}

function Actions({ o }: { o: Opportunity }) {
  // The Scenarios screen receives the same instance that was evaluated, so the
  // user re-runs the identical change rather than recreating it by hand.
  const q = new URLSearchParams({
    kind: o.scenario.kind,
    ...Object.fromEntries(Object.entries(o.scenario.params).map(([k, v]) => [k, String(v)])),
  });
  return (
    <div className="op-actions">
      <Link to={`/scenarios?${q.toString()}`} className="btn sm primary">
        Simulate this change
      </Link>
      {o.facilityId && (
        <Link to="/carbon/facilities" className="btn sm">
          Facility carbon profile
        </Link>
      )}
      <Link to="/carbon/ledger" className="btn sm">
        Carbon Ledger
      </Link>
      <Link to="/economics" className="btn sm">
        Economics
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ranked list
// ─────────────────────────────────────────────────────────────────────────────

function Ranked({
  opportunities,
  report,
  openId,
  onOpen,
}: {
  opportunities: Opportunity[];
  report: OpportunityReport;
  openId: string | null;
  onOpen: (id: string | null) => void;
}) {
  const max = Math.max(...opportunities.map((o) => o.measure.carbonDeltaT), 1);

  return (
    <div className="section">
      <SectionHead
        title="Other findings"
        note="Ranked by measured net carbon improvement · every figure from a real re-solve"
      />
      <Panel flush>
        <div className="oplist">
          {opportunities.map((o) => {
            const m = o.measure;
            const open = openId === o.id;
            return (
              <div key={o.id} className={`opl-item ${open ? 'open' : ''}`}>
                <button className="opl-row" onClick={() => onOpen(open ? null : o.id)} aria-expanded={open}>
                  <span className="opl-main">
                    <span className="opl-head">{o.headline}</span>
                    <span className="opl-kind">
                      {o.kind === 'capacity' ? 'Capacity investment' : 'Objective change'}
                    </span>
                  </span>
                  <span className="opl-bar">
                    <span
                      className="opl-fill"
                      style={{ width: `${(m.carbonDeltaT / max) * 100}%` }}
                    />
                  </span>
                  <span className="opl-carbon mono pos">+{num(m.carbonDeltaT)}</span>
                  <span className={`opl-margin mono ${m.marginDeltaInr >= 0 ? 'pos' : 'neg'}`}>
                    {m.marginDeltaInr >= 0 ? '+' : '−'}
                    {inr(Math.abs(m.marginDeltaInr))}
                  </span>
                  <span className="opl-t mono">
                    {m.divertedDeltaT >= 0 ? '+' : '−'}
                    {num(Math.abs(m.divertedDeltaT))} t
                  </span>
                  <span className="opl-chev">{open ? '−' : '+'}</span>
                </button>

                {open && (
                  <div className="opl-detail">
                    <BeforeAfter o={o} />
                    <div className="to-why">
                      <div className="tw-block">
                        <h4>Why it helps</h4>
                        <p>{o.why}</p>
                      </div>
                      <div className="tw-block">
                        <h4>Why the optimiser hasn’t done it</h4>
                        <p>{o.whyNotAlready}</p>
                      </div>
                    </div>
                    <Tradeoff m={m} />
                    <Actions o={o} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>
      <div className="opl-legend">
        Columns are net carbon, operating margin and material placed — all measured differences
        between the current plan and the re-optimised plan. Ranking is by carbon alone; the other
        columns are shown rather than folded into a score.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rejected and empty
// ─────────────────────────────────────────────────────────────────────────────

function Rejected({ report }: { report: OpportunityReport }) {
  if (report.rejected.length === 0) return null;
  return (
    <div className="section">
      <SectionHead
        title="Measured and rejected"
        note="Tested the same way, and found not to help"
      />
      <div className="rejlist">
        {report.rejected.map((r) => (
          <div key={r.id} className="rej-item">
            <span className="rej-head">{r.headline}</span>
            <span className={`rej-delta mono ${r.carbonDeltaT >= 0 ? 'muted' : 'neg'}`}>
              {r.carbonDeltaT >= 0 ? '' : '−'}
              {num(Math.abs(r.carbonDeltaT))} tCO₂e
            </span>
            <span className="rej-reason">{r.reason}</span>
          </div>
        ))}
      </div>
      <div className="rej-note">
        These are kept rather than hidden. A page showing only what worked would misrepresent the
        shape of the problem — and knowing what a different objective would cost is as useful as
        knowing what more capacity would earn.
      </div>
    </div>
  );
}

function NoneFound({ report }: { report: OpportunityReport }) {
  return (
    <div className="section">
      <div className="empty">
        <h4>No change tested improved net carbon</h4>
        <p>
          All {report.candidatesTested} candidates were applied to a clone of the network and
          re-optimised; none produced more net carbon than the current plan. That is a real result
          about this network, not an absence of analysis — the measured outcome of each is listed
          below.
        </p>
      </div>
    </div>
  );
}
