import React from 'react';
import { inr, num, pct } from '../../format.ts';
import { PATHWAY_SHORT } from '../../components/NetworkMap.tsx';
import type { PathwayId, Allocation, ShadowPrice, NetworkTotals, Assumptions } from '../../../../engine/src/types.ts';
import { OverviewView } from './OverviewView.tsx';
import { PathwayEconomicsView } from './PathwayEconomicsView.tsx';
import { InvestmentView } from './InvestmentView.tsx';
import { WhatIfView } from './WhatIfView.tsx';

// ── Shared Report Header & Footer ──────────────────────────────────────────

export function ReportCover({
  title,
  dateRange,
  timestamp,
  totals,
}: {
  title: string;
  dateRange: string;
  timestamp: string;
  totals: NetworkTotals;
}) {
  return (
    <div className="report-cover" style={{ pageBreakAfter: 'always', padding: '40px' }}>
      <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 20, marginBottom: 40 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 12px 0' }}>{title}</h1>
        <div style={{ fontSize: 14, color: 'var(--ink-2)' }}>
          <strong>Date Range:</strong> {dateRange === '7d' ? 'Last 7 Days' : dateRange === '30d' ? 'Last 30 Days' : 'All Time'}
          <br />
          <strong>Generated:</strong> {new Date(timestamp).toLocaleString('en-IN')}
        </div>
      </div>

      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, borderBottom: '1px solid var(--rule)', paddingBottom: 8, marginBottom: 16 }}>Executive Summary</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ border: '1px solid var(--rule)', padding: 16 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>Operating Margin</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: totals.marginInr >= 0 ? 'var(--green-700)' : 'var(--neg)' }}>
              {inr(totals.marginInr)}
            </div>
          </div>
          <div style={{ border: '1px solid var(--rule)', padding: 16 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>Total Processed</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {num(totals.divertedT)} t
            </div>
          </div>
          <div style={{ border: '1px solid var(--rule)', padding: 16 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>Net Carbon Removed</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {num(totals.netCarbonT)} tCO₂e
            </div>
          </div>
          <div style={{ border: '1px solid var(--rule)', padding: 16 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>Abatement Cost</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: totals.abatementCostInrPerTco2e < 0 ? 'var(--green-700)' : 'var(--warn)' }}>
              {inr(totals.abatementCostInrPerTco2e)} / tCO₂e
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReportFootnotes() {
  return (
    <div className="report-footnotes" style={{ marginTop: 60, paddingTop: 20, borderTop: '2px solid var(--ink)', pageBreakInside: 'avoid' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Methodology & Citations</h3>
      <ol style={{ fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.5, paddingLeft: 20, margin: 0 }}>
        <li><strong>Marginal Abatement Cost Curve (MACC):</strong> Ranks interventions by cost per tonne of CO₂e abated. Negative values indicate profitability independent of carbon markets.</li>
        <li><strong>Shadow Prices:</strong> Derived from the dual solution of the linear programming relaxation. Indicates the marginal system value of expanding facility capacity by one unit.</li>
        <li><strong>Durable vs. Avoided Carbon:</strong> Durable removal (e.g., biochar) implies permanent sequestration. Avoided emissions (e.g., AD, composting) represent displacing higher-emission baselines.</li>
        <li><strong>Economic Assumptions:</strong> All transport costs are computed linearly based on diesel price, efficiency, and straight-line distance adjusted by a circuity factor.</li>
      </ol>
    </div>
  );
}

// ── Printable Trade Ledger Table ──────────────────────────────────────────

export function PrintableLedgerTable({ allocations, sourceById, facilityById, summaryOnly }: { allocations: Allocation[]; sourceById: Record<string, any>; facilityById: Record<string, any>; summaryOnly: boolean }) {
  if (summaryOnly) {
    const totalRevenue = allocations.reduce((s, a) => s + a.revenueInr, 0);
    const totalCost = allocations.reduce((s, a) => s + a.costInr, 0);
    return (
      <div style={{ border: '1px solid var(--rule)', padding: 16, marginBottom: 20 }}>
        <p><em>Trade ledger details omitted (summary only mode).</em></p>
        <p><strong>Total Trades:</strong> {allocations.length}</p>
        <p><strong>Total Trade Revenue:</strong> {inr(totalRevenue)}</p>
        <p><strong>Total Trade Cost:</strong> {inr(totalCost)}</p>
      </div>
    );
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, pageBreakInside: 'auto' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--ink)', textAlign: 'left' }}>
          <th style={{ padding: 6 }}>Generator</th>
          <th style={{ padding: 6 }}>Facility</th>
          <th style={{ padding: 6 }}>Pathway</th>
          <th style={{ padding: 6, textAlign: 'right' }}>Vol (t)</th>
          <th style={{ padding: 6, textAlign: 'right' }}>Revenue</th>
          <th style={{ padding: 6, textAlign: 'right' }}>Cost</th>
          <th style={{ padding: 6, textAlign: 'right' }}>Margin</th>
        </tr>
      </thead>
      <tbody>
        {allocations.map((a, i) => (
          <tr key={i} style={{ borderBottom: '1px solid var(--rule)', pageBreakInside: 'avoid' }}>
            <td style={{ padding: 6 }}>{sourceById[a.sourceId]?.name ?? a.sourceId}</td>
            <td style={{ padding: 6 }}>{facilityById[a.facilityId]?.name ?? a.facilityId}</td>
            <td style={{ padding: 6 }}>{PATHWAY_SHORT[a.pathway as PathwayId]}</td>
            <td style={{ padding: 6, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{num(a.tonnes)}</td>
            <td style={{ padding: 6, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{inr(a.revenueInr)}</td>
            <td style={{ padding: 6, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{inr(a.costInr)}</td>
            <td style={{ padding: 6, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{inr(a.marginInr)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Main Print Layout Component ───────────────────────────────────────────

export function PrintReportLayout({
  config,
  ec,
  macc,
  totalCo2,
  freeCo2,
  pathwayRows,
  facilityRows,
  T,
  sourceById,
  facilityById,
  state,
  optimization,
  apiSetAssumptions,
}: {
  config: { scope: string; options: any; timestamp: string } | null;
  ec: any;
  macc: any;
  totalCo2: number;
  freeCo2: number;
  pathwayRows: any[];
  facilityRows: any[];
  T: NetworkTotals;
  sourceById: Record<string, any>;
  facilityById: Record<string, any>;
  state: any;
  optimization: any;
  apiSetAssumptions: any;
}) {
  if (!config) return null;

  const { scope, options, timestamp } = config;
  const isMaster = scope === 'master';

  const title = scope === 'master' ? 'Full Master Report' :
                scope === 'overview' ? 'Overview Report' :
                scope === 'ledger' ? 'Trade Ledger Report' :
                scope === 'pathways' ? 'Pathway Economics Report' :
                scope === 'whatif' ? 'What-If Simulation Report' :
                'Investment Opportunities Report';

  return (
    <div className="print-only report-container">
      <ReportCover title={title} dateRange={options.dateRange} timestamp={timestamp} totals={T} />

      {(isMaster || scope === 'overview') && (
        <div className="report-section" style={{ pageBreakAfter: 'always' }}>
          <h2 style={{ fontSize: 24, borderBottom: '2px solid var(--ink)', paddingBottom: 8, marginBottom: 20 }}>Overview</h2>
          <OverviewView
            ec={ec} macc={macc} totalCo2={totalCo2} freeCo2={freeCo2}
            pathwayRows={pathwayRows} facilityRows={facilityRows} T={T}
            explainMode={false} sourceById={sourceById} facilityById={facilityById}
          />
        </div>
      )}

      {(isMaster || scope === 'pathways') && (
        <div className="report-section" style={{ pageBreakAfter: 'always' }}>
          <h2 style={{ fontSize: 24, borderBottom: '2px solid var(--ink)', paddingBottom: 8, marginBottom: 20 }}>Pathway Economics</h2>
          <PathwayEconomicsView
            roll={ec.rollup} totalTonnes={T.divertedT}
            explainMode={false} facilityById={facilityById}
          />
        </div>
      )}

      {(isMaster || scope === 'investment') && (
        <div className="report-section" style={{ pageBreakAfter: 'always' }}>
          <h2 style={{ fontSize: 24, borderBottom: '2px solid var(--ink)', paddingBottom: 8, marginBottom: 20 }}>Investment Opportunities</h2>
          <InvestmentView optimization={optimization} explainMode={false} />
        </div>
      )}

      {(isMaster || scope === 'whatif') && (
        <div className="report-section" style={{ pageBreakAfter: 'always' }}>
          <h2 style={{ fontSize: 24, borderBottom: '2px solid var(--ink)', paddingBottom: 8, marginBottom: 20 }}>What-If Simulation Parameters</h2>
          <WhatIfView state={state} setAssumptions={apiSetAssumptions} T={T} explainMode={false} />
        </div>
      )}

      {(isMaster || scope === 'ledger') && (
        <div className="report-section" style={{ pageBreakAfter: 'always' }}>
          <h2 style={{ fontSize: 24, borderBottom: '2px solid var(--ink)', paddingBottom: 8, marginBottom: 20 }}>Trade Ledger Appendix</h2>
          <PrintableLedgerTable allocations={ec.allocations} sourceById={sourceById} facilityById={facilityById} summaryOnly={!options.includeLedgerDetail} />
        </div>
      )}

      <ReportFootnotes />
    </div>
  );
}
