/**
 * Waste Sources — inventory and forecasting.
 *
 * A table, because a table is the right instrument for forty-two comparable
 * objects. Selecting a row opens its forecast and its pathway options, which is
 * the pair of questions an aggregator actually has about a lot of feedstock:
 * how much will there be, and what is it worth.
 */

import { useState } from 'react';
import { api, useResource, useTwin } from '../store.tsx';
import {
  DataTable,
  Empty,
  ErrorState,
  Loading,
  MiniBar,
  Panel,
  SectionHead,
  Stat,
  StatStrip,
  Tag,
  DecisionBanner,
  ValueFlowChain,
} from '../components/Primitives.tsx';
import { ForecastChart } from '../components/Charts.tsx';
import { inr, num, pct, dateShort } from '../format.ts';
import type { StreamId } from '../../../engine/src/types.ts';

export default function Sources() {
  const { boot, state, optimization, version } = useTwin();
  const fc = useResource(() => api.forecast(), [version], [
    'Generating supply history from the crop calendar…',
    'Fitting ridge models with Fourier seasonality…',
    'Running walk-forward backtests…',
  ]);
  const [selected, setSelected] = useState<string | null>(null);
  const [streamFilter, setStreamFilter] = useState<string>('all');

  if (!boot || !state || !optimization) return <Loading message="Loading sources…" />;

  const streams = boot.reference.streams as Record<string, any>;
  const season = boot.reference.season as Record<string, { note: string }>;
  const allocated = new Map<string, number>();
  for (const a of optimization.result.allocations) {
    allocated.set(a.sourceId, (allocated.get(a.sourceId) ?? 0) + a.tonnes);
  }

  const rows = state.sources
    .filter((s) => streamFilter === 'all' || s.stream === streamFilter)
    .map((s) => ({
      ...s,
      allocatedT: allocated.get(s.id) ?? 0,
      sharePct: s.availableT > 0 ? ((allocated.get(s.id) ?? 0) / s.availableT) * 100 : 0,
      mape: fc.data?.bySource[s.id]?.backtestMapePct ?? null,
    }));

  const sel = selected ? state.sources.find((s) => s.id === selected) : null;
  const selForecast = selected ? fc.data?.bySource[selected] : null;

  const totalAvail = rows.reduce((a, s) => a + s.availableT, 0);
  const totalAlloc = rows.reduce((a, s) => a + s.allocatedT, 0);
  const maxAvail = Math.max(...rows.map((r) => r.availableT), 1);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Waste Sources</h1>
          <div className="lede">
            {num(state.sources.length)} aggregation points across {boot.product.region}. Availability
            is the tonnage collectable within the {state.assumptions.windowDays}-day window.
          </div>
        </div>
        <div className="head-actions">
          <select
            className="inp"
            style={{ width: 200 }}
            value={streamFilter}
            onChange={(e) => setStreamFilter(e.target.value)}
            aria-label="Filter by stream"
          >
            <option value="all">All streams</option>
            {Object.keys(streams).map((s) => (
              <option key={s} value={s}>
                {streams[s].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="section">
        <DecisionBanner
          badge="Waste Inventory & Supply State"
          happening={
            <>
              <strong>{num(totalAvail)} t available</strong> across {rows.length} aggregation points. {num(totalAlloc)} t ({pct(totalAvail > 0 ? (totalAlloc / totalAvail) * 100 : 0, 0)}) collected.
            </>
          }
          why={
            <>
              {num(totalAvail - totalAlloc)} t remains unplaced due to transport radius limits or C:N/ash chemistry mismatches.
            </>
          }
          action="Examine supply forecasts and gate prices to contract high-density seasonal crop residues."
          actionLabel="View Optimization Strategy →"
          to="/optimization"
        />

        {sel && (
          <ValueFlowChain
            title={`Source Inventory Flow Chain — ${sel.name}`}
            steps={[
              { label: 'Origin Point', value: sel.district, sub: `${sel.clusterCount} Aggregation Hubs` },
              { label: 'Feedstock Stream', value: streams[sel.stream]?.label ?? sel.stream, sub: `${streams[sel.stream]?.bulkDensityTPerM3} t/m³ Density` },
              { label: 'Availability', value: `${num(sel.availableT)} t Window`, sub: `${num(sel.annualT)} t/yr Annual` },
              { label: 'Collection Rate', value: `${pct(sel.availableT > 0 ? ((allocated.get(sel.id) ?? 0) / sel.availableT) * 100 : 0, 0)} Routed`, sub: `${num(allocated.get(sel.id) ?? 0)} t Placed`, tone: 'pos' },
              { label: 'Economics', value: `${inr(streams[sel.stream]?.gatePriceInrPerT ?? 0)}/t Gate`, sub: `Agg Cost ${inr(streams[sel.stream]?.aggregationCostInrPerT ?? 0)}/t` },
            ]}
          />
        )}

        <StatStrip>
          <Stat label="Sources shown" value={num(rows.length)} sub={`of ${num(state.sources.length)}`} />
          <Stat label="Available" value={num(totalAvail)} unit="t" sub="this window" />
          <Stat
            label="Collected"
            value={num(totalAlloc)}
            unit="t"
            sub={pct(totalAvail > 0 ? (totalAlloc / totalAvail) * 100 : 0, 1)}
          />
          <Stat label="Unplaced" value={num(totalAvail - totalAlloc)} unit="t" tone="neg" />
          <Stat
            label="Forecast accuracy"
            value={fc.data ? fc.data.networkMapePct.toFixed(1) : '—'}
            unit="% MAPE"
            sub="walk-forward backtest"
          />
          <Stat
            label="Expected next window"
            value={fc.data ? num(fc.data.windowTotalT) : '—'}
            unit="t"
            sub={fc.data ? `${num(fc.data.windowLowerT)}–${num(fc.data.windowUpperT)} t` : undefined}
          />
        </StatStrip>
      </div>

      <div className="section">
        <div className="grid g-3-2">
          <Panel flush>
            <DataTable
              rows={rows}
              rowKey={(r) => r.id}
              onRowClick={(r) => setSelected(r.id === selected ? null : r.id)}
              selectedKey={selected}
              initialSort="avail"
              maxHeight={540}
              columns={[
                { key: 'name', header: 'Source', render: (r) => <span className="name">{r.name}</span>, sort: (r) => r.name },
                { key: 'district', header: 'District', render: (r) => r.district, sort: (r) => r.district },
                { key: 'stream', header: 'Stream', render: (r) => streams[r.stream].label, sort: (r) => r.stream },
                {
                  key: 'avail',
                  header: 'Available',
                  num: true,
                  sort: (r) => r.availableT,
                  render: (r) => (
                    <>
                      {num(r.availableT)} t
                      <MiniBar value={r.availableT} max={maxAvail} />
                    </>
                  ),
                },
                {
                  key: 'alloc',
                  header: 'Collected',
                  num: true,
                  sort: (r) => r.sharePct,
                  render: (r) => (
                    <>
                      <span className={r.sharePct > 99 ? 'pos' : r.sharePct < 1 ? 'neg' : ''}>
                        {pct(r.sharePct, 0)}
                      </span>
                      <MiniBar value={r.sharePct} max={100} tone={r.sharePct < 1 ? 'neg' : undefined} />
                    </>
                  ),
                },
                {
                  key: 'gate',
                  header: 'Gate price',
                  num: true,
                  sort: (r) => streams[r.stream].gatePriceInrPerT,
                  render: (r) => (
                    <span className={streams[r.stream].gatePriceInrPerT < 0 ? 'pos' : ''}>
                      {inr(streams[r.stream].gatePriceInrPerT)}/t
                    </span>
                  ),
                },
                {
                  key: 'mape',
                  header: 'Forecast MAPE',
                  num: true,
                  sort: (r) => r.mape ?? 999,
                  render: (r) => (r.mape != null ? pct(r.mape, 1) : '—'),
                },
                {
                  key: 'access',
                  header: 'Access',
                  render: (r) => <span className="muted">{r.access.replace(/_/g, ' ')}</span>,
                  sort: (r) => r.access,
                },
              ]}
            />
          </Panel>

          <div>
            {!sel ? (
              <Empty
                title="No source selected"
                body="Pick a row to see its supply forecast, feedstock properties and the seasonal process that drives it."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Panel title={sel.name} right={`${num(sel.availableT)} t`}>
                  <dl className="kv">
                    <dt>District</dt>
                    <dd>{sel.district}, {sel.state}</dd>
                    <dt>Feedstock</dt>
                    <dd>{streams[sel.stream].label}</dd>
                    <dt>Collection points</dt>
                    <dd>{num(sel.clusterCount)}</dd>
                    <dt>Annual generation</dt>
                    <dd>{num(sel.annualT)} t</dd>
                    <dt>Aggregation cost</dt>
                    <dd>{inr(streams[sel.stream].aggregationCostInrPerT)}/t</dd>
                    <dt>Bulk density</dt>
                    <dd>{streams[sel.stream].bulkDensityTPerM3} t/m³</dd>
                    <dt>Counterfactual fate</dt>
                    <dd style={{ fontSize: 11 }}>
                      {(boot.reference.counterfactuals as any)[streams[sel.stream].counterfactual].label}
                    </dd>
                    <dt>Telemetry age</dt>
                    <dd>{sel.telemetryAgeH.toFixed(1)} h</dd>
                  </dl>
                  <p style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 9, lineHeight: 1.55 }}>
                    {streams[sel.stream].notes}
                  </p>
                </Panel>

                <Panel
                  title="Supply forecast"
                  right={selForecast ? `MAPE ${selForecast.backtestMapePct.toFixed(1)}%` : undefined}
                >
                  {fc.loading ? (
                    <Loading message={fc.message} />
                  ) : fc.error ? (
                    <ErrorState message={fc.error} onRetry={fc.reload} />
                  ) : selForecast ? (
                    <>
                      <ForecastChart
                        height={170}
                        points={selForecast.points.map((p) => ({
                          x: p.weekIndex,
                          actual: p.actual,
                          predicted: p.predicted,
                          lower: p.lower,
                          upper: p.upper,
                          label: dateShort(p.date),
                        }))}
                      />
                      <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.5 }}>
                        {selForecast.model} In-sample R² {selForecast.r2.toFixed(3)}.
                      </p>
                      <p style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 7, lineHeight: 1.55 }}>
                        <strong>Seasonality:</strong> {season[sel.stream]?.note}
                      </p>
                    </>
                  ) : null}
                </Panel>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
