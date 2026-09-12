/**
 * Economics — an operations and finance tool, not a chart gallery.
 *
 * The question this screen exists to answer is which tonnes to do first. The
 * marginal abatement cost curve answers it directly: everything to the left of the
 * zero line pays for itself before any carbon revenue, which is the part of the
 * portfolio that does not need a carbon price to happen.
 */

import { useMemo, useState } from 'react';
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
  DecisionBanner,
  ValueFlowChain,
} from '../components/Primitives.tsx';
import { BarList, StackedBar, seriesColor } from '../components/Charts.tsx';
import { PATHWAY_SHORT } from '../components/NetworkMap.tsx';
import { inr, num, pct } from '../format.ts';
import type { PathwayId } from '../../../engine/src/types.ts';

export default function Economics() {
  const { boot, state, optimization, version } = useTwin();
  const ec = useResource(() => api.economics(), [version], [
    'Rolling up revenue and cost by pathway…',
    'Building the abatement cost curve…',
  ]);

  // Hooks before any early return.
  const macc = useMemo(() => {
    const allocations = ec.data?.allocations ?? [];
    const rows = allocations
      .filter((a) => a.netCarbonT > 0.01)
      .map((a) => ({
        id: `${a.sourceId}>${a.facilityId}`,
        pathway: a.pathway as PathwayId,
        tonnesCo2: a.netCarbonT,
        cost: -a.marginInr / a.netCarbonT,
      }))
      .sort((a, b) => a.cost - b.cost);
    let cum = 0;
    return rows.map((r) => {
      const from = cum;
      cum += r.tonnesCo2;
      return { ...r, from, to: cum };
    });
  }, [ec.data]);

  if (!boot || !state || !optimization) return <Loading message="Loading…" />;
  if (ec.loading) return <Loading message={ec.message} />;
  if (ec.error) return <ErrorState message={ec.error} onRetry={ec.reload} />;
  if (!ec.data) return null;

  const T = ec.data.totals;
  const roll = ec.data.rollup;
  const prices = boot.reference.prices;

  const pathwayRows = Object.entries(roll.byPathway)
    .map(([k, v]) => ({
      pathway: k as PathwayId,
      label: PATHWAY_SHORT[k as PathwayId],
      ...v,
      marginPerT: v.tonnes > 0 ? v.margin / v.tonnes : 0,
    }))
    .sort((a, b) => b.margin - a.margin);

  const facilityRows = Object.entries(roll.byFacility)
    .map(([k, v]) => ({
      id: k,
      name: state.facilities.find((f) => f.id === k)?.name ?? k,
      ...v,
      marginPerT: v.tonnes > 0 ? v.margin / v.tonnes : 0,
    }))
    .sort((a, b) => b.margin - a.margin);

  const totalCo2 = macc.length > 0 ? macc[macc.length - 1].to : 0;
  const freeCo2 = macc.filter((m) => m.cost <= 0).reduce((s, m) => s + m.tonnesCo2, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Economics</h1>
          <div className="lede">
            Operating margin over the {state.assumptions.windowDays}-day window, and the cost of
            each tonne of abatement the network delivers.
          </div>
        </div>
      </div>

      <div className="section">
        <DecisionBanner
          badge="Unit Economics & Margin Decision State"
          happening={
            <>
              Total net margin: <strong>{inr(T.marginInr)}</strong> ({inr(T.marginPerTonneInr)}/t) over the {state.assumptions.windowDays}-day planning window.
            </>
          }
          why={
            <>
              <strong>{num(freeCo2)} tCO₂e</strong> ({pct(totalCo2 > 0 ? (freeCo2 / totalCo2) * 100 : 0, 0)}) of carbon abatement is <strong>self-funding</strong> (negative abatement cost before carbon credit sales).
            </>
          }
          action="Execute self-funding conversion pathways first, then apply carbon revenue to bridge positive abatement cost routes."
          actionLabel="View Carbon Offsets →"
          to="/carbon"
        />

        <ValueFlowChain
          title="Unit Economics & Value Rollup Chain"
          steps={[
            { label: 'Gross Sales', value: inr(T.revenueInr), sub: 'Products + Carbon Credits' },
            { label: 'Feedstock Cost', value: `−${inr(T.feedstockCostInr)}`, sub: 'Gate Price & Aggregation' },
            { label: 'Processing Opex', value: `−${inr(T.processingCostInr)}`, sub: 'Plant Operations' },
            { label: 'Transport Cost', value: `−${inr(T.transportCostInr)}`, sub: 'Haulage & Fuel' },
            { label: 'Net Operating Margin', value: inr(T.marginInr), sub: `${inr(T.marginPerTonneInr)}/t Net Profit`, tone: 'pos' },
          ]}
        />

        <StatStrip>
          <Stat label="Revenue" value={inr(T.revenueInr)} sub="products plus carbon" size="lg" />
          <Stat label="Carbon revenue" value={inr(T.carbonRevenueInr)} sub={`${pct((T.carbonRevenueInr / Math.max(1, T.revenueInr)) * 100, 0)} of revenue`} />
          <Stat label="Total cost" value={inr(T.processingCostInr)} sub="feedstock, logistics, processing" tone="neg" />
          <Stat label="Operating margin" value={inr(T.marginInr)} sub={`${inr(T.marginPerTonneInr)} per tonne`} size="lg" tone={T.marginInr >= 0 ? 'pos' : 'neg'} />
          <Stat
            label="Abatement cost"
            value={inr(T.abatementCostInrPerTco2e)}
            unit="/tCO₂e"
            sub={T.abatementCostInrPerTco2e < 0 ? 'net-negative — pays for itself' : 'net cost per tonne'}
            tone={T.abatementCostInrPerTco2e < 0 ? 'pos' : 'warnc'}
          />
          <Stat label="Value per tonne processed" value={inr(T.marginPerTonneInr)} sub={`${num(T.divertedT)} t processed`} />
        </StatStrip>
      </div>

      {/* MACC */}
      <div className="section">
        <SectionHead
          title="Marginal abatement cost curve"
          note="Every active flow, ordered cheapest first"
        />
        <Panel>
          {macc.length === 0 ? (
            <Empty title="No carbon-positive flows" body="Nothing in the current plan delivers net positive carbon." />
          ) : (
            <>
              <MaccChart rows={macc} />
              <p style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 11, lineHeight: 1.6 }}>
                <strong className="num">{num(freeCo2)} tCO₂e</strong> of the{' '}
                <strong className="num">{num(totalCo2)} tCO₂e</strong> this network delivers sits
                below the zero line — those tonnes are profitable on their product revenue alone and
                do not need a carbon price to happen. Everything above the line does, and the height
                of the bar is exactly how much support each tonne requires.
              </p>
            </>
          )}
        </Panel>
      </div>

      <div className="section">
        <div className="grid g2">
          <Panel title="By pathway" flush>
            <DataTable
              rows={pathwayRows}
              rowKey={(r) => r.pathway}
              initialSort="margin"
              columns={[
                { key: 'label', header: 'Pathway', render: (r) => <span className="name">{r.label}</span> },
                { key: 'tonnes', header: 'Tonnes', num: true, sort: (r) => r.tonnes, render: (r) => num(r.tonnes) },
                { key: 'revenue', header: 'Revenue', num: true, sort: (r) => r.revenue, render: (r) => inr(r.revenue) },
                { key: 'margin', header: 'Margin', num: true, sort: (r) => r.margin, render: (r) => <strong className={r.margin < 0 ? 'neg' : ''}>{inr(r.margin)}</strong> },
                { key: 'per', header: 'Margin/t', num: true, sort: (r) => r.marginPerT, render: (r) => inr(r.marginPerT) },
              ]}
              footer={
                <>
                  <td><strong>Total</strong></td>
                  <td className="num"><strong>{num(T.divertedT)}</strong></td>
                  <td className="num"><strong>{inr(T.revenueInr)}</strong></td>
                  <td className="num"><strong>{inr(T.marginInr)}</strong></td>
                  <td className="num"><strong>{inr(T.marginPerTonneInr)}</strong></td>
                </>
              }
            />
          </Panel>

          <Panel title="By facility" flush>
            <DataTable
              rows={facilityRows}
              rowKey={(r) => r.id}
              initialSort="margin"
              maxHeight={340}
              columns={[
                { key: 'name', header: 'Facility', render: (r) => <span className="name">{r.name}</span>, sort: (r) => r.name },
                { key: 'tonnes', header: 'Tonnes', num: true, sort: (r) => r.tonnes, render: (r) => num(r.tonnes) },
                { key: 'margin', header: 'Margin', num: true, sort: (r) => r.margin, render: (r) => <span className={r.margin < 0 ? 'neg' : ''}>{inr(r.margin)}</span> },
                { key: 'per', header: 'Margin/t', num: true, sort: (r) => r.marginPerT, render: (r) => inr(r.marginPerT) },
              ]}
            />
          </Panel>
        </div>
      </div>

      <div className="section">
        <SectionHead title="Price assumptions" note="Every revenue line traces to one of these" />
        <Panel flush>
          <DataTable
            rows={[
              ...prices.map((p) => ({
                label: p.label,
                price: `${inr(p.price)} ${p.unit.replace('₹', '').trim()}`,
                unc: p.uncertaintyPct,
                source: p.source,
              })),
              ...Object.values(boot.reference.carbonMarkets).map((m) => ({
                label: m.label,
                price: `${inr(m.price)} ${m.unit.replace('₹', '').trim()}`,
                unc: m.uncertaintyPct,
                source: m.source,
              })),
            ]}
            rowKey={(r) => r.label}
            columns={[
              { key: 'label', header: 'Product', render: (r) => <span className="name">{r.label}</span> },
              { key: 'price', header: 'Price', num: true, render: (r) => r.price },
              { key: 'unc', header: 'Uncertainty', num: true, render: (r) => `±${r.unc}%` },
              { key: 'source', header: 'Source', render: (r) => <span className="muted" style={{ fontSize: 11.5 }}>{r.source}</span> },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function MaccChart({
  rows,
}: {
  rows: Array<{ id: string; pathway: PathwayId; tonnesCo2: number; cost: number; from: number; to: number }>;
}) {
  const W = 900;
  const H = 260;
  const m = { t: 14, r: 14, b: 42, l: 76 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;

  const totalCo2 = rows[rows.length - 1]?.to ?? 1;
  const costs = rows.map((r) => r.cost);
  const lo = Math.min(0, ...costs);
  const hi = Math.max(0, ...costs);
  const pad = (hi - lo) * 0.1 || 100;

  const X = (v: number) => m.l + (v / totalCo2) * iw;
  const Y = (v: number) => m.t + ih - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * ih;

  const ticks = [lo - pad, (lo + hi) / 2, 0, hi + pad]
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => a - b);

  const colors: Record<PathwayId, string> = {
    pyrolysis_biochar: 'var(--s1)',
    anaerobic_digestion_cbg: 'var(--s5)',
    pellet_cofiring: 'var(--s4)',
    composting: 'var(--s2)',
    gasification_power: 'var(--s6)',
  };

  const used = [...new Set(rows.map((r) => r.pathway))];

  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ height: 260 }}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-l" x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} />
            <text className="tick" x={m.l - 6} y={Y(t) + 3} textAnchor="end">
              {inr(t)}
            </text>
          </g>
        ))}

        {rows.map((r) => {
          const x0 = X(r.from);
          const x1 = X(r.to);
          const y = Y(r.cost);
          const zero = Y(0);
          return (
            <rect
              key={r.id}
              x={x0}
              y={Math.min(y, zero)}
              width={Math.max(0.6, x1 - x0 - 0.4)}
              height={Math.max(1, Math.abs(zero - y))}
              fill={colors[r.pathway]}
              opacity={0.88}
            >
              <title>{`${num(r.tonnesCo2)} tCO₂e at ${inr(r.cost)}/tCO₂e`}</title>
            </rect>
          );
        })}

        <line x1={m.l} x2={W - m.r} y1={Y(0)} y2={Y(0)} stroke="var(--ink)" strokeWidth={1.4} />
        <text className="annot" x={W - m.r} y={Y(0) - 6} textAnchor="end">
          break-even without carbon revenue
        </text>

        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <text key={f} className="tick" x={X(totalCo2 * f)} y={H - 22} textAnchor="middle">
            {num(totalCo2 * f)}
          </text>
        ))}
        <text className="axis-label" x={m.l} y={H - 6}>
          Cumulative tCO₂e abated →
        </text>
        <text className="axis-label" x={-(m.t + ih)} y={13} transform="rotate(-90)" textAnchor="start">
          ₹ per tCO₂e →
        </text>
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 8 }}>
        {used.map((p) => (
          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <span style={{ width: 9, height: 9, background: colors[p] }} />
            <span style={{ color: 'var(--ink-2)' }}>{PATHWAY_SHORT[p]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
