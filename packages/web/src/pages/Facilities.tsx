/**
 * Facilities — processing infrastructure.
 *
 * The table answers "which asset should I worry about". The detail panel answers
 * "and what should I do about it", using the measured marginal value of capacity
 * rather than a utilisation percentage, which on its own tells an operator nothing.
 */

import { useState } from 'react';
import { api, useResource, useTwin } from '../store.tsx';
import {
  DataTable,
  Empty,
  Loading,
  MiniBar,
  Notice,
  Panel,
  SectionHead,
  Stat,
  StatStrip,
  StatusDot,
  Tag,
} from '../components/Primitives.tsx';
import { BarList } from '../components/Charts.tsx';
import { PATHWAY_SHORT } from '../components/NetworkMap.tsx';
import { inr, num, pct, km } from '../format.ts';
import type { PathwayId, StreamId } from '../../../engine/src/types.ts';

export default function Facilities() {
  const { boot, state, optimization, version } = useTwin();
  const [selected, setSelected] = useState<string | null>(null);
  const pw = useResource(
    () => api.pathways((state?.sources[0]?.stream ?? 'paddy_straw') as StreamId),
    [version],
    ['Comparing pathways…'],
  );

  if (!boot || !state || !optimization) return <Loading message="Loading facilities…" />;

  const pathways = boot.reference.pathways as Record<string, any>;
  const streams = boot.reference.streams as Record<string, any>;
  const windowDays = state.assumptions.windowDays;
  const r = optimization.result;

  const load = new Map<string, number>();
  const carbon = new Map<string, number>();
  const margin = new Map<string, number>();
  for (const a of r.allocations) {
    load.set(a.facilityId, (load.get(a.facilityId) ?? 0) + a.tonnes);
    carbon.set(a.facilityId, (carbon.get(a.facilityId) ?? 0) + a.netCarbonT);
    margin.set(a.facilityId, (margin.get(a.facilityId) ?? 0) + a.marginInr);
  }

  const rows = state.facilities.map((f) => {
    const cap = f.capacityTpd * f.availability * windowDays;
    const l = load.get(f.id) ?? 0;
    return {
      ...f,
      capWindow: cap,
      load: l,
      util: cap > 0 ? (l / cap) * 100 : 0,
      carbon: carbon.get(f.id) ?? 0,
      margin: margin.get(f.id) ?? 0,
      intensity: l > 0 ? (carbon.get(f.id) ?? 0) / l : 0,
      marginPerT: l > 0 ? (margin.get(f.id) ?? 0) / l : 0,
      shadow: r.shadowPrices.find((s) => s.facilityId === f.id),
    };
  });

  const sel = selected ? rows.find((x) => x.id === selected) : null;
  const feeds = sel ? r.allocations.filter((a) => a.facilityId === sel.id) : [];

  const byPathwayCapacity = (() => {
    const m = new Map<string, { cap: number; used: number }>();
    for (const f of rows) {
      const e = m.get(f.pathway) ?? { cap: 0, used: 0 };
      e.cap += f.capWindow;
      e.used += f.load;
      m.set(f.pathway, e);
    }
    return [...m.entries()].map(([k, v]) => ({
      label: PATHWAY_SHORT[k as PathwayId],
      value: v.used,
      sub: `${num(v.used)} of ${num(v.cap)} t capacity · ${pct(v.cap > 0 ? (v.used / v.cap) * 100 : 0, 0)}`,
    }));
  })();

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Processing Facilities</h1>
          <div className="lede">
            {num(state.facilities.length)} sites across five conversion pathways.{' '}
            {r.openFacilities.length} operating this window; {r.idleFacilities.length} below minimum
            viable feed.
          </div>
        </div>
      </div>

      <div className="section">
        <StatStrip>
          <Stat
            label="Total capacity"
            value={num(rows.reduce((a, f) => a + f.capWindow, 0))}
            unit="t"
            sub={`${num(state.facilities.reduce((a, f) => a + f.capacityTpd, 0))} t/day nameplate`}
          />
          <Stat
            label="Throughput"
            value={num(rows.reduce((a, f) => a + f.load, 0))}
            unit="t"
            sub={pct(
              (rows.reduce((a, f) => a + f.load, 0) /
                Math.max(1, rows.reduce((a, f) => a + f.capWindow, 0))) *
                100,
              1,
            )}
          />
          <Stat label="Operating" value={`${r.openFacilities.length}/${rows.length}`} />
          <Stat
            label="At capacity"
            value={num(rows.filter((f) => f.util >= 97).length)}
            sub="binding constraints"
            tone="warnc"
          />
          <Stat
            label="Best carbon intensity"
            value={
              rows.filter((f) => f.load > 0).sort((a, b) => b.intensity - a.intensity)[0]?.intensity.toFixed(2) ??
              '—'
            }
            unit="tCO₂e/t"
            sub={rows.filter((f) => f.load > 0).sort((a, b) => b.intensity - a.intensity)[0]?.name}
          />
          <Stat
            label="Best margin"
            value={inr(
              rows.filter((f) => f.load > 0).sort((a, b) => b.marginPerT - a.marginPerT)[0]?.marginPerT ?? 0,
            )}
            unit="/t"
            sub={rows.filter((f) => f.load > 0).sort((a, b) => b.marginPerT - a.marginPerT)[0]?.name}
          />
        </StatStrip>
      </div>

      <div className="section">
        <div className="grid g-3-2">
          <Panel flush>
            <DataTable
              rows={rows}
              rowKey={(f) => f.id}
              onRowClick={(f) => setSelected(f.id === selected ? null : f.id)}
              selectedKey={selected}
              initialSort="util"
              maxHeight={520}
              columns={[
                {
                  key: 'name',
                  header: 'Facility',
                  render: (f) => (
                    <span className="name">
                      <StatusDot status={f.status} /> {f.name}
                    </span>
                  ),
                  sort: (f) => f.name,
                },
                {
                  key: 'pathway',
                  header: 'Pathway',
                  render: (f) => PATHWAY_SHORT[f.pathway],
                  sort: (f) => f.pathway,
                },
                { key: 'district', header: 'District', render: (f) => f.district, sort: (f) => f.district },
                {
                  key: 'cap',
                  header: 'Capacity',
                  num: true,
                  sort: (f) => f.capacityTpd,
                  render: (f) => `${num(f.capacityTpd)} t/d`,
                },
                {
                  key: 'util',
                  header: 'Utilisation',
                  num: true,
                  sort: (f) => f.util,
                  render: (f) => (
                    <>
                      <span className={f.util >= 97 ? 'warnc' : f.util === 0 ? 'muted' : 'pos'}>
                        {pct(f.util, 0)}
                      </span>
                      <MiniBar value={f.util} max={100} tone={f.util >= 97 ? 'amber' : undefined} />
                    </>
                  ),
                },
                {
                  key: 'carbon',
                  header: 'Net carbon',
                  num: true,
                  sort: (f) => f.carbon,
                  render: (f) => (f.load > 0 ? `${num(f.carbon)} t` : '—'),
                },
                {
                  key: 'intensity',
                  header: 'tCO₂e/t',
                  num: true,
                  sort: (f) => f.intensity,
                  render: (f) => (f.load > 0 ? f.intensity.toFixed(2) : '—'),
                },
                {
                  key: 'margin',
                  header: 'Margin/t',
                  num: true,
                  sort: (f) => f.marginPerT,
                  render: (f) =>
                    f.load > 0 ? (
                      <span className={f.marginPerT < 0 ? 'neg' : ''}>{inr(f.marginPerT)}</span>
                    ) : (
                      '—'
                    ),
                },
                {
                  key: 'shadow',
                  header: 'Marginal value',
                  num: true,
                  sort: (f) => f.shadow?.marginPerExtraTonne ?? -1,
                  render: (f) =>
                    f.shadow?.binding ? (
                      <strong>{inr(f.shadow.marginPerExtraTonne)}/t</strong>
                    ) : (
                      <span className="muted">—</span>
                    ),
                },
              ]}
            />
          </Panel>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {!sel ? (
              <>
                <Panel title="Throughput by pathway">
                  <BarList rows={byPathwayCapacity} format={(v) => `${num(v)} t`} />
                </Panel>
                <Empty
                  title="No facility selected"
                  body="Pick a row to see its feedstock mix, economics and whether its capacity is the binding constraint."
                />
              </>
            ) : (
              <>
                <Panel
                  title={sel.name}
                  right={<><StatusDot status={sel.status} /> {sel.status}</>}
                >
                  <dl className="kv">
                    <dt>Operator</dt>
                    <dd>{sel.operator}</dd>
                    <dt>Pathway</dt>
                    <dd>{pathways[sel.pathway].short}</dd>
                    <dt>Commissioned</dt>
                    <dd>{sel.commissioned}</dd>
                    <dt>Nameplate</dt>
                    <dd>{num(sel.capacityTpd)} t/day</dd>
                    <dt>Minimum viable feed</dt>
                    <dd>{num(sel.minFeedTpd)} t/day</dd>
                    <dt>Efficiency multiplier</dt>
                    <dd>{sel.efficiency.toFixed(2)}×</dd>
                    <dt>Opex</dt>
                    <dd>{inr(sel.opexInrPerT)}/t</dd>
                    <dt>Capital charge</dt>
                    <dd>{inr(sel.capexAmortInrPerT)}/t</dd>
                    <dt>Power source</dt>
                    <dd>{sel.powerSource.replace(/_/g, ' ')}</dd>
                  </dl>

                  <div style={{ marginTop: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                      <span className="muted">Utilisation</span>
                      <span className="num">
                        {num(sel.load)} / {num(sel.capWindow)} t
                      </span>
                    </div>
                    <MiniBar value={sel.util} max={100} tone={sel.util >= 97 ? 'amber' : undefined} />
                  </div>

                  {sel.shadow?.binding && (
                    <Notice>
                      <strong>Capacity-bound.</strong> One additional tonne per day returns{' '}
                      {sel.shadow.carbonPerExtraTonne.toFixed(3)} tCO₂e and{' '}
                      {inr(sel.shadow.marginPerExtraTonne)}. Over a {windowDays}-day window, a
                      10 t/day expansion is worth{' '}
                      {num(sel.shadow.carbonPerExtraTonne * 10 * windowDays)} tCO₂e and{' '}
                      {inr(sel.shadow.marginPerExtraTonne * 10 * windowDays)}.
                    </Notice>
                  )}

                  {sel.load === 0 && (
                    <Notice>
                      <strong>Idle.</strong> The optimiser could not assemble{' '}
                      {num(sel.minFeedTpd * windowDays)} t of compatible feedstock within this site's
                      catchment, which is its minimum viable feed. Running below that does not cover
                      fixed cost, so the solver shut it rather than operate it at a loss.
                    </Notice>
                  )}
                </Panel>

                <Panel title={`Feedstock received (${feeds.length})`} flush>
                  {feeds.length === 0 ? (
                    <Empty title="No inbound feedstock" body="This site is not operating this window." />
                  ) : (
                    <DataTable
                      rows={feeds}
                      rowKey={(a) => a.sourceId}
                      initialSort="t"
                      maxHeight={260}
                      columns={[
                        {
                          key: 'src',
                          header: 'Source',
                          render: (a) => (
                            <span className="name">
                              {state.sources.find((s) => s.id === a.sourceId)?.name ?? a.sourceId}
                            </span>
                          ),
                        },
                        {
                          key: 'stream',
                          header: 'Stream',
                          render: (a) => streams[a.stream].label,
                          sort: (a) => a.stream,
                        },
                        { key: 't', header: 'Tonnes', num: true, sort: (a) => a.tonnes, render: (a) => num(a.tonnes) },
                        { key: 'd', header: 'Haul', num: true, sort: (a) => a.distanceKm, render: (a) => km(a.distanceKm) },
                        { key: 'trips', header: 'Trips', num: true, sort: (a) => a.trips, render: (a) => num(a.trips) },
                      ]}
                    />
                  )}
                </Panel>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
