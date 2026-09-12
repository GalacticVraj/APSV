import { useState, useMemo, Fragment } from 'react';
import { MetricCard } from './KPICard.tsx';
import { InfoIcon } from './InfoIcon.tsx';
import { inr, num } from '../../format.ts';
import { PATHWAY_SHORT } from '../../components/NetworkMap.tsx';
import type { Allocation, PathwayId, NetworkTotals } from '../../../../engine/src/types.ts';
import type { EconomicsPayload } from '../../store.tsx';
import {
  buildLedgerCSV, downloadCSV, triggerPrint,
  saveReportRecord, reportFilename,
} from './ReportHelpers.ts';

// ── MACC Chart ────────────────────────────────────────────────────────────────

const PATH_COLORS: Record<PathwayId, string> = {
  pyrolysis_biochar: 'var(--s1)',
  anaerobic_digestion_cbg: 'var(--s5)',
  pellet_cofiring: 'var(--s4)',
  composting: 'var(--s2)',
  gasification_power: 'var(--s6)',
};

function MaccChart({
  rows,
}: {
  rows: Array<{ id: string; pathway: PathwayId; tonnesCo2: number; cost: number; from: number; to: number }>;
}) {
  const W = 900, H = 240;
  const m = { t: 12, r: 12, b: 44, l: 72 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const totalCo2 = rows[rows.length - 1]?.to ?? 1;
  const costs = rows.map((r) => r.cost);
  const lo = Math.min(0, ...costs), hi = Math.max(0, ...costs);
  const pad = (hi - lo) * 0.1 || 100;
  const X = (v: number) => m.l + (v / totalCo2) * iw;
  const Y = (v: number) => m.t + ih - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * ih;
  const ticks = Array.from(new Set([lo - pad, 0, (lo + hi) / 2, hi + pad])).sort((a, b) => a - b);
  const used = [...new Set(rows.map((r) => r.pathway))];

  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ height: H, width: '100%' }}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-l" x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} />
            <text className="tick" x={m.l - 5} y={Y(t) + 3} textAnchor="end">{inr(t)}</text>
          </g>
        ))}
        {rows.map((r) => {
          const x0 = X(r.from), x1 = X(r.to), y = Y(r.cost), z = Y(0);
          return (
            <rect
              key={r.id}
              x={x0} y={Math.min(y, z)}
              width={Math.max(0.5, x1 - x0 - 0.3)}
              height={Math.max(1, Math.abs(z - y))}
              fill={PATH_COLORS[r.pathway]} opacity={0.9}
            >
              <title>{`${num(r.tonnesCo2)} tCO₂e at ${inr(r.cost)}/tCO₂e`}</title>
            </rect>
          );
        })}
        <line x1={m.l} x2={W - m.r} y1={Y(0)} y2={Y(0)} stroke="var(--ink)" strokeWidth={1.3} />
        <text className="annot" x={W - m.r} y={Y(0) - 5} textAnchor="end">break-even without carbon revenue</text>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <text key={f} className="tick" x={X(totalCo2 * f)} y={H - 22} textAnchor="middle">
            {num(totalCo2 * f)}
          </text>
        ))}
        <text className="axis-label" x={m.l} y={H - 6}>Cumulative tCO₂e abated →</text>
        <text className="axis-label" x={-(m.t + ih)} y={12} transform="rotate(-90)" textAnchor="start">₹ per tCO₂e →</text>
      </svg>
      <div className="econ-macc-legend">
        {used.map((p) => (
          <div key={p} className="econ-legend-item">
            <span className="econ-legend-dot" style={{ background: PATH_COLORS[p] }} />
            {PATHWAY_SHORT[p]}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Overview View ─────────────────────────────────────────────────────────────

export function OverviewView({
  ec,
  macc,
  totalCo2,
  freeCo2,
  pathwayRows,
  facilityRows,
  T,
  explainMode,
  sourceById,
  facilityById,
}: {
  ec: EconomicsPayload;
  macc: Array<{ id: string; pathway: PathwayId; tonnesCo2: number; cost: number; from: number; to: number }>;
  totalCo2: number;
  freeCo2: number;
  pathwayRows: any[];
  facilityRows: any[];
  T: NetworkTotals;
  explainMode: boolean;
  sourceById: Record<string, any>;
  facilityById: Record<string, any>;
}) {
  return (
    <>
      
      {explainMode && (
        <div className="econ-explain-banner">
          <strong>📊 Overview</strong> — This page answers: "Is the network profitable, and which tonnes deliver the best return?"
          The margin cards show total money made minus costs. The MACC chart reveals which carbon-reduction projects are cheapest — bars below zero pay for themselves.
        </div>
      )}

      {/* Metric cards */}
      <div className="econ-metrics">
        <MetricCard
          label="Operating Margin"
          value={inr(T.marginInr)}
          caption={T.marginInr >= 0 ? 'Money earned after all costs — feedstock, logistics, and processing' : 'Currently operating at a loss; increase carbon revenue or reduce logistics cost'}
          tone={T.marginInr >= 0 ? 'pos' : 'neg'}
          info="Operating margin = total revenue (product + carbon) minus all processing, transport, and feedstock costs."
        />
        <MetricCard
          label="Revenue"
          value={inr(T.revenueInr)}
          caption={`Products + carbon credits — carbon is ${((T.carbonRevenueInr / Math.max(1, T.revenueInr)) * 100).toFixed(1)}% of total`}
        />
        <MetricCard
          label="Total Cost"
          value={inr(T.processingCostInr)}
          caption="Feedstock acquisition, logistics (transport), and processing combined"
          tone="neg"
        />
        <MetricCard
          label="Abatement Cost"
          value={`${inr(T.abatementCostInrPerTco2e)}/tCO₂e`}
          caption={T.abatementCostInrPerTco2e < 0 ? 'Negative = you earn money per tonne of CO₂ removed — the ideal outcome' : 'Cost to remove one tonne of CO₂. Lower is better.'}
          tone={T.abatementCostInrPerTco2e < 0 ? 'pos' : 'warn'}
          info="Marginal Abatement Cost (MAC) = operating cost ÷ net carbon abated. Negative values mean abatement is profitable without carbon credits."
        />
        <MetricCard
          label="Margin / Tonne"
          value={inr(T.marginPerTonneInr)}
          caption={`Profit per tonne of waste processed across ${num(T.divertedT)} t diverted`}
          tone={T.marginPerTonneInr >= 0 ? 'pos' : 'neg'}
        />
      </div>

      {/* MACC chart */}
      <div className="section">
        <div className="section-head">
          <h2>
            Marginal Abatement Cost Curve
            <InfoIcon tip="The MACC shows every active flow ordered from cheapest to most expensive per tonne of CO₂ removed. Bars below zero are profitable without a carbon price — they pay for themselves from product revenue alone." />
          </h2>
          <span className="note">Every active flow, cheapest first · {num(macc.length)} flows</span>
        </div>
        <div className="panel">
          <div className="panel-body">
            {macc.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>No carbon-positive flows in the current plan.</div>
            ) : (
              <>
                <MaccChart rows={macc} />
                <p style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 14, lineHeight: 1.65 }}>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{num(freeCo2)} tCO₂e</strong> of the{' '}
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{num(totalCo2)} tCO₂e</strong>{' '}
                  the network delivers sits below the zero line — those tonnes are profitable on product revenue alone
                  and do not need a carbon price. Everything above costs money per tonne of carbon, and the bar height
                  is exactly how much support each tonne requires.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Pathway and facility tables */}
      <div className="section">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="panel">
            <div className="panel-head"><h3>By Pathway</h3></div>
            <div className="panel-body flush">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--rule)' }}>
                    {['Pathway', 'Tonnes', 'Revenue', 'Margin', '₹/t'].map((h, i) => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: i > 0 ? 'right' : 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pathwayRows.map((r) => (
                    <tr key={r.pathway} style={{ borderBottom: '1px solid var(--rule)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 500 }}>{r.label}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{num(r.tonnes)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{inr(r.revenue)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: r.margin < 0 ? 'var(--neg)' : 'var(--green-700)' }}>{inr(r.margin)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{inr(r.marginPerT)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>By Facility</h3></div>
            <div className="panel-body flush">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--rule)' }}>
                    {['Facility', 'Tonnes', 'Margin', '₹/t'].map((h, i) => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: i > 0 ? 'right' : 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {facilityRows.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--rule)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 500 }}>{r.name}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{num(r.tonnes)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: r.margin < 0 ? 'var(--neg)' : 'var(--green-700)' }}>{inr(r.margin)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{inr(r.marginPerT)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 40 }} />
    </>
  );
}
