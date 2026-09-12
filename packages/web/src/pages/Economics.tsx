/**
 * Economics — Power BI-grade Economic Manager.
 *
 * F-pattern layout: sticky KPI strip → left nav rail → content pane.
 * Five dedicated views, a genuine explainability layer, per-view report buttons,
 * and one master full-module report button. All data is live; nothing is cached.
 */

import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { api, useResource, useTwin } from '../store.tsx';
import { ErrorState, Loading } from '../components/Primitives.tsx';
import { PATHWAY_SHORT } from '../components/NetworkMap.tsx';
import { inr, num, pct } from '../format.ts';
import type { PathwayId } from '../../../engine/src/types.ts';

// Sub-views
import { OverviewView } from './economics/OverviewView.tsx';
import { TradeLedgerView } from './economics/TradeLedgerView.tsx';
import { PathwayEconomicsView } from './economics/PathwayEconomicsView.tsx';
import { WhatIfView } from './economics/WhatIfView.tsx';
import { InvestmentView } from './economics/InvestmentView.tsx';
import { ReportHistoryView } from './economics/ReportHistoryView.tsx';
import { PrintReportLayout } from './economics/PrintReportLayout.tsx';

// Report
import { ReportOptionsModal } from './economics/ReportOptionsModal.tsx';
import type { ReportScope, ReportOptions } from './economics/ReportOptionsModal.tsx';
import {
  buildLedgerCSV, buildTotalsCSV, buildPathwayCSV, buildFacilityCSV,
  downloadCSV, triggerPrint, saveReportRecord, reportFilename,
} from './economics/ReportHelpers.ts';

// Components
import { KPIStripCard } from './economics/KPICard.tsx';

// CSS
import './economics/Economics.css';

// ── Navigation ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { key: 'overview',    label: 'Overview',                 icon: '◧' },
  { key: 'ledger',      label: 'Trade Ledger',             icon: '☰' },
  { key: 'pathways',    label: 'Pathway Economics',        icon: '⑆' },
  { key: 'whatif',      label: 'What-If Simulator',        icon: '⍰' },
  { key: 'investment',  label: 'Investment Opportunities', icon: '⇡' },
  { key: 'history',     label: 'Report History',           icon: '🕓' },
] as const;

type ViewKey = typeof NAV_ITEMS[number]['key'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function Economics() {
  const { boot, state, optimization, version } = useTwin();
  const ec = useResource(() => api.economics(), [version], [
    'Rolling up revenue and cost by pathway…',
    'Building the abatement cost curve…',
  ]);

  const [view, setView] = useState<ViewKey>('overview');
  const [explainMode, setExplainMode] = useState(false);
  const [reportModal, setReportModal] = useState<{ open: boolean; scope: ReportScope }>({ open: false, scope: 'master' });
  const [printConfig, setPrintConfig] = useState<{ scope: string; options: ReportOptions; timestamp: string } | null>(null);

  useEffect(() => {
    if (printConfig) {
      // Small delay to ensure the DOM has rendered the PrintReportLayout
      const timer = setTimeout(() => {
        window.print();
        setPrintConfig(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [printConfig]);

  // MACC — must be computed before any early return
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
    return rows.map((r) => { const from = cum; cum += r.tonnesCo2; return { ...r, from, to: cum }; });
  }, [ec.data]);

  if (!boot || !state || !optimization) return <Loading message="Loading…" />;
  if (ec.loading) return <Loading message={ec.message} />;
  if (ec.error) return <ErrorState message={ec.error} onRetry={ec.reload} />;
  if (!ec.data) return null;

  const T = ec.data.totals;
  const roll = ec.data.rollup;
  const totalCo2 = macc.length > 0 ? macc[macc.length - 1].to : 0;
  const freeCo2 = macc.filter((m) => m.cost <= 0).reduce((s, m) => s + m.tonnesCo2, 0);

  const pathwayRows = Object.entries(roll.byPathway)
    .map(([k, v]) => ({ pathway: k as PathwayId, label: PATHWAY_SHORT[k as PathwayId] ?? k, ...v, marginPerT: v.tonnes > 0 ? v.margin / v.tonnes : 0 }))
    .sort((a, b) => b.margin - a.margin);

  const facilityRows = Object.entries(roll.byFacility)
    .map(([k, v]) => ({ id: k, name: state.facilities.find((f) => f.id === k)?.name ?? k, ...v, marginPerT: v.tonnes > 0 ? v.margin / v.tonnes : 0 }))
    .sort((a, b) => b.margin - a.margin);

  const facilityById = Object.fromEntries(state.facilities.map((f) => [f.id, f]));
  const sourceById = Object.fromEntries(state.sources.map((s) => [s.id, s]));

  const viewLabel = NAV_ITEMS.find((n) => n.key === view)?.label ?? '';

  // ── Centralized report generation ────────────────────────────────────────

  const generateReport = (opts: ReportOptions) => {
    const scope = reportModal.scope;
    const isPdf = opts.format === 'pdf' || opts.format === 'print';
    const timestamp = new Date().toISOString();

    if (isPdf) {
      saveReportRecord({ title: `${scope === 'master' ? 'Full Master' : scope} Report`, scope, format: opts.format, generatedAt: timestamp, params: { dateRange: opts.dateRange } });
      setPrintConfig({ scope, options: opts, timestamp });
    } else {
      let csv = '';
      if (scope === 'master') {
        csv = '# CarbonLoop Economic Manager — Master Report\n';
        csv += `# Generated: ${timestamp}\n# Date range: ${opts.dateRange}\n\n`;
        csv += '## KPI TOTALS\n' + buildTotalsCSV(T);
        csv += '\n## TRADE LEDGER\n' + buildLedgerCSV(ec.data!.allocations, sourceById, facilityById);
        csv += '\n## PATHWAY BREAKDOWN\n' + buildPathwayCSV(roll.byPathway);
        csv += '\n## FACILITY BREAKDOWN\n' + buildFacilityCSV(roll.byFacility, facilityById);
      } else if (scope === 'overview') {
        csv = buildTotalsCSV(T);
      } else if (scope === 'ledger') {
        csv = buildLedgerCSV(ec.data!.allocations, sourceById, facilityById);
      } else if (scope === 'pathways') {
        csv = buildPathwayCSV(roll.byPathway);
      } else if (scope === 'investment') {
        // Build shadow CSV logic inline or export from InvestmentView. 
        // For now, minimal mock to avoid missing imports
        csv = "Export not fully configured in central function for investment";
      }
      
      const filename = reportFilename(scope, 'csv', opts.dateRange);
      downloadCSV(csv, filename);
      saveReportRecord({ title: `${scope} Report`, scope, format: 'csv', generatedAt: timestamp, params: { dateRange: opts.dateRange }, csvData: csv });
    }
    setReportModal({ open: false, scope: 'master' });
  };

  const carbonPct = (T.carbonRevenueInr / Math.max(1, T.revenueInr)) * 100;

  return (
    <>
      <PrintReportLayout
        config={printConfig}
        ec={ec.data}
        macc={macc}
        totalCo2={totalCo2}
        freeCo2={freeCo2}
        pathwayRows={pathwayRows}
        facilityRows={facilityRows}
        T={T}
        sourceById={sourceById}
        facilityById={facilityById}
        state={state}
        optimization={optimization}
        apiSetAssumptions={api.setAssumptions}
      />

      <div className="econ-shell">
        {/* Report modal */}
        <ReportOptionsModal
          isOpen={reportModal.open}
          scope={reportModal.scope}
          onClose={() => setReportModal({ open: false, scope: 'master' })}
          onGenerate={generateReport}
        />

        {/* ── Sticky KPI Strip ──────────────────────────────────────────────── */}
      <div className="econ-kpi-strip no-print">
        <KPIStripCard
          label="Operating Margin"
          value={inr(T.marginInr)}
          caption={T.marginInr >= 0 ? `${inr(T.marginPerTonneInr)} per tonne` : 'Operating at a loss'}
          tone={T.marginInr >= 0 ? 'pos' : 'neg'}
        />
        <KPIStripCard
          label="Revenue"
          value={inr(T.revenueInr)}
          caption={`${pct(carbonPct, 0)} from carbon credits`}
        />
        <KPIStripCard
          label="Total Cost"
          value={inr(T.processingCostInr)}
          caption="Feedstock + logistics + processing"
          tone="neg"
        />
        <KPIStripCard
          label="Carbon Value"
          value={inr(T.carbonRevenueInr)}
          caption={`${num(T.netCarbonT, 1)} tCO₂e net removed`}
          tone="pos"
        />
        <KPIStripCard
          label="Abatement Cost"
          value={`${inr(T.abatementCostInrPerTco2e)}/tCO₂e`}
          caption={T.abatementCostInrPerTco2e < 0 ? 'Pays for itself' : 'Cost per tonne removed'}
          tone={T.abatementCostInrPerTco2e < 0 ? 'pos' : 'warn'}
        />
        <KPIStripCard
          label="Diverted"
          value={`${num(T.divertedT)} t`}
          caption={`${pct(T.divertedPct, 0)} of supply · ${state.assumptions.windowDays}d window`}
        />
      </div>

      <div className="econ-body">
        {/* ── Left nav rail ─────────────────────────────────────────────── */}
        <nav className="econ-rail no-print" aria-label="Economics views">
          <div className="group-label">Views</div>
          {NAV_ITEMS.map((n) => (
            <button
              key={n.key}
              className={`econ-rail-btn${view === n.key ? ' active' : ''}`}
              onClick={() => setView(n.key)}
              aria-current={view === n.key ? 'page' : undefined}
            >
              <span className="icon">{n.icon}</span>
              {n.label}
            </button>
          ))}

          <div className="econ-rail-foot">
            <button
              className="econ-master-report-btn"
              onClick={() => setReportModal({ open: true, scope: 'master' })}
              aria-label="Generate full master report"
            >
              📊 Full Master Report
            </button>
            <button
              className={`econ-explain-btn${explainMode ? ' on' : ''}`}
              onClick={() => setExplainMode(!explainMode)}
              aria-pressed={explainMode}
            >
              💡 {explainMode ? 'Hide explanations' : 'Explain this page'}
            </button>
          </div>
        </nav>

        {/* ── Content pane ──────────────────────────────────────────────── */}
        <main className="econ-content">
          {/* View header */}
          <div className="econ-view-head no-print">
            <h1>{viewLabel}</h1>
            <div className="econ-view-actions">
              {view !== 'history' && (
                <button
                  className="econ-btn"
                  onClick={() => setReportModal({ open: true, scope: view as ReportScope })}
                  aria-label={`Generate ${viewLabel} report`}
                >
                  📄 Generate Report
                </button>
              )}
            </div>
          </div>

          {/* Per-view rendering */}
          {view === 'overview' && (
            <OverviewView
              ec={ec.data}
              macc={macc}
              totalCo2={totalCo2}
              freeCo2={freeCo2}
              pathwayRows={pathwayRows}
              facilityRows={facilityRows}
              T={T}
              explainMode={explainMode}
              sourceById={sourceById}
              facilityById={facilityById}
            />
          )}
          {view === 'ledger' && (
            <TradeLedgerView
              allocations={ec.data.allocations}
              sourceById={sourceById}
              facilityById={facilityById}
              explainMode={explainMode}
            />
          )}
          {view === 'pathways' && (
            <PathwayEconomicsView
              roll={roll}
              totalTonnes={T.divertedT}
              explainMode={explainMode}
              facilityById={facilityById}
            />
          )}
          {view === 'whatif' && (
            <WhatIfView
              state={state}
              setAssumptions={api.setAssumptions}
              T={T}
              explainMode={explainMode}
            />
          )}
          {view === 'investment' && (
            <InvestmentView
              optimization={optimization}
              explainMode={explainMode}
            />
          )}
          {view === 'history' && <ReportHistoryView />}
        </main>
      </div>
    </div>
    </>
  );
}
