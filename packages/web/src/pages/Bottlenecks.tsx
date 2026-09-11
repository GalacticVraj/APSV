/**
 * Bottlenecks — findings, shadow prices, stranding, resilience.
 *
 * The point of the screen: turn "the network is constrained" into "spend the next
 * rupee here, and here is what it returns". Shadow prices are measured by
 * re-optimising the whole network with one extra tonne per day of headroom at each
 * binding facility, so the number includes every knock-on reallocation.
 */

import { api, useResource, useTwin } from '../store.tsx';
import {
  DataTable,
  Empty,
  ErrorState,
  Loading,
  Panel,
  SectionHead,
  Stat,
  StatStrip,
  Tag,
  MiniBar,
} from '../components/Primitives.tsx';
import { BarList } from '../components/Charts.tsx';
import { inr, num, pct, titleCase, km } from '../format.ts';
import type { Severity } from '../../../engine/src/types.ts';

const SEV_TONE: Record<Severity, 'red' | 'amber' | 'blue' | undefined> = {
  critical: 'red',
  high: 'amber',
  moderate: undefined,
  low: undefined,
};

export default function Bottlenecks() {
  const { boot, state, optimization, version } = useTwin();
  const bn = useResource(() => api.bottlenecks(), [version], [
    'Checking facility utilisation against capacity…',
    'Attributing every stranded lot to a cause…',
    'Scoring source opportunity…',
  ]);
  const rs = useResource(() => api.resilience(), [version], [
    'Taking each facility offline in turn…',
    'Re-optimising the network for every contingency…',
    'Scoring single-point exposure and re-routability…',
  ]);

  if (!boot || !state || !optimization) return <Loading message="Loading…" />;

  const shadow = optimization.result.shadowPrices.filter((s) => s.binding);
  const streams = boot.reference.streams as Record<string, { label: string }>;
  const windowDays = state.assumptions.windowDays;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Bottlenecks &amp; Resilience</h1>
          <div className="lede">
            What is limiting the network, what it costs, and what fixing it is worth. Every finding
            carries a quantified consequence and a priced action.
          </div>
        </div>
      </div>

      {/* Shadow prices — the most actionable output in the product */}
      <div className="section">
        <SectionHead
          title="Where the next tonne of capacity is worth most"
          note="Measured by re-optimisation, not read off a dual"
        />
        {shadow.length === 0 ? (
          <Empty
            title="No capacity constraint is binding"
            body="No facility is at its limit, so additional throughput has zero marginal value right now. Whatever is limiting the network is elsewhere — look at the findings below."
          />
        ) : (
          <Panel flush>
            <DataTable
              rows={shadow}
              rowKey={(s) => s.facilityId}
              initialSort="carbon"
              columns={[
                {
                  key: 'name',
                  header: 'Facility',
                  render: (s) => <span className="name">{s.facilityName}</span>,
                  sort: (s) => s.facilityName,
                },
                {
                  key: 'util',
                  header: 'Utilisation',
                  num: true,
                  sort: (s) => s.utilisationPct,
                  render: (s) => (
                    <>
                      {pct(s.utilisationPct, 0)}
                      <MiniBar value={s.utilisationPct} max={100} tone="amber" />
                    </>
                  ),
                },
                {
                  key: 'carbon',
                  header: 'Marginal carbon',
                  num: true,
                  sort: (s) => s.carbonPerExtraTonne,
                  render: (s) => (
                    <strong className="pos">{s.carbonPerExtraTonne.toFixed(3)} tCO₂e/t</strong>
                  ),
                },
                {
                  key: 'margin',
                  header: 'Marginal margin',
                  num: true,
                  sort: (s) => s.marginPerExtraTonne,
                  render: (s) => <strong>{inr(s.marginPerExtraTonne)}/t</strong>,
                },
                {
                  key: 'ten',
                  header: 'Value of +10 t/day per window',
                  num: true,
                  sort: (s) => s.marginPerExtraTonne * 10 * windowDays,
                  render: (s) => (
                    <>
                      {num(s.carbonPerExtraTonne * 10 * windowDays)} tCO₂e
                      <br />
                      <span className="muted">{inr(s.marginPerExtraTonne * 10 * windowDays)}</span>
                    </>
                  ),
                },
              ]}
            />
            <div style={{ padding: '9px 12px', fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.55 }}>
              For each binding facility the optimiser is re-run with one additional tonne per day of
              headroom and the objective difference is recorded. Because binary
              facility-operating decisions are in play, an LP dual read off a single basis would not
              capture the knock-on reallocations that this does.
            </div>
          </Panel>
        )}
      </div>

      {/* Findings */}
      <div className="section">
        <SectionHead title="Findings" note={bn.data ? `${bn.data.bottlenecks.length} detected` : undefined} />
        {bn.loading ? (
          <Loading message={bn.message} />
        ) : bn.error ? (
          <ErrorState message={bn.error} onRetry={bn.reload} />
        ) : bn.data && bn.data.bottlenecks.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bn.data.bottlenecks.map((b) => (
              <div className="panel" key={b.id}>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                    <Tag tone={SEV_TONE[b.severity]}>{b.severity}</Tag>
                    <strong style={{ fontSize: 13.5 }}>{b.title}</strong>
                    <span className="muted" style={{ marginLeft: 'auto', fontSize: 11 }}>
                      {titleCase(b.kind)}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                    {b.detail}
                  </p>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 14,
                      borderTop: '1px solid var(--rule)',
                      paddingTop: 9,
                    }}
                  >
                    <div>
                      <div className="stat-label">Recommended action</div>
                      <p style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.55 }}>
                        {b.recommendation}
                      </p>
                    </div>
                    <div>
                      <div className="stat-label">Quantified upside</div>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                        {b.quantifiedUpside}
                      </p>
                      {(b.carbonAtRiskT > 1 || b.valueAtRiskInr > 1) && (
                        <div style={{ marginTop: 6, fontSize: 12 }} className="num">
                          {b.carbonAtRiskT > 1 && (
                            <span>
                              {num(b.carbonAtRiskT)} tCO₂e
                              {b.valueAtRiskInr > 1 ? ' · ' : ''}
                            </span>
                          )}
                          {b.valueAtRiskInr > 1 && <span>{inr(b.valueAtRiskInr)}</span>}
                          <span className="muted"> at stake per window</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="No bottlenecks detected"
            body="No facility is capacity-bound, no stream is without a viable pathway, and the fleet has headroom."
          />
        )}
      </div>

      {/* Stranding */}
      <div className="section">
        <SectionHead
          title="Stranded feedstock"
          note="Every lot carries an attributed reason, not a blank 'unallocated'"
        />
        {bn.loading ? (
          <Loading message={bn.message} />
        ) : bn.data ? (
          bn.data.stranded.length === 0 ? (
            <Empty
              title="Nothing is stranded"
              body="The network placed every available tonne this window."
            />
          ) : (
            <div className="grid g-3-2">
              <Panel flush>
                <DataTable
                  rows={bn.data.stranded}
                  rowKey={(s) => s.sourceId}
                  initialSort="t"
                  maxHeight={380}
                  columns={[
                    {
                      key: 'name',
                      header: 'Source',
                      render: (s) => <span className="name">{s.name}</span>,
                      sort: (s) => s.name,
                    },
                    {
                      key: 'stream',
                      header: 'Stream',
                      render: (s) => streams[s.stream]?.label ?? s.stream,
                      sort: (s) => s.stream,
                    },
                    {
                      key: 't',
                      header: 'Stranded',
                      num: true,
                      sort: (s) => s.tonnes,
                      render: (s) => <strong>{num(s.tonnes)} t</strong>,
                    },
                    {
                      key: 'near',
                      header: 'Nearest site',
                      num: true,
                      sort: (s) => s.nearestFacilityKm ?? 9999,
                      render: (s) => (s.nearestFacilityKm != null ? km(s.nearestFacilityKm) : '—'),
                    },
                    {
                      key: 'reason',
                      header: 'Why',
                      render: (s) => (
                        <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{s.reasonText}</span>
                      ),
                    },
                  ]}
                />
              </Panel>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Panel title="Stranding by cause">
                  <BarList
                    rows={Object.entries(
                      bn.data.stranded.reduce<Record<string, number>>((acc, s) => {
                        acc[titleCase(s.reason)] = (acc[titleCase(s.reason)] ?? 0) + s.tonnes;
                        return acc;
                      }, {}),
                    )
                      .map(([label, value]) => ({ label, value }))
                      .sort((a, b) => b.value - a.value)}
                    format={(v) => `${num(v)} t`}
                    colorFor={() => 'var(--neg)'}
                  />
                </Panel>
                <Panel title="Consequence if nothing changes">
                  <div className="stat-value sm">
                    {num(bn.data.stranded.reduce((s, l) => s + l.counterfactualEmissionsT, 0))}
                    <span className="stat-unit">tCO₂e</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.55 }}>
                    of avoidable non-CO₂ emissions this window, as the stranded material goes to its
                    counterfactual fate — mostly in-field burning and unmanaged disposal.
                  </p>
                  <p style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.5 }}>
                    The crop-residue share also carries roughly 7.4 kg of PM₂.₅ per dry tonne. That
                    is not counted as CO₂e anywhere in this product, but it is the reason the
                    problem is politically urgent.
                  </p>
                </Panel>
              </div>
            </div>
          )
        ) : null}
      </div>

      {/* Resilience */}
      <div className="section">
        <SectionHead title="Network resilience" note="N-1 contingency analysis" />
        {rs.loading ? (
          <Loading message={rs.message} />
        ) : rs.error ? (
          <ErrorState message={rs.error} onRetry={rs.reload} />
        ) : rs.data ? (
          <>
            <StatStrip>
              <Stat
                label="Resilience score"
                value={rs.data.score.toFixed(0)}
                unit="/ 100"
                sub={rs.data.grade}
                size="lg"
                tone={
                  rs.data.score >= 80
                    ? 'pos'
                    : rs.data.score >= 65
                      ? undefined
                      : rs.data.score >= 50
                        ? 'warnc'
                        : 'neg'
                }
              />
              <Stat
                label="Worst single outage"
                value={pct(rs.data.worstCaseLossPct, 1)}
                sub={rs.data.worstCaseFacilityName}
                tone="neg"
              />
              <Stat label="Mean contingency loss" value={pct(rs.data.meanLossPct, 1)} sub={`across ${rs.data.n1Results.length} outages`} />
              {rs.data.components.map((c) => (
                <Stat key={c.label} label={c.label} value={c.value.toFixed(0)} sub={`weight ${pct(c.weight * 100, 0)}`} />
              ))}
            </StatStrip>

            <div className="grid g-2-1" style={{ marginTop: 14 }}>
              <Panel title="Single-facility contingencies" flush>
                <DataTable
                  rows={rs.data.n1Results}
                  rowKey={(x) => x.facilityId}
                  initialSort="loss"
                  maxHeight={320}
                  columns={[
                    {
                      key: 'name',
                      header: 'If this facility goes offline',
                      render: (x) => <span className="name">{x.facilityName}</span>,
                      sort: (x) => x.facilityName,
                    },
                    {
                      key: 'loss',
                      header: 'Net carbon lost',
                      num: true,
                      sort: (x) => x.lossPct,
                      render: (x) => (
                        <>
                          <span className={x.lossPct > 10 ? 'neg' : ''}>{pct(x.lossPct, 1)}</span>
                          <MiniBar value={x.lossPct} max={Math.max(1, rs.data!.worstCaseLossPct)} tone="neg" />
                        </>
                      ),
                    },
                    {
                      key: 'stranded',
                      header: 'Extra stranded',
                      num: true,
                      sort: (x) => x.strandedT,
                      render: (x) => `${num(x.strandedT)} t`,
                    },
                    {
                      key: 'absorbed',
                      header: 'Absorbed by',
                      render: (x) => (
                        <span className="muted" style={{ fontSize: 11.5 }}>
                          {x.absorbedBy.length === 0
                            ? 'nothing — the tonnage is simply lost'
                            : `${x.absorbedBy.length} site${x.absorbedBy.length === 1 ? '' : 's'}`}
                        </span>
                      ),
                    },
                  ]}
                />
              </Panel>

              <Panel title="How the score is built">
                {rs.data.components.map((c) => (
                  <div key={c.label} style={{ marginBottom: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span>{c.label}</span>
                      <span className="num">
                        {c.value.toFixed(0)} × {c.weight.toFixed(2)}
                      </span>
                    </div>
                    <MiniBar value={c.value} max={100} />
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.45 }}>
                      {c.note}
                    </div>
                  </div>
                ))}
                <hr className="hairline" />
                <p style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.55, margin: 0 }}>
                  {rs.data.method}
                </p>
              </Panel>
            </div>
          </>
        ) : null}
      </div>

      {/* Opportunity */}
      <div className="section">
        <SectionHead
          title="Opportunity score by source"
          note="Volume, proximity, carbon potential, conversion value, transport burden, facility availability"
        />
        {bn.data && (
          <Panel flush>
            <DataTable
              rows={bn.data.opportunities}
              rowKey={(o) => o.sourceId}
              initialSort="score"
              maxHeight={420}
              columns={[
                {
                  key: 'name',
                  header: 'Source',
                  render: (o) => <span className="name">{o.name}</span>,
                  sort: (o) => o.name,
                },
                {
                  key: 'stream',
                  header: 'Stream',
                  render: (o) => streams[o.stream]?.label ?? o.stream,
                  sort: (o) => o.stream,
                },
                { key: 't', header: 'Available', num: true, sort: (o) => o.tonnes, render: (o) => `${num(o.tonnes)} t` },
                {
                  key: 'score',
                  header: 'Score',
                  num: true,
                  sort: (o) => o.score,
                  render: (o) => (
                    <>
                      <strong>{o.score.toFixed(1)}</strong>
                      <MiniBar value={o.score} max={100} />
                    </>
                  ),
                },
                {
                  key: 'carbon',
                  header: 'Carbon',
                  num: true,
                  sort: (o) => o.components.carbonPotential,
                  render: (o) => pct(o.components.carbonPotential * 100, 0),
                },
                {
                  key: 'value',
                  header: 'Value',
                  num: true,
                  sort: (o) => o.components.conversionValue,
                  render: (o) => pct(o.components.conversionValue * 100, 0),
                },
                {
                  key: 'prox',
                  header: 'Proximity',
                  num: true,
                  sort: (o) => o.components.proximity,
                  render: (o) => pct(o.components.proximity * 100, 0),
                },
                {
                  key: 'note',
                  header: 'Status',
                  render: (o) => <span className="muted" style={{ fontSize: 11.5 }}>{o.note}</span>,
                },
              ]}
            />
          </Panel>
        )}
      </div>
    </div>
  );
}
