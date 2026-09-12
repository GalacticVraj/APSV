import { useState } from 'react';
import { MetricCard } from './KPICard.tsx';
import { InfoIcon } from './InfoIcon.tsx';
import { inr, num } from '../../format.ts';
import { PATHWAY_SHORT } from '../../components/NetworkMap.tsx';
import type { PathwayId } from '../../../../engine/src/types.ts';
import {
  buildPathwayCSV, buildFacilityCSV, downloadCSV, triggerPrint,
  saveReportRecord, reportFilename,
} from './ReportHelpers.ts';

// Bar chart for pathway margin comparison
function PathwayBar({
  rows,
}: {
  rows: Array<{ pathway: PathwayId; label: string; margin: number; tonnes: number; sharePct: number }>;
}) {
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.margin)), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0' }}>
      {rows.map((r) => {
        const pct = (Math.abs(r.margin) / maxAbs) * 100;
        const isPos = r.margin >= 0;
        return (
          <div key={r.pathway} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 120, fontSize: 12, fontWeight: 500, flexShrink: 0, textAlign: 'right' }}>{r.label}</div>
            <div style={{ flex: 1, background: 'var(--surface-sunken)', height: 20, position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: 0, top: 0, bottom: 0,
                width: `${pct}%`,
                background: isPos ? 'var(--green-500)' : 'var(--neg)',
                transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{ width: 100, fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'right', color: isPos ? 'var(--green-700)' : 'var(--neg)', fontWeight: 700 }}>
              {inr(r.margin)}
            </div>
            <div style={{ width: 60, fontFamily: 'var(--font-mono)', fontSize: 11, textAlign: 'right', color: 'var(--ink-3)' }}>
              {r.sharePct.toFixed(1)}%
            </div>
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 10, marginTop: 2, paddingLeft: 130, fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.05em' }}>
        <div style={{ flex: 1 }}>Relative margin ←→</div>
        <div style={{ width: 100, textAlign: 'right' }}>Net margin</div>
        <div style={{ width: 60, textAlign: 'right' }}>% volume</div>
      </div>
    </div>
  );
}

export function PathwayEconomicsView({
  roll,
  totalTonnes,
  explainMode,
  facilityById,
}: {
  roll: { byPathway: Record<string, { tonnes: number; revenue: number; cost: number; margin: number }>; byFacility: Record<string, { tonnes: number; revenue: number; cost: number; margin: number }> };
  totalTonnes: number;
  explainMode: boolean;
  facilityById: Record<string, { name: string }>;
}) {
  const pathwayRows = Object.entries(roll.byPathway)
    .map(([k, v]) => ({
      pathway: k as PathwayId,
      label: PATHWAY_SHORT[k as PathwayId] ?? k,
      ...v,
      marginPerT: v.tonnes > 0 ? v.margin / v.tonnes : 0,
      sharePct: totalTonnes > 0 ? (v.tonnes / totalTonnes) * 100 : 0,
    }))
    .sort((a, b) => b.margin - a.margin);

  const bestPathway = pathwayRows[0];
  const worstPathway = [...pathwayRows].sort((a, b) => a.margin - b.margin)[0];

  const facilityRows = Object.entries(roll.byFacility)
    .map(([k, v]) => ({
      id: k,
      name: facilityById[k]?.name ?? k,
      ...v,
      marginPerT: v.tonnes > 0 ? v.margin / v.tonnes : 0,
    }))
    .sort((a, b) => b.margin - a.margin);

  return (
    <>
      {explainMode && (
        <div className="econ-explain-banner">
          <strong>⑆ Pathway Economics</strong> — Compares the five carbon-processing pathways (composting, biochar, digestion, etc.)
          by financial performance. The bar chart shows relative margin — longer and greener means more profitable per tonne.
          Use this to decide which pathways to prioritise or scale up.
        </div>
      )}

      {/* Metric cards */}
      <div className="econ-metrics">
        <MetricCard
          label="Best Pathway"
          value={bestPathway?.label ?? '—'}
          caption={bestPathway ? `${inr(bestPathway.marginPerT)} margin per tonne — your highest-return processing method` : ''}
          tone="pos"
          info="The pathway generating the most margin per tonne of waste processed under current assumptions."
        />
        <MetricCard
          label="Lowest-Margin Pathway"
          value={worstPathway?.label ?? '—'}
          caption={worstPathway ? `${inr(worstPathway.marginPerT)}/t — may need carbon-price support or cost reduction` : ''}
          tone={worstPathway?.margin < 0 ? 'neg' : 'warn'}
        />
        <MetricCard
          label="Total Active Pathways"
          value={String(pathwayRows.length)}
          caption="Number of distinct processing routes currently active in the optimised plan"
        />
      </div>

      {/* Comparison bar chart */}
      <div className="section">
        <div className="section-head">
          <h2>
            Pathway Margin Comparison
            <InfoIcon tip="This chart ranks every processing pathway by net operating margin. A positive (green) bar means that pathway is profitable today. A negative bar means it needs subsidy or a carbon price above the current assumption to break even." />
          </h2>
          <span className="note">Sorted by margin · {num(totalTonnes)} t total</span>
        </div>
        <div className="panel">
          <div className="panel-body">
            <PathwayBar rows={pathwayRows} />
          </div>
        </div>
      </div>

      {/* Detail table */}
      <div className="section">
        <div className="section-head">
          <h2>Full Pathway Breakdown</h2>
          <button className="econ-btn" style={{ marginLeft: 'auto' }} onClick={() => {
            const csv = buildPathwayCSV(roll.byPathway);
            downloadCSV(csv, reportFilename('pathways', 'csv', 'all'));
          }}>
            ↓ Export CSV
          </button>
        </div>
        <div className="panel" style={{ overflow: 'hidden' }}>
          <div className="panel-body flush">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--rule)', background: 'var(--surface)' }}>
                  {['Pathway', 'Tonnes', '% Volume', 'Revenue', 'Cost', 'Net Margin', '₹ / Tonne'].map((h, i) => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: i > 0 ? 'right' : 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pathwayRows.map((r, i) => (
                  <tr key={r.pathway} style={{ borderBottom: '1px solid var(--rule)', background: i === 0 ? 'var(--green-100)' : 'transparent' }}>
                    <td style={{ padding: '9px 12px', fontWeight: i === 0 ? 700 : 500 }}>{r.label}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{num(r.tonnes)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{r.sharePct.toFixed(1)}%</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{inr(r.revenue)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--neg)' }}>{inr(r.cost)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: r.margin < 0 ? 'var(--neg)' : 'var(--green-700)' }}>{inr(r.margin)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{inr(r.marginPerT)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ height: 40 }} />
    </>
  );
}
