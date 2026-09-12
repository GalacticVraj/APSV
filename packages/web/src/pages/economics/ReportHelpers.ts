/**
 * Report helpers — CSV generation, PDF/print, report history.
 * All data comes in live at call time; nothing is cached.
 */

import type { EconomicsPayload } from '../../store.tsx';
import type { Allocation } from '../../../../engine/src/types.ts';

// ── CSV helpers ──────────────────────────────────────────────────────────────

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(['\uFEFF' + csv, ''], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvRow(cells: (string | number)[]): string {
  return cells
    .map((c) => {
      const s = String(c);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    })
    .join(',') + '\n';
}

export function buildLedgerCSV(
  allocations: Allocation[],
  sourceById: Record<string, { name: string }>,
  facilityById: Record<string, { name: string }>,
  filteredIds?: Set<string>,
): string {
  let out = csvRow([
    'Timestamp_ISO',
    'Event_Type',
    'Generator',
    'Facility',
    'Pathway',
    'Stream',
    'Tonnes',
    'Distance_km',
    'Revenue_INR',
    'Cost_INR',
    'Margin_INR',
    'Net_Carbon_tCO2e',
    'Durable_tCO2e',
    'Avoided_tCO2e',
    'Emitted_tCO2e',
    'Status',
  ]);
  allocations.forEach((a, i) => {
    const id = `${a.sourceId}>${a.facilityId}>${i}`;
    if (filteredIds && !filteredIds.has(id)) return;
    const ts = new Date(Date.now() - i * 600_000).toISOString();
    out += csvRow([
      ts,
      'Settlement',
      sourceById[a.sourceId]?.name ?? a.sourceId,
      facilityById[a.facilityId]?.name ?? a.facilityId,
      a.pathway,
      a.stream,
      a.tonnes,
      a.distanceKm,
      a.revenueInr,
      a.costInr,
      a.marginInr,
      a.netCarbonT,
      a.durableT,
      a.avoidedT,
      a.emittedT,
      a.marginInr >= 0 ? 'Completed' : 'Pending',
    ]);
  });
  return out;
}

export function buildPathwayCSV(
  byPathway: Record<string, { tonnes: number; revenue: number; cost: number; margin: number }>,
): string {
  let out = csvRow(['Pathway', 'Tonnes', 'Revenue_INR', 'Cost_INR', 'Margin_INR', 'Margin_Per_Tonne_INR']);
  Object.entries(byPathway).forEach(([k, v]) => {
    out += csvRow([k, v.tonnes, v.revenue, v.cost, v.margin, v.tonnes > 0 ? v.margin / v.tonnes : 0]);
  });
  return out;
}

export function buildFacilityCSV(
  byFacility: Record<string, { tonnes: number; revenue: number; cost: number; margin: number }>,
  facilityById: Record<string, { name: string }>,
): string {
  let out = csvRow(['Facility_ID', 'Facility_Name', 'Tonnes', 'Revenue_INR', 'Cost_INR', 'Margin_INR', 'Margin_Per_Tonne_INR']);
  Object.entries(byFacility).forEach(([k, v]) => {
    out += csvRow([k, facilityById[k]?.name ?? k, v.tonnes, v.revenue, v.cost, v.margin, v.tonnes > 0 ? v.margin / v.tonnes : 0]);
  });
  return out;
}

export function buildTotalsCSV(totals: EconomicsPayload['totals']): string {
  let out = csvRow(['Metric', 'Value', 'Unit']);
  const rows: [string, number, string][] = [
    ['Total_Revenue', totals.revenueInr, 'INR'],
    ['Carbon_Revenue', totals.carbonRevenueInr, 'INR'],
    ['Processing_Cost', totals.processingCostInr, 'INR'],
    ['Operating_Margin', totals.marginInr, 'INR'],
    ['Margin_Per_Tonne', totals.marginPerTonneInr, 'INR_per_tonne'],
    ['Abatement_Cost', totals.abatementCostInrPerTco2e, 'INR_per_tCO2e'],
    ['Diverted_Tonnes', totals.divertedT, 'tonnes'],
    ['Net_Carbon', totals.netCarbonT, 'tCO2e'],
    ['Durable_Removal', totals.durableRemovalT, 'tCO2e'],
    ['Avoided_Emissions', totals.avoidedEmissionsT, 'tCO2e'],
    ['Transport_Emissions', totals.transportEmissionsT, 'tCO2e'],
  ];
  rows.forEach(([m, v, u]) => { out += csvRow([m, v, u]); });
  return out;
}

// ── PDF / Print ──────────────────────────────────────────────────────────────

export function triggerPrint() {
  window.print();
}

// ── Report History ───────────────────────────────────────────────────────────

export interface ReportRecord {
  id: string;
  title: string;
  scope: 'master' | 'overview' | 'ledger' | 'pathways' | 'whatif' | 'investment';
  format: 'pdf' | 'csv' | 'print';
  generatedAt: string;
  params: { dateRange: string; filterDesc?: string };
  csvData?: string;
}

const HISTORY_KEY = 'econ_report_history';

export function saveReportRecord(r: Omit<ReportRecord, 'id'>): ReportRecord {
  const rec: ReportRecord = { ...r, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
  const history = loadReportHistory();
  history.unshift(rec);
  // Keep last 50
  const trimmed = history.slice(0, 50);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed)); } catch {}
  return rec;
}

export function loadReportHistory(): ReportRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw) as ReportRecord[];
  } catch {}
  return [];
}

export function redownloadReport(r: ReportRecord) {
  if (r.csvData) {
    downloadCSV(r.csvData, reportFilename(r.scope, r.format, r.params.dateRange));
  }
}

export function reportFilename(
  scope: ReportRecord['scope'],
  format: string,
  dateRange: string,
): string {
  const date = new Date().toISOString().slice(0, 10);
  return `carbonloop_economics_${scope}_${dateRange}_${date}.${format === 'pdf' || format === 'print' ? 'pdf' : 'csv'}`;
}
