/**
 * Carbon Facilities — the Carbon Manager's lens over the plant network.
 *
 * Deliberately not a facility operations dashboard. The only question is which
 * plants are helping the net carbon figure and which are dragging on it, and why.
 * Uptime, staffing and maintenance belong to whoever runs the plants.
 *
 *   Network        the three plants that matter most, named before any table
 *   Ranking        every plant by carbon contribution, with its charges visible
 *   Profile        one plant decomposed: sources in, ledger out
 *   Why            the factor that actually explains its position
 *   Arcs           the real allocations feeding it, each handing off to the Ledger
 *   Opportunity    only where the engine can price it
 *
 * A facility's ledger is built from the allocations arriving at it, through the
 * network's own `buildLedger`, under the network's BC₁₀₀ — so the parts sum to the
 * whole and a plant's carbon story is a decomposition rather than a second account.
 * Each feeding arc is built the same way, which is why the arcs sum to the plant and
 * why an arc shows the same number here as it does in the Ledger's trace.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, useResource, useTwin } from '../store.tsx';
import { exportCsv } from '../download.ts';
import { useCarbonExport } from '../components/CarbonExport.tsx';
import { ErrorState, Loading, Panel, SectionHead } from '../components/Primitives.tsx';
import { Link, useRouter } from '../router.tsx';
import { num, pct } from '../format.ts';
import type {
  FacilityCarbon,
  FacilityComparison,
  FacilityRankRow,
} from '../../../engine/src/facility.ts';

export default function CarbonFacilities() {
  const { boot, state, version } = useTwin();
  const { navigate } = useRouter();
  const rank = useResource(() => api.facilityCarbon(), [version], [
    'Building a ledger for every facility…',
  ]);

  const [selected, setSelected] = useState<string | null>(null);
  const [compareWith, setCompareWith] = useState<string | null>(null);

  const active = selected ?? rank.data?.find((r) => r.receivedT > 0)?.id ?? null;

  const profile = useResource(
    () => (active ? api.facilityProfile(active) : Promise.resolve(null as unknown as FacilityCarbon)),
    [version, active],
    ['Aggregating this plant’s allocations…'],
  );

  const comparison = useResource(
    () =>
      active && compareWith
        ? api.facilityCompare(active, compareWith)
        : Promise.resolve(null as unknown as FacilityComparison),
    [version, active, compareWith],
    ['Comparing…'],
  );

  // Changing the selected plant invalidates a comparison against the old one.
  useEffect(() => {
    setCompareWith(null);
  }, [active]);

  const follow = useCallback(
    (sourceId: string, facilityId: string) => {
      navigate(`/carbon/ledger?source=${encodeURIComponent(sourceId)}&facility=${encodeURIComponent(facilityId)}`);
    },
    [navigate],
  );

  // Before the early returns — hooks cannot run conditionally.
  const rankRows = rank.data;
  useCarbonExport(
    rankRows && state
      ? {
          label: `plant ranking (${rankRows.length})`,
          run: () =>
            exportCsv(
              rankRows,
              [
                { header: 'Facility', value: (r) => r.name },
                { header: 'District', value: (r) => r.district },
                { header: 'Pathway', value: (r) => r.pathwayShort },
                { header: 'Status', value: (r) => r.status },
                { header: 'Received t', value: (r) => r.receivedT.toFixed(1) },
                { header: 'Capacity t', value: (r) => r.capacityT.toFixed(1) },
                { header: 'Utilisation %', value: (r) => r.utilisationPct.toFixed(1) },
                { header: 'Net tCO2e', value: (r) => r.netT.toFixed(2) },
                { header: 'tCO2e per t', value: (r) => r.perTonneT.toFixed(4) },
                { header: 'Gross benefit tCO2e', value: (r) => r.grossBenefitT.toFixed(2) },
                { header: 'Transport tCO2e', value: (r) => r.transportT.toFixed(2) },
                { header: 'Process tCO2e', value: (r) => r.processT.toFixed(2) },
                { header: 'Share of net %', value: (r) => r.sharePct.toFixed(2) },
                { header: 'Sources', value: (r) => r.sourceCount },
                { header: 'Mean haul km', value: (r) => r.meanHaulKm.toFixed(1) },
              ],
              {
                title: 'Carbon by plant',
                asOf: state.asOf,
                windowDays: state.assumptions.windowDays,
                objective: state.objective,
                twinVersion: version,
                notes: [
                  'Each plant is valued under the whole network permanence basis, so shares sum to the network net.',
                ],
              },
            ),
        }
      : null,
    [rankRows, state, version],
  );

  if (!boot || !state) return <Loading message="Loading…" />;
  if (rank.loading) return <Loading message={rank.message} />;
  if (rank.error) return <ErrorState message={rank.error} onRetry={rank.reload} />;
  if (!rank.data) return null;

  const rows = rank.data;
  const working = rows.filter((r) => r.receivedT > 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Carbon Facilities</h1>
          <div className="lede">
            Plants are carbon decision points: a haul distance, a conversion efficiency and a
            feedstock chemistry meeting at one gate. This is which of them help the net figure and
            which drag on it — not how they are run.
          </div>
        </div>
      </div>

      <Headline rows={rows} onSelect={setSelected} />

      <Ranking
        rows={rows}
        active={active}
        compareWith={compareWith}
        onSelect={setSelected}
        onCompare={setCompareWith}
      />

      {working.length === 0 && (
        <div className="section">
          <div className="empty">
            <h4>No facility received material this window</h4>
            <p>
              The optimiser placed nothing, so no plant has a carbon result to report. The ranking
              above shows capacity and status only.
            </p>
          </div>
        </div>
      )}

      {active && profile.loading && (
        <div className="section">
          <Panel>
            <div className="loadstate">
              <div className="msg">{profile.message}</div>
            </div>
          </Panel>
        </div>
      )}
      {active && profile.error && (
        <div className="section">
          <ErrorState message={profile.error} onRetry={profile.reload} />
        </div>
      )}
      {profile.data && !profile.loading && <Profile p={profile.data} onFollow={follow} />}

      {compareWith && (
        <Comparison
          data={comparison.data}
          loading={comparison.loading}
          error={comparison.error}
          onClose={() => setCompareWith(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Headline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The three plants that matter, named before any table.
 *
 * "Biggest drag" is the plant with the worst carbon per tonne among those actually
 * receiving material — not the lowest total, which would only ever name the
 * smallest plant.
 */
function Headline({
  rows,
  onSelect,
}: {
  rows: FacilityRankRow[];
  onSelect: (id: string) => void;
}) {
  const working = rows.filter((r) => r.receivedT > 0);
  if (working.length === 0) return null;

  const best = working[0];
  const drag = [...working].sort((a, b) => a.perTonneT - b.perTonneT)[0];
  const idle = [...rows]
    .filter((r) => r.status === 'online' && r.capacityT - r.receivedT > 1)
    .sort((a, b) => b.capacityT - b.receivedT - (a.capacityT - a.receivedT))[0];

  const cards = [
    {
      key: 'best',
      label: 'Best carbon contributor',
      name: best.name,
      value: `${num(best.netT)} tCO₂e`,
      sub: `${num(best.perTonneT, 3)} per tonne over ${num(best.receivedT)} t`,
      id: best.id,
      tone: 'pos' as const,
    },
    drag && drag.id !== best.id
      ? {
          key: 'drag',
          label: 'Weakest per tonne',
          name: drag.name,
          value: `${num(drag.perTonneT, 3)} tCO₂e/t`,
          sub: `${num(drag.netT)} tCO₂e from ${num(drag.receivedT)} t · ${num(drag.meanHaulKm)} km mean haul`,
          id: drag.id,
          tone: 'neg' as const,
        }
      : null,
    idle
      ? {
          key: 'idle',
          label: 'Largest idle capacity',
          name: idle.name,
          value: `${num(idle.capacityT - idle.receivedT)} t unused`,
          sub:
            idle.receivedT > 0
              ? `Running at ${pct(idle.utilisationPct, 0)} of window capacity`
              : 'Received nothing this window',
          id: idle.id,
          tone: 'warn' as const,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    name: string;
    value: string;
    sub: string;
    id: string;
    tone: 'pos' | 'neg' | 'warn';
  }>;

  return (
    <div className="section">
      <div className="fhead">
        {cards.map((c) => (
          <button key={c.key} className={`fh-item ${c.tone}`} onClick={() => onSelect(c.id)}>
            <span className="fh-label">{c.label}</span>
            <span className="fh-name">{c.name}</span>
            <span className={`fh-value ${c.tone}`}>{c.value}</span>
            <span className="fh-sub">{c.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ranking
// ─────────────────────────────────────────────────────────────────────────────

function Ranking({
  rows,
  active,
  compareWith,
  onSelect,
  onCompare,
}: {
  rows: FacilityRankRow[];
  active: string | null;
  compareWith: string | null;
  onSelect: (id: string) => void;
  onCompare: (id: string | null) => void;
}) {
  const maxNet = Math.max(...rows.map((r) => Math.abs(r.netT)), 1);
  const maxPerT = Math.max(...rows.map((r) => Math.abs(r.perTonneT)), 0.001);

  return (
    <div className="section">
      <SectionHead
        title="Where the carbon happens"
        note="Select a facility for its profile · compare to set two against each other"
      />
      <Panel flush>
        <div className="frank">
          <div className="fr-headrow">
            <span>Facility</span>
            <span className="r">Received</span>
            <span>Net carbon contribution</span>
            <span className="r">tCO₂e/t</span>
            <span>Utilisation</span>
            <span />
          </div>
          {rows.map((r) => {
            const on = active === r.id;
            const idle = r.receivedT <= 0;
            return (
              <div key={r.id} className={`fr-row ${on ? 'on' : ''} ${idle ? 'idle' : ''}`}>
                <button className="fr-main" onClick={() => onSelect(r.id)}>
                  <span className="fr-name">{r.name}</span>
                  <span className="fr-sub">
                    {r.pathwayShort} · {r.district}
                    {idle && <span className="fr-badge">{r.status.replace(/_/g, ' ')}</span>}
                  </span>
                </button>

                <span className="fr-recv mono">{idle ? '—' : `${num(r.receivedT)} t`}</span>

                <span className="fr-bar">
                  {!idle && (
                    <>
                      <span
                        className="frb-gross"
                        style={{ width: `${(r.grossBenefitT / maxNet) * 100}%` }}
                        title={`Gross benefit ${num(r.grossBenefitT)} tCO₂e`}
                      />
                      <span
                        className="frb-charge transport"
                        style={{ width: `${(r.transportT / maxNet) * 100}%` }}
                        title={`Transport ${num(r.transportT)} tCO₂e`}
                      />
                      <span
                        className="frb-charge process"
                        style={{ width: `${(r.processT / maxNet) * 100}%` }}
                        title={`Processing ${num(r.processT)} tCO₂e`}
                      />
                      <span className="frb-net mono">{num(r.netT)}</span>
                    </>
                  )}
                  {idle && <span className="fr-none">no material received</span>}
                </span>

                <span className={`fr-pert mono ${idle ? 'muted' : ''}`}>
                  {idle ? '—' : num(r.perTonneT, 3)}
                </span>

                <span className="fr-util">
                  <span className="fu-track">
                    <span
                      className={`fu-fill ${r.utilisationPct >= 99 ? 'full' : ''}`}
                      style={{ width: `${Math.min(100, r.utilisationPct)}%` }}
                    />
                  </span>
                  <span className="fu-val mono">{pct(r.utilisationPct, 0)}</span>
                </span>

                <button
                  className={`fr-cmp ${compareWith === r.id ? 'on' : ''}`}
                  onClick={() => onCompare(compareWith === r.id ? null : r.id)}
                  disabled={active === r.id}
                  title={active === r.id ? 'Already selected' : 'Compare with the selected facility'}
                >
                  {compareWith === r.id ? 'comparing' : 'compare'}
                </button>
              </div>
            );
          })}
        </div>
      </Panel>
      <div className="fr-legend">
        <span className="lg-key gross" /> Gross benefit
        <span className="lg-key transport" /> Transport
        <span className="lg-key process" /> Processing
        <span className="lg-note">
          Bars are proportional across facilities; the figure at the end is net.
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile
// ─────────────────────────────────────────────────────────────────────────────

function Profile({
  p,
  onFollow,
}: {
  p: FacilityCarbon;
  onFollow: (sourceId: string, facilityId: string) => void;
}) {
  const [openArc, setOpenArc] = useState<string | null>(null);

  const waterfall = useMemo(() => {
    const steps = [
      { key: 'gross', label: 'Gross carbon benefit', v: p.grossBenefitT, sign: 1 },
      { key: 'transport', label: 'Transport', v: -p.transportT, sign: -1 },
      { key: 'process', label: 'Processing', v: -p.processT, sign: -1 },
      { key: 'adjust', label: 'Permanence adjustment', v: -p.adjustmentT, sign: -1 },
    ].filter((s) => Math.abs(s.v) > 1e-6);
    return steps;
  }, [p]);

  const maxStep = Math.max(...waterfall.map((s) => Math.abs(s.v)), 1);
  const dominantCharge = p.transportT > p.processT ? 'transport' : 'process';

  return (
    <div className="section">
      <SectionHead title={p.name} note={`${p.pathwayLabel} · ${p.operator}`} />

      <div className="grid g2 fprofile">
        <Panel title="Transport vs processing">
          {p.receivedT <= 0 ? (
            <div className="empty">
              <h4>No carbon result for this plant</h4>
              <p>
                It received no material this window, so there is nothing to decompose. Its capacity
                and reachability are real; its carbon contribution is genuinely zero rather than
                unavailable.
              </p>
            </div>
          ) : (
            <>
              <div className="wfall">
                {waterfall.map((s) => (
                  <div key={s.key} className="wf-row">
                    <span className="wf-label">{s.label}</span>
                    <span className="wf-track">
                      <span
                        className={`wf-fill ${s.sign > 0 ? 'pos' : s.key}`}
                        style={{ width: `${(Math.abs(s.v) / maxStep) * 100}%` }}
                      />
                    </span>
                    <span className={`wf-val mono ${s.sign > 0 ? 'pos' : 'neg'}`}>
                      {s.v >= 0 ? '+' : '−'}
                      {num(Math.abs(s.v))}
                    </span>
                  </div>
                ))}
                <div className="wf-row wf-net">
                  <span className="wf-label">Net</span>
                  <span className="wf-track" />
                  <span className="wf-val mono">{num(p.netT)}</span>
                </div>
              </div>
              <div className="wf-verdict">
                {p.transportT + p.processT < 1e-6 ? (
                  'This plant books no transport or processing charge at all in the current plan.'
                ) : (
                  <>
                    <strong>
                      {dominantCharge === 'transport' ? 'Transport' : 'Processing'} dominates
                    </strong>{' '}
                    — {num(dominantCharge === 'transport' ? p.transportT : p.processT)} tCO₂e against{' '}
                    {num(dominantCharge === 'transport' ? p.processT : p.transportT)} tCO₂e for{' '}
                    {dominantCharge === 'transport' ? 'processing' : 'transport'}. Together they
                    consume{' '}
                    {pct(
                      p.grossBenefitT > 0
                        ? ((p.transportT + p.processT) / p.grossBenefitT) * 100
                        : 0,
                      1,
                    )}{' '}
                    of the gross benefit.
                  </>
                )}
              </div>
            </>
          )}
        </Panel>

        <Panel title="Why">
          <p className="fw-text">{p.why}</p>

          <div className="fw-facts">
            {[
              ['Received', `${num(p.receivedT)} t of ${num(p.capacityT)} t capacity`],
              ['Utilisation', pct(p.utilisationPct, 0)],
              ['Carbon per tonne', `${num(p.perTonneT, 3)} tCO₂e/t`],
              ['Share of network net', pct(p.sharePct, 1)],
              ['Conversion efficiency', pct(p.efficiency * 100, 0)],
              ['Plant power', p.powerSource.replace(/_/g, ' ')],
            ].map(([k, v]) => (
              <div key={k} className="fw-fact">
                <span>{k}</span>
                <span className="mono">{v}</span>
              </div>
            ))}
          </div>

          {p.shadow && (
            <div className="fw-shadow">
              <strong>Marginal capacity value</strong>
              {p.shadow.binding ? (
                <>
                  {' '}
                  Capacity is binding. One more tonne of throughput is worth{' '}
                  <span className="mono">{num(p.shadow.carbonPerExtraTonne, 3)}</span> tCO₂e,
                  measured by re-optimising the network with the constraint relaxed.
                </>
              ) : (
                ' Capacity is not binding here, so extra throughput would add nothing on its own.'
              )}
            </div>
          )}

          <div className="fw-links">
            <Link to="/carbon/pathways" className="btn sm">
              Compare pathways
            </Link>
            <Link to="/scenarios" className="btn sm">
              Simulate a change
            </Link>
            <Link to="/economics" className="btn sm">
              Economics
            </Link>
          </div>
        </Panel>
      </div>

      {p.arcs.length > 0 && (
        <>
          <SectionHead
            title="What feeds it"
            note="Each arc is an allocation in the current plan · open one to trace it in the Ledger"
          />
          <Panel flush>
            <div className="farcs">
              <FeedMap p={p} highlight={openArc} />
              <div className="fa-list">
                {p.arcs.map((a) => {
                  const on = openArc === a.sourceId;
                  return (
                    <div key={a.sourceId} className={`fa-row ${on ? 'on' : ''}`}>
                      <button
                        className="fa-main"
                        onClick={() => setOpenArc(on ? null : a.sourceId)}
                        aria-expanded={on}
                      >
                        <span className="fa-name">{a.sourceName}</span>
                        <span className="fa-sub">
                          {a.streamLabel} · {a.district}
                        </span>
                      </button>
                      <span className="fa-t mono">{num(a.tonnes)} t</span>
                      <span className="fa-km mono">{num(a.distanceKm)} km</span>
                      <span className="fa-share">
                        <span className="fas-track">
                          <span
                            className="fas-fill"
                            style={{ width: `${Math.max(0, Math.min(100, a.sharePct))}%` }}
                          />
                        </span>
                      </span>
                      <span className={`fa-net mono ${a.netCarbonT >= 0 ? 'pos' : 'neg'}`}>
                        {num(a.netCarbonT)}
                      </span>
                      {on && (
                        <div className="fa-detail">
                          <ul className="dd-list">
                            <li>
                              <span>Carbon per tonne</span>
                              <span className="mono">{num(a.carbonPerT, 3)} tCO₂e/t</span>
                            </li>
                            <li>
                              <span>Share of this plant</span>
                              <span className="mono">{pct(a.sharePct, 1)}</span>
                            </li>
                            <li>
                              <span>Transport charge</span>
                              <span className="mono">{num(a.transportT)} tCO₂e</span>
                            </li>
                            <li>
                              <span>Vehicle</span>
                              <span className="mono">{a.vehicleId.replace(/_/g, ' ')}</span>
                            </li>
                            <li>
                              <span>Trips</span>
                              <span className="mono">{num(a.trips)}</span>
                            </li>
                          </ul>
                          <button className="btn sm" onClick={() => onFollow(a.sourceId, p.id)}>
                            Follow carbon in the Ledger
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>
        </>
      )}

      {p.opportunities.length > 0 && (
        <>
          <SectionHead
            title="Opportunities"
            note="Only shown where the engine can price the change"
          />
          <div className="fopps">
            {p.opportunities.map((o) => (
              <div key={o.kind} className="fo-item">
                <div className="fo-head">
                  <span className="fo-what">{o.what}</span>
                  <span className="fo-delta mono pos">
                    +{num(o.carbonDeltaT)} tCO₂e
                  </span>
                </div>
                <p className="fo-why">{o.why}</p>
                <Link
                  to={o.action === 'simulate' || o.action === 'objective' ? '/scenarios' : '/carbon/ledger'}
                  className="btn sm"
                >
                  {o.actionLabel}
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="fq-status">
        <span className="q-tag">Modelled estimate</span>
        This plant's ledger is built from the allocations arriving at it, through the network's own
        ledger function and under the network's dominant biochar feedstock — so the facilities sum
        to the network figure exactly. A planning-window result, not measured historical emissions.
        Not verified and not a carbon credit.
      </div>
    </div>
  );
}

/**
 * Where the plant's carbon comes from, geographically.
 *
 * Line weight is the tonnage on the arc and colour marks its carbon contribution,
 * so the picture answers "which haul is costing me" rather than decorating the page.
 */
function FeedMap({ p, highlight }: { p: FacilityCarbon; highlight: string | null }) {
  const W = 560;
  const H = 210;
  const pad = 40;

  const pts = [...p.arcs.map((a) => ({ lat: a.lat, lon: a.lon })), { lat: p.lat, lon: p.lon }];
  const lats = pts.map((x) => x.lat);
  const lons = pts.map((x) => x.lon);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const spanLon = maxLon - minLon || 0.02;
  const spanLat = maxLat - minLat || 0.02;

  const x = (lon: number) => pad + ((lon - minLon) / spanLon) * (W - 2 * pad);
  const y = (lat: number) => H - pad - ((lat - minLat) / spanLat) * (H - 2 * pad);

  const fx = x(p.lon);
  const fy = y(p.lat);
  const maxT = Math.max(...p.arcs.map((a) => a.tonnes), 1);

  return (
    <svg className="feedmap" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Sources feeding this facility">
      {p.arcs.map((a) => {
        const sx = x(a.lon);
        const sy = y(a.lat);
        const cx = (sx + fx) / 2;
        const cy = (sy + fy) / 2 - 18;
        const dim = highlight !== null && highlight !== a.sourceId;
        return (
          <g key={a.sourceId} className={`fm-arc ${dim ? 'dim' : ''} ${highlight === a.sourceId ? 'lit' : ''}`}>
            <path
              d={`M${sx},${sy} Q${cx},${cy} ${fx},${fy}`}
              style={{ strokeWidth: 1 + (a.tonnes / maxT) * 3.5 }}
            />
            <circle cx={sx} cy={sy} r={3.2} className="fm-src" />
          </g>
        );
      })}
      <circle cx={fx} cy={fy} r={7} className="fm-fac" />
      <text x={fx} y={fy + 20} className="fm-lab" textAnchor="middle">
        {p.name}
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparison
// ─────────────────────────────────────────────────────────────────────────────

function Comparison({
  data,
  loading,
  error,
  onClose,
}: {
  data: FacilityComparison | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <div className="section">
      <SectionHead title="Side by side">
        <button className="btn sm" onClick={onClose}>
          Close
        </button>
      </SectionHead>
      <Panel>
        {loading && <div className="loadstate"><div className="msg">Comparing…</div></div>}
        {error && <ErrorState message={error} />}
        {data && (
          <>
            <p className="cmp-summary">{data.summary}</p>
            <table className="cmp-table">
              <thead>
                <tr>
                  <th />
                  <th>
                    {data.a.name}
                    <span className="cmp-p">{data.a.pathwayShort}</span>
                  </th>
                  <th>
                    {data.b.name}
                    <span className="cmp-p">{data.b.pathwayShort}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const aWins = r.higherIsBetter ? r.a > r.b : r.a < r.b;
                  const tie = Math.abs(r.a - r.b) < 1e-9;
                  const dp = r.unit === 'tCO₂e/t' ? 3 : r.unit === '%' ? 0 : 0;
                  return (
                    <tr key={r.key}>
                      <td className="cmp-lab">
                        {r.label}
                        <span className="cmp-u">{r.unit}</span>
                      </td>
                      <td className={`mono ${!tie && aWins ? 'win' : ''}`}>{num(r.a, dp)}</td>
                      <td className={`mono ${!tie && !aWins ? 'win' : ''}`}>{num(r.b, dp)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {data.sharedSources.length > 0 ? (
              <div className="cmp-shared">
                <h5>Sources that can reach both</h5>
                <table className="cmp-table">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>{data.a.pathwayShort} tCO₂e/t · km</th>
                      <th>{data.b.pathwayShort} tCO₂e/t · km</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sharedSources.map((s) => (
                      <tr key={s.sourceId}>
                        <td className="cmp-lab">{s.name}</td>
                        <td className={`mono ${(s.aPerT ?? 0) >= (s.bPerT ?? 0) ? 'win' : ''}`}>
                          {num(s.aPerT ?? 0, 3)} · {num(s.aKm ?? 0)} km
                        </td>
                        <td className={`mono ${(s.bPerT ?? 0) > (s.aPerT ?? 0) ? 'win' : ''}`}>
                          {num(s.bPerT ?? 0, 3)} · {num(s.bKm ?? 0)} km
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="cmp-note">
                  These rows are arc-for-arc: the same material evaluated into both plants, so the
                  difference is the plants and the haul rather than a difference in what they
                  happen to receive.
                </p>
              </div>
            ) : (
              <p className="cmp-note">
                No source can currently reach both plants, so only their aggregate results can be
                set against each other. The averages above describe different material and are not
                a like-for-like comparison.
              </p>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
