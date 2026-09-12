import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import {
  TrendingUp, Leaf, FileText, Download, ChevronDown, ChevronUp,
  BookOpen, GitBranch, Sliders, Building2, Table, History,
  FileSpreadsheet, Printer, X, Info
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import AppLayout from '../components/layout/AppLayout';
import ReportOptionsPanel, { type ReportOptions } from '../components/economics/ReportOptionsPanel';
import apiClient from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverviewKPIs {
  total_co2_t: number;
  total_waste_diverted_t: number;
  estimated_carbon_value_inr: number;
  estimated_transport_cost_inr: number;
  net_value_inr: number;
  pickup_count: number;
}

interface MonthlyTrend { month: string; co2: number; waste_t: number; }
interface WasteTypeValue { waste_type: string; co2_t: number; volume_t: number; value_inr: number; co2_per_tonne: number; }

interface OverviewData {
  kpis: OverviewKPIs;
  monthly_trend: MonthlyTrend[];
  value_per_waste_type: WasteTypeValue[];
  shadow_prices: { avoided_emissions_inr_per_tco2: number; durable_removal_inr_per_tco2: number };
}

interface LedgerPickup {
  id: string;
  verified_at: string;
  waste_type: string;
  volume_t: number;
  co2_sequestered_t: number;
  distance_km: number;
  generator_name: string;
  generator_city: string;
  facility_name: string;
  facility_city: string;
  conversion_type: string;
  estimated_value_inr: number;
}

interface LedgerData {
  pickups: LedgerPickup[];
  pagination: { page: number; limit: number; total: number; pages: number };
  summary: { page_co2_t: number; page_volume_t: number };
}

interface Pathway {
  conversion_type: string;
  pickup_count: number;
  total_volume_t: number;
  total_co2_t: number;
  avg_co2_per_tonne: number;
  avg_distance_km: number;
  lcop_inr_per_tonne: number;
  shadow_price_inr_per_tco2: number;
  gross_value_inr: number;
  net_margin_inr: number;
  margin_per_tonne_inr: number;
}

interface FacilityInvestment {
  id: string;
  name: string;
  city: string;
  conversion_type: string;
  capacity_t_month: number;
  remaining_capacity_t: number;
  headroom_pct: number;
  avg_co2_per_tonne: number;
  shadow_price_inr: number;
  lcop_inr_per_tonne: number;
  annual_shadow_value_inr: number;
  annual_net_value_inr: number;
  break_even_distance_km: number;
  dcf_5y_inr: number;
  historical_pickups: number;
}

interface ReportHistoryEntry {
  id: string;
  type: string;
  status: string;
  date_range_start: string;
  date_range_end: string;
  file_url: string;
  created_at: string;
  filters_json?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

type TabKey = 'overview' | 'trade-ledger' | 'pathway-economics' | 'whats-if' | 'investment';

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'overview',           label: 'Overview',             icon: TrendingUp },
  { key: 'trade-ledger',       label: 'Trade Ledger',         icon: Table },
  { key: 'pathway-economics',  label: 'Pathway Economics',    icon: GitBranch },
  { key: 'whats-if',           label: 'What-If Simulator',    icon: Sliders },
  { key: 'investment',         label: 'Investment Opp.',      icon: Building2 },
];

const CONVERSION_LABELS: Record<string, string> = {
  biochar_pyrolysis:   'Biochar Pyrolysis',
  anaerobic_digestion: 'Anaerobic Digestion',
  aerobic_composting:  'Aerobic Composting',
  vermicomposting:     'Vermicomposting',
};

const WASTE_TYPE_LABELS: Record<string, string> = {
  food_organic: 'Food Organic', agricultural_biomass: 'Agricultural Biomass',
  industrial_biomass: 'Industrial Biomass', municipal_organic: 'Municipal Organic',
  food_processing: 'Food Processing', restaurant_waste: 'Restaurant Waste',
};

const PATHWAY_COLORS: Record<string, string> = {
  biochar_pyrolysis: '#166534', anaerobic_digestion: '#1d4ed8',
  aerobic_composting: '#b45309', vermicomposting: '#7c3aed',
};

const TODAY = new Date().toISOString().slice(0, 10);
const MONTH_START = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

function fmtINR(n: number) {
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function fmtDate(d: string) {
  try { return format(new Date(d), 'dd MMM yyyy'); } catch { return d; }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, unit, sub, accent = false }: {
  label: string; value: string; unit: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-sm border p-4 flex flex-col gap-1 ${accent ? 'border-forest-300 bg-forest-50' : 'border-charcoal-200 bg-white'}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal-500">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-bold ${accent ? 'text-forest-700' : 'text-charcoal-900'}`}>{value}</span>
        <span className="text-xs text-charcoal-400 font-medium">{unit}</span>
      </div>
      {sub && <p className="text-[10px] text-charcoal-400">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-bold text-charcoal-900 uppercase tracking-wider">{title}</h2>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

function ReportBtn({ onClick, label = 'Generate Report' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="btn-secondary text-xs px-3 py-1.5 gap-1.5">
      <FileText className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

function CsvBtn({ onClick, label = 'Export CSV' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="btn-ghost text-xs px-3 py-1.5 gap-1.5 text-charcoal-600">
      <FileSpreadsheet className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

// ─── Print Report Component (rendered when print mode active) ─────────────────

function PrintReportView({
  title,
  dateRange,
  timestamp,
  children,
  onClose,
}: { title: string; dateRange: string; timestamp: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="print-report">
      {/* Screen-only close button */}
      <button onClick={onClose} className="no-print fixed top-4 right-4 z-50 btn-secondary text-sm gap-2">
        <X className="w-4 h-4" /> Exit Print View
      </button>

      {/* Cover */}
      <div className="report-cover print-page-break">
        <div className="report-header-band">
          <span className="report-brand">CarbonLoop</span>
          <h1 className="report-title">{title}</h1>
        </div>
        <div className="report-meta">
          <p><strong>Date range:</strong> {dateRange}</p>
          <p><strong>Generated:</strong> {timestamp}</p>
        </div>
        <hr className="report-divider" />
      </div>

      {children}

      {/* Methodology */}
      <div className="report-methodology print-page-break">
        <hr className="report-divider" />
        <h3 className="report-section-title">Methodology &amp; Model References</h3>
        <ul className="report-methodology-list">
          <li>Carbon sequestration per EPA WARM v15; biogenic CO₂ excluded per IPCC AR6 WG3 §12.3.</li>
          <li>Durable removal (biochar): shadow price ₹10,800/tCO₂e. Two-pool first-order decay; Q10-corrected from 14.9 °C reference to local soil temperature. Durable removal and avoided emissions are never summed.</li>
          <li>Avoided emissions (CH₄, N₂O): shadow price ₹520/tCO₂e.</li>
          <li>Transport cost: DEFRA 2023 HGV factors (0.062 kg CO₂e/tonne-km); ₹12/tonne-km cost estimate.</li>
          <li>LCOP — Biochar Pyrolysis ₹3,200/t; Anaerobic Digestion ₹2,800/t; Aerobic Composting ₹1,200/t; Vermicomposting ₹900/t.</li>
          <li>DCF: 5-year NPV at 10% nominal discount rate (factor 3.791). Indicative only.</li>
          <li>MACC: pathways ranked by net margin per tonne CO₂e sequestered.</li>
        </ul>
      </div>

      {/* Print page footer (via CSS @media print position:fixed) */}
      <div className="print-footer">
        <span>{title}</span>
        <span>Generated: {timestamp}</span>
      </div>
    </div>
  );
}

// ─── Main EconomicsPage ───────────────────────────────────────────────────────

export default function EconomicsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Global filters
  const [dateStart, setDateStart] = useState(MONTH_START);
  const [dateEnd,   setDateEnd]   = useState(TODAY);
  const [wasteTypeFilter, setWasteTypeFilter] = useState('');

  // Data state
  const [overviewData, setOverviewData]     = useState<OverviewData | null>(null);
  const [ledgerData,   setLedgerData]       = useState<LedgerData   | null>(null);
  const [pathways,     setPathways]         = useState<Pathway[]>([]);
  const [investments,  setInvestments]      = useState<FacilityInvestment[]>([]);
  const [reportHistory,setReportHistory]    = useState<ReportHistoryEntry[]>([]);

  const [loadingOverview,   setLoadingOverview]   = useState(false);
  const [loadingLedger,     setLoadingLedger]     = useState(false);
  const [loadingPathways,   setLoadingPathways]   = useState(false);
  const [loadingInvestments,setLoadingInvestments]= useState(false);
  const [loadingHistory,    setLoadingHistory]    = useState(false);

  const [ledgerPage, setLedgerPage] = useState(1);
  const [showHistory,setShowHistory]= useState(false);

  // Report panel state
  const [reportPanel, setReportPanel] = useState<{ view: TabKey | 'full'; viewName: string } | null>(null);

  // Print mode state
  const [printMode, setPrintMode]   = useState<{ title: string; view: TabKey | 'full' } | null>(null);

  // What-If simulator state
  const [shadowMultiplier,    setShadowMultiplier]    = useState(1.0);
  const [transportMultiplier, setTransportMultiplier] = useState(1.0);
  const [capacityTarget,      setCapacityTarget]      = useState(0.8);

  // ── Data fetchers ────────────────────────────────────────────────────────

  const fetchOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const params = new URLSearchParams({ dateStart, dateEnd });
      if (wasteTypeFilter) params.append('wasteType', wasteTypeFilter);
      const { data } = await apiClient.get(`/api/economics/overview?${params}`);
      setOverviewData(data);
    } catch { toast.error('Failed to load overview data'); }
    finally { setLoadingOverview(false); }
  }, [dateStart, dateEnd, wasteTypeFilter]);

  const fetchLedger = useCallback(async (page = 1) => {
    setLoadingLedger(true);
    try {
      const params = new URLSearchParams({ dateStart, dateEnd, page: String(page), limit: '25' });
      if (wasteTypeFilter) params.append('wasteType', wasteTypeFilter);
      const { data } = await apiClient.get(`/api/economics/trade-ledger?${params}`);
      setLedgerData(data);
    } catch { toast.error('Failed to load trade ledger'); }
    finally { setLoadingLedger(false); }
  }, [dateStart, dateEnd, wasteTypeFilter]);

  const fetchPathways = useCallback(async () => {
    setLoadingPathways(true);
    try {
      const params = new URLSearchParams({ dateStart, dateEnd });
      const { data } = await apiClient.get(`/api/economics/pathway-economics?${params}`);
      setPathways(data.pathways);
    } catch { toast.error('Failed to load pathway economics'); }
    finally { setLoadingPathways(false); }
  }, [dateStart, dateEnd]);

  const fetchInvestments = useCallback(async () => {
    setLoadingInvestments(true);
    try {
      const { data } = await apiClient.get('/api/economics/investment-opportunities');
      setInvestments(data.facilities);
    } catch { toast.error('Failed to load investment opportunities'); }
    finally { setLoadingInvestments(false); }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data } = await apiClient.get('/api/reports');
      setReportHistory(data.reports);
    } catch { /* silent */ }
    finally { setLoadingHistory(false); }
  }, []);

  // Load data for active tab
  useEffect(() => {
    if (activeTab === 'overview')          fetchOverview();
    else if (activeTab === 'trade-ledger') { setLedgerPage(1); fetchLedger(1); }
    else if (activeTab === 'pathway-economics') fetchPathways();
    else if (activeTab === 'investment')   fetchInvestments();
  }, [activeTab, dateStart, dateEnd, wasteTypeFilter]);

  // Load overview always (for What-If baseline)
  useEffect(() => { fetchOverview(); }, [dateStart, dateEnd]);

  // ── Report generation handlers ───────────────────────────────────────────

  const buildApiParams = (opts: ReportOptions) =>
    new URLSearchParams({ dateStart: opts.dateStart, dateEnd: opts.dateEnd });

  const handleGenerateReport = useCallback(async (view: TabKey | 'full', opts: ReportOptions) => {
    const params = buildApiParams(opts);

    if (opts.format === 'csv') {
      const csvRoutes: Partial<Record<TabKey | 'full', string>> = {
        'trade-ledger':      '/api/reports/economics/trade-ledger/csv',
        'pathway-economics': '/api/reports/economics/pathway-economics/csv',
        'investment':        '/api/reports/economics/investment-opportunities/csv',
        'overview':          '/api/reports/impact/csv',
      };
      const url = csvRoutes[view];
      if (!url) { toast('CSV export not available for this view.'); return; }
      if (opts.format === 'csv' && view === 'trade-ledger' && wasteTypeFilter) {
        params.append('wasteType', wasteTypeFilter);
      }
      const link = document.createElement('a');
      link.href = `${apiClient.defaults.baseURL}${url}?${params}&token=${localStorage.getItem('accessToken') || ''}`;
      // Proper download via API call with auth header
      const response = await apiClient.get(`${url}?${params}`, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      link.href = blobUrl;
      link.download = `carbonloop-${view}-${opts.dateStart}-to-${opts.dateEnd}.csv`;
      link.click();
      URL.revokeObjectURL(blobUrl);
      toast.success('CSV downloaded');
      return;
    }

    if (opts.format === 'print') {
      const viewNameMap: Partial<Record<TabKey | 'full', string>> = {
        overview: 'Economic Overview', 'trade-ledger': 'Trade Ledger',
        'pathway-economics': 'Pathway Economics', 'whats-if': 'What-If Scenario',
        investment: 'Investment Opportunities', full: 'Full Economic Report',
      };
      setPrintMode({ title: viewNameMap[view] || 'Economics Report', view });
      setReportPanel(null);
      setTimeout(() => window.print(), 300);
      return;
    }

    // PDF download
    const pdfUrl = view === 'full'
      ? `/api/reports/economics/full-report/pdf?${params}`
      : `/api/reports/economics/view-report/pdf?view=${view}&${params}`;
    try {
      toast.loading('Generating PDF…', { id: 'pdf-gen' });
      const response = await apiClient.get(pdfUrl, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `carbonloop-${view}-${opts.dateStart}-to-${opts.dateEnd}.pdf`;
      link.click();
      URL.revokeObjectURL(blobUrl);
      toast.success('PDF downloaded', { id: 'pdf-gen' });

      // Save to history
      await apiClient.post('/api/reports', {
        type: view, format: 'pdf',
        dateRangeStart: opts.dateStart, dateRangeEnd: opts.dateEnd,
      });
      fetchHistory();
    } catch {
      toast.error('PDF generation failed', { id: 'pdf-gen' });
    }
    setReportPanel(null);
  }, [wasteTypeFilter, fetchHistory]);

  const openReportPanel = (view: TabKey | 'full') => {
    const viewNameMap: Record<TabKey | 'full', string> = {
      overview: 'Overview', 'trade-ledger': 'Trade Ledger',
      'pathway-economics': 'Pathway Economics', 'whats-if': 'What-If Simulator',
      investment: 'Investment Opportunities', full: 'Full Economic Report',
    };
    setReportPanel({ view, viewName: viewNameMap[view] });
  };

  // What-If computed values
  const whatIfProjected = overviewData ? {
    netValue: Math.round(
      overviewData.kpis.estimated_carbon_value_inr * shadowMultiplier -
      overviewData.kpis.estimated_transport_cost_inr * transportMultiplier
    ),
    co2Delta: parseFloat((overviewData.kpis.total_co2_t * capacityTarget).toFixed(2)),
    breakEvenVol: overviewData.kpis.estimated_carbon_value_inr > 0
      ? parseFloat((overviewData.kpis.total_waste_diverted_t * (1 / shadowMultiplier)).toFixed(1))
      : 0,
  } : null;

  const isLoading = (tab: TabKey) => {
    if (tab === 'overview')          return loadingOverview;
    if (tab === 'trade-ledger')      return loadingLedger;
    if (tab === 'pathway-economics') return loadingPathways;
    if (tab === 'investment')        return loadingInvestments;
    return false;
  };

  // ── Print mode ──────────────────────────────────────────────────────────

  if (printMode) {
    const dr = `${fmtDate(dateStart)} → ${fmtDate(dateEnd)}`;
    const ts = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' });

    return (
      <PrintReportView
        title={printMode.title}
        dateRange={dr}
        timestamp={ts}
        onClose={() => setPrintMode(null)}
      >
        {/* Overview section always included */}
        {overviewData && (
          <div className="report-section">
            <h2 className="report-section-title">Economic Overview</h2>
            <table className="report-kpi-table">
              <tbody>
                <tr>
                  <td>CO₂ Sequestered</td>
                  <td className="report-kpi-value">{overviewData.kpis.total_co2_t.toFixed(2)} t</td>
                </tr>
                <tr>
                  <td>Waste Diverted</td>
                  <td className="report-kpi-value">{overviewData.kpis.total_waste_diverted_t.toFixed(1)} t</td>
                </tr>
                <tr>
                  <td>Estimated Carbon Value</td>
                  <td className="report-kpi-value">{fmtINR(overviewData.kpis.estimated_carbon_value_inr)}</td>
                </tr>
                <tr>
                  <td>Estimated Transport Cost</td>
                  <td className="report-kpi-value">{fmtINR(overviewData.kpis.estimated_transport_cost_inr)}</td>
                </tr>
                <tr>
                  <td>Net Economic Value</td>
                  <td className="report-kpi-value report-kpi-accent">{fmtINR(overviewData.kpis.net_value_inr)}</td>
                </tr>
                <tr>
                  <td>Verified Transactions</td>
                  <td className="report-kpi-value">{overviewData.kpis.pickup_count}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Pathway section if full report or pathway tab */}
        {(printMode.view === 'full' || printMode.view === 'pathway-economics') && pathways.length > 0 && (
          <div className="report-section">
            <h2 className="report-section-title">Pathway Economics</h2>
            <table className="report-data-table">
              <thead>
                <tr>
                  <th>Pathway</th><th>Pickups</th><th>Volume (t)</th><th>CO₂ (t)</th>
                  <th>CO₂/t</th><th>LCOP (₹/t)</th><th>Net Margin (₹)</th>
                </tr>
              </thead>
              <tbody>
                {pathways.map(p => (
                  <tr key={p.conversion_type}>
                    <td>{CONVERSION_LABELS[p.conversion_type] || p.conversion_type}</td>
                    <td>{p.pickup_count}</td>
                    <td>{p.total_volume_t.toFixed(1)}</td>
                    <td>{p.total_co2_t.toFixed(2)}</td>
                    <td>{p.avg_co2_per_tonne.toFixed(3)}</td>
                    <td>{p.lcop_inr_per_tonne.toLocaleString('en-IN')}</td>
                    <td>{p.net_margin_inr.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Ledger for full report or trade-ledger tab */}
        {(printMode.view === 'full' || printMode.view === 'trade-ledger') && ledgerData && ledgerData.pickups.length > 0 && (
          <div className="report-section report-appendix">
            <h2 className="report-section-title">Trade Ledger</h2>
            <table className="report-data-table">
              <thead>
                <tr>
                  <th>Date</th><th>Generator</th><th>Waste Type</th>
                  <th>Volume (t)</th><th>Facility</th><th>CO₂ (t)</th><th>Dist (km)</th>
                </tr>
              </thead>
              <tbody>
                {ledgerData.pickups.map(p => (
                  <tr key={p.id}>
                    <td>{fmtDate(p.verified_at)}</td>
                    <td>{p.generator_name}</td>
                    <td>{(WASTE_TYPE_LABELS[p.waste_type] || p.waste_type).replace(/_/g, ' ')}</td>
                    <td>{p.volume_t.toFixed(1)}</td>
                    <td>{p.facility_name}</td>
                    <td>{p.co2_sequestered_t.toFixed(3)}</td>
                    <td>{p.distance_km.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PrintReportView>
    );
  }

  // ── Normal screen render ─────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6 animate-fade-in no-print">
        {/* ── Page Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 pb-6 border-b border-charcoal-200">
          <div>
            <h1 className="text-2xl font-bold text-charcoal-900 tracking-tight">Economics Manager</h1>
            <p className="text-sm text-charcoal-500 mt-1">Carbon value analytics, pathway economics, and investment insights</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Global date filter */}
            <div className="flex items-center gap-2 border border-charcoal-200 rounded-sm bg-white px-3 py-1.5">
              <input type="date" value={dateStart} max={dateEnd}
                onChange={e => setDateStart(e.target.value)}
                className="text-xs border-none outline-none bg-transparent text-charcoal-700 font-medium" />
              <span className="text-charcoal-400 text-xs">→</span>
              <input type="date" value={dateEnd} min={dateStart} max={TODAY}
                onChange={e => setDateEnd(e.target.value)}
                className="text-xs border-none outline-none bg-transparent text-charcoal-700 font-medium" />
            </div>

            {/* Report history toggle */}
            <button
              onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchHistory(); }}
              className="btn-secondary text-xs px-3 py-2 gap-1.5"
            >
              <History className="w-3.5 h-3.5" />
              History
              {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {/* Full Report button */}
            <button
              onClick={() => openReportPanel('full')}
              className="btn-primary text-xs px-4 py-2 gap-2"
              id="full-report-btn"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Full Report
            </button>
          </div>
        </div>

        {/* ── Report History Panel ── */}
        {showHistory && (
          <div className="border border-charcoal-200 rounded-sm bg-white p-5 no-print">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-charcoal-900 uppercase tracking-wider">Report History</h3>
              <button onClick={() => setShowHistory(false)} className="text-charcoal-400 hover:text-charcoal-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            {loadingHistory ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-10 skeleton rounded-sm" />)}
              </div>
            ) : reportHistory.length === 0 ? (
              <p className="text-xs text-charcoal-400 py-4 text-center">No reports generated yet. Use the report buttons below to get started.</p>
            ) : (
              <div className="divide-y divide-charcoal-100">
                {reportHistory.map(r => (
                  <div key={r.id} className="py-2.5 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-md bg-forest-50 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-3.5 h-3.5 text-forest-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-charcoal-900 capitalize">{r.type.replace('-', ' ')} Report</p>
                      <p className="text-[10px] text-charcoal-400">
                        {fmtDate(r.date_range_start)} → {fmtDate(r.date_range_end)} ·{' '}
                        {format(new Date(r.created_at), 'dd MMM HH:mm')}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      r.status === 'completed' ? 'bg-forest-100 text-forest-800' : 'bg-charcoal-100 text-charcoal-600'
                    }`}>{r.status}</span>
                    {r.status === 'completed' && r.file_url && (
                      <a
                        href={`${apiClient.defaults.baseURL}${r.file_url}`}
                        target="_blank" rel="noreferrer"
                        className="p-1.5 rounded-md border border-charcoal-200 text-charcoal-500 hover:text-forest-700 hover:border-forest-300 transition-colors"
                        title="Download again"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab Navigation ── */}
        <div className="flex border-b border-charcoal-200 gap-0 no-print" role="tablist">
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                  active
                    ? 'border-forest-700 text-forest-800'
                    : 'border-transparent text-charcoal-500 hover:text-charcoal-800 hover:border-charcoal-300'
                }`}
              >
                <tab.icon className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ── */}

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Grid */}
            {loadingOverview ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => <div key={i} className="h-24 skeleton rounded-sm" />)}
              </div>
            ) : overviewData ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-charcoal-500 uppercase tracking-wider">Economic KPIs</h2>
                  <div className="flex gap-2">
                    <CsvBtn onClick={() => {
                      const url = `/api/reports/impact/csv?dateStart=${dateStart}&dateEnd=${dateEnd}`;
                      apiClient.get(url, { responseType: 'blob' }).then(r => {
                        const bl = URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }));
                        const a = document.createElement('a'); a.href = bl;
                        a.download = `carbonloop-overview-${dateStart}-to-${dateEnd}.csv`; a.click();
                        URL.revokeObjectURL(bl);
                      });
                    }} />
                    <ReportBtn onClick={() => openReportPanel('overview')} />
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  <KpiCard label="Net Economic Value" value={fmtINR(overviewData.kpis.net_value_inr)} unit="estimated" accent />
                  <KpiCard label="CO₂ Sequestered" value={overviewData.kpis.total_co2_t.toFixed(2)} unit="tCO₂e" accent />
                  <KpiCard label="Waste Diverted" value={overviewData.kpis.total_waste_diverted_t.toFixed(1)} unit="tonnes" />
                  <KpiCard label="Carbon Value" value={fmtINR(overviewData.kpis.estimated_carbon_value_inr)} unit="gross" sub={`Shadow prices: ₹${overviewData.shadow_prices.avoided_emissions_inr_per_tco2}/t avoided · ₹${overviewData.shadow_prices.durable_removal_inr_per_tco2}/t durable`} />
                  <KpiCard label="Transport Cost" value={fmtINR(overviewData.kpis.estimated_transport_cost_inr)} unit="estimated" />
                  <KpiCard label="Verified Transactions" value={overviewData.kpis.pickup_count.toString()} unit="pickups" />
                </div>

                {/* Charts Row */}
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Monthly Value Flow */}
                  <div className="border border-charcoal-200 rounded-sm bg-white p-5">
                    <SectionHeader title="Monthly Value Flow (CO₂e)" />
                    {overviewData.monthly_trend.length > 0 ? (
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={overviewData.monthly_trend}>
                            <defs>
                              <linearGradient id="co2Grad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#166534" stopOpacity={0.15} />
                                <stop offset="95%" stopColor="#166534" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '4px', border: '1px solid #e5e7eb', fontSize: '11px' }}
                              formatter={(v: number) => [`${v.toFixed(2)} tCO₂e`]} />
                            <Area type="monotone" dataKey="co2" stroke="#166534" strokeWidth={2} fill="url(#co2Grad)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-48 flex items-center justify-center text-xs text-charcoal-400">No monthly data available</div>
                    )}
                  </div>

                  {/* Value per Waste Type */}
                  <div className="border border-charcoal-200 rounded-sm bg-white p-5">
                    <SectionHeader title="Value by Waste Stream" />
                    {overviewData.value_per_waste_type.length > 0 ? (
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={overviewData.value_per_waste_type} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false}
                              tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                            <YAxis type="category" dataKey="waste_type" tick={{ fontSize: 9, fill: '#6b7280' }} width={110}
                              tickFormatter={k => (WASTE_TYPE_LABELS[k] || k).slice(0, 14)} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '4px', border: '1px solid #e5e7eb', fontSize: '11px' }}
                              formatter={(v: number) => [fmtINR(v), 'Est. value']} />
                            <Bar dataKey="value_inr" radius={[0, 3, 3, 0]}>
                              {overviewData.value_per_waste_type.map((_, i) => (
                                <Cell key={i} fill={i === 0 ? '#166534' : i === 1 ? '#15803d' : i === 2 ? '#16a34a' : '#4ade80'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-48 flex items-center justify-center text-xs text-charcoal-400">No waste type data available</div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-16 text-sm text-charcoal-400">No data for selected period.</div>
            )}
          </div>
        )}

        {/* ── TRADE LEDGER TAB ── */}
        {activeTab === 'trade-ledger' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={wasteTypeFilter}
                onChange={e => setWasteTypeFilter(e.target.value)}
                className="select text-xs py-1.5 w-48"
              >
                <option value="">All Waste Types</option>
                {Object.entries(WASTE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <div className="flex-1" />
              <CsvBtn
                onClick={() => {
                  const params = new URLSearchParams({ dateStart, dateEnd });
                  if (wasteTypeFilter) params.append('wasteType', wasteTypeFilter);
                  apiClient.get(`/api/reports/economics/trade-ledger/csv?${params}`, { responseType: 'blob' })
                    .then(r => {
                      const bl = URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }));
                      const a = document.createElement('a'); a.href = bl;
                      const wt = wasteTypeFilter ? `-${wasteTypeFilter}` : '';
                      a.download = `carbonloop-trade-ledger-${dateStart}-to-${dateEnd}${wt}.csv`;
                      a.click(); URL.revokeObjectURL(bl);
                      toast.success('Trade Ledger exported');
                    });
                }}
              />
              <ReportBtn onClick={() => openReportPanel('trade-ledger')} />
            </div>

            {/* Ledger table */}
            {loadingLedger ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-10 skeleton rounded-sm" />)}</div>
            ) : ledgerData ? (
              <>
                {ledgerData.summary && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="border border-charcoal-200 rounded-sm bg-white px-4 py-2.5 flex items-center justify-between">
                      <span className="text-charcoal-500 font-medium">Page CO₂</span>
                      <span className="font-bold text-forest-700">{ledgerData.summary.page_co2_t.toFixed(2)} t</span>
                    </div>
                    <div className="border border-charcoal-200 rounded-sm bg-white px-4 py-2.5 flex items-center justify-between">
                      <span className="text-charcoal-500 font-medium">Page Volume</span>
                      <span className="font-bold text-charcoal-800">{ledgerData.summary.page_volume_t.toFixed(1)} t</span>
                    </div>
                  </div>
                )}
                <div className="border border-charcoal-200 rounded-sm bg-white overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-charcoal-50 border-b border-charcoal-200">
                        <tr>
                          {['Date', 'Generator', 'Waste Type', 'Volume (t)', 'Facility', 'Pathway', 'CO₂ (t)', 'Dist (km)', 'Est. Value'].map(h => (
                            <th key={h} className="text-left py-2.5 px-3 text-[10px] font-bold text-charcoal-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-charcoal-100">
                        {ledgerData.pickups.length === 0 ? (
                          <tr><td colSpan={9} className="py-10 text-center text-charcoal-400">No transactions in this period</td></tr>
                        ) : ledgerData.pickups.map(p => (
                          <tr key={p.id} className="hover:bg-charcoal-50 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-[10px] text-charcoal-500 whitespace-nowrap">{fmtDate(p.verified_at)}</td>
                            <td className="py-2.5 px-3">
                              <p className="font-semibold text-charcoal-900 truncate max-w-[120px]">{p.generator_name}</p>
                              <p className="text-[10px] text-charcoal-400">{p.generator_city}</p>
                            </td>
                            <td className="py-2.5 px-3 capitalize text-charcoal-700">{(WASTE_TYPE_LABELS[p.waste_type] || p.waste_type).replace(/_/g, ' ')}</td>
                            <td className="py-2.5 px-3 font-mono text-charcoal-800">{p.volume_t.toFixed(1)}</td>
                            <td className="py-2.5 px-3">
                              <p className="font-semibold text-charcoal-900 truncate max-w-[110px]">{p.facility_name}</p>
                              <p className="text-[10px] text-charcoal-400">{p.facility_city}</p>
                            </td>
                            <td className="py-2.5 px-3 text-charcoal-600">{(CONVERSION_LABELS[p.conversion_type] || p.conversion_type).split(' ')[0]}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-forest-700">{p.co2_sequestered_t.toFixed(3)}</td>
                            <td className="py-2.5 px-3 font-mono text-charcoal-500">{p.distance_km.toFixed(0)}</td>
                            <td className="py-2.5 px-3 font-semibold text-charcoal-800">{fmtINR(p.estimated_value_inr)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                {ledgerData.pagination.pages > 1 && (
                  <div className="flex items-center justify-between text-xs text-charcoal-500">
                    <span>Page {ledgerData.pagination.page} of {ledgerData.pagination.pages} ({ledgerData.pagination.total} total)</span>
                    <div className="flex gap-2">
                      <button
                        disabled={ledgerPage <= 1}
                        onClick={() => { const p = ledgerPage - 1; setLedgerPage(p); fetchLedger(p); }}
                        className="px-3 py-1.5 border border-charcoal-200 rounded-sm disabled:opacity-40 hover:bg-charcoal-50 transition-colors"
                      >← Prev</button>
                      <button
                        disabled={ledgerPage >= ledgerData.pagination.pages}
                        onClick={() => { const p = ledgerPage + 1; setLedgerPage(p); fetchLedger(p); }}
                        className="px-3 py-1.5 border border-charcoal-200 rounded-sm disabled:opacity-40 hover:bg-charcoal-50 transition-colors"
                      >Next →</button>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* ── PATHWAY ECONOMICS TAB ── */}
        {activeTab === 'pathway-economics' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-charcoal-900 uppercase tracking-wider">Pathway Comparison</h2>
                <p className="text-xs text-charcoal-500 mt-0.5">Ranked by net margin after Levelised Cost of Processing</p>
              </div>
              <div className="flex gap-2">
                <CsvBtn onClick={() => {
                  const params = new URLSearchParams({ dateStart, dateEnd });
                  apiClient.get(`/api/reports/economics/pathway-economics/csv?${params}`, { responseType: 'blob' })
                    .then(r => {
                      const bl = URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }));
                      const a = document.createElement('a'); a.href = bl;
                      a.download = `carbonloop-pathway-economics-${dateStart}-to-${dateEnd}.csv`;
                      a.click(); URL.revokeObjectURL(bl);
                      toast.success('Pathway data exported');
                    });
                }} />
                <ReportBtn onClick={() => openReportPanel('pathway-economics')} />
              </div>
            </div>

            {loadingPathways ? (
              <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 skeleton rounded-sm" />)}</div>
            ) : pathways.length === 0 ? (
              <div className="text-center py-16 text-sm text-charcoal-400">No pathway data available for this period.</div>
            ) : (
              <>
                {/* Visual pathway bars */}
                <div className="h-56 border border-charcoal-200 rounded-sm bg-white p-5">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pathways}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="conversion_type" tick={{ fontSize: 10, fill: '#6b7280' }}
                        tickFormatter={k => (CONVERSION_LABELS[k] || k).split(' ')[0]} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false}
                        tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                      <Tooltip contentStyle={{ borderRadius: '4px', border: '1px solid #e5e7eb', fontSize: '11px' }}
                        formatter={(v: number, name: string) => [
                          name === 'net_margin_inr' ? fmtINR(v) : name === 'gross_value_inr' ? fmtINR(v) : v,
                          name === 'net_margin_inr' ? 'Net Margin' : 'Gross Value',
                        ]} />
                      <Bar dataKey="gross_value_inr" fill="#dcfce7" name="gross_value_inr" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="net_margin_inr" name="net_margin_inr" radius={[3, 3, 0, 0]}>
                        {pathways.map((p) => (
                          <Cell key={p.conversion_type} fill={PATHWAY_COLORS[p.conversion_type] || '#166534'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Pathway detail table */}
                <div className="border border-charcoal-200 rounded-sm bg-white overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-charcoal-50 border-b border-charcoal-200">
                        <tr>
                          {['Pathway', 'Pickups', 'Volume (t)', 'Total CO₂ (t)', 'CO₂/Tonne', 'Avg Dist (km)', 'LCOP (₹/t)', 'Shadow Price', 'Gross Value', 'Net Margin', 'Margin/Tonne'].map(h => (
                            <th key={h} className="text-left py-2.5 px-3 text-[10px] font-bold text-charcoal-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-charcoal-100">
                        {pathways.map((p, i) => (
                          <tr key={p.conversion_type} className="hover:bg-charcoal-50 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PATHWAY_COLORS[p.conversion_type] || '#166534' }} />
                                <span className="font-semibold text-charcoal-900">{CONVERSION_LABELS[p.conversion_type] || p.conversion_type}</span>
                              </div>
                              {i === 0 && <span className="text-[9px] text-forest-700 font-bold uppercase">▲ Highest margin</span>}
                            </td>
                            <td className="py-2.5 px-3 font-mono">{p.pickup_count}</td>
                            <td className="py-2.5 px-3 font-mono">{p.total_volume_t.toFixed(1)}</td>
                            <td className="py-2.5 px-3 font-mono font-semibold text-forest-700">{p.total_co2_t.toFixed(2)}</td>
                            <td className="py-2.5 px-3 font-mono">{p.avg_co2_per_tonne.toFixed(4)}</td>
                            <td className="py-2.5 px-3 font-mono">{p.avg_distance_km.toFixed(0)}</td>
                            <td className="py-2.5 px-3 font-mono text-charcoal-600">₹{p.lcop_inr_per_tonne.toLocaleString('en-IN')}</td>
                            <td className="py-2.5 px-3 font-mono text-blue-700">₹{p.shadow_price_inr_per_tco2.toLocaleString('en-IN')}</td>
                            <td className="py-2.5 px-3 font-mono">{fmtINR(p.gross_value_inr)}</td>
                            <td className={`py-2.5 px-3 font-mono font-bold ${p.net_margin_inr >= 0 ? 'text-forest-700' : 'text-red-600'}`}>
                              {fmtINR(p.net_margin_inr)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-charcoal-700">{fmtINR(p.margin_per_tonne_inr)}/t</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── WHAT-IF SIMULATOR TAB ── */}
        {activeTab === 'whats-if' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-charcoal-900 uppercase tracking-wider">What-If Simulator</h2>
                <p className="text-xs text-charcoal-500 mt-0.5">Adjust parameters to model economic scenarios. Based on current period baseline.</p>
              </div>
              <ReportBtn onClick={() => openReportPanel('whats-if')} label="Export Scenario" />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Sliders */}
              <div className="border border-charcoal-200 rounded-sm bg-white p-6 space-y-6">
                <h3 className="text-xs font-bold text-charcoal-900 uppercase tracking-wider">Scenario Parameters</h3>

                {[
                  {
                    label: 'Shadow Carbon Price Multiplier',
                    sub: `${(shadowMultiplier * (overviewData?.shadow_prices.avoided_emissions_inr_per_tco2 || 520)).toFixed(0)} ₹/tCO₂e avoided`,
                    value: shadowMultiplier, min: 0.25, max: 4.0, step: 0.05,
                    onChange: setShadowMultiplier,
                    display: `${shadowMultiplier.toFixed(2)}×`,
                  },
                  {
                    label: 'Transport Cost Multiplier',
                    sub: `₹${(transportMultiplier * 12).toFixed(0)}/tonne-km`,
                    value: transportMultiplier, min: 0.5, max: 3.0, step: 0.05,
                    onChange: setTransportMultiplier,
                    display: `${transportMultiplier.toFixed(2)}×`,
                  },
                  {
                    label: 'Capacity Utilisation Target',
                    sub: `${(capacityTarget * 100).toFixed(0)}% of theoretical maximum throughput`,
                    value: capacityTarget, min: 0.2, max: 1.0, step: 0.05,
                    onChange: setCapacityTarget,
                    display: `${(capacityTarget * 100).toFixed(0)}%`,
                  },
                ].map(slider => (
                  <div key={slider.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-charcoal-700">{slider.label}</label>
                      <span className="text-sm font-bold text-forest-700 font-mono">{slider.display}</span>
                    </div>
                    <input
                      type="range" min={slider.min} max={slider.max} step={slider.step}
                      value={slider.value}
                      onChange={e => slider.onChange(parseFloat(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{ accentColor: '#166534' }}
                    />
                    <p className="text-[10px] text-charcoal-400 mt-1">{slider.sub}</p>
                  </div>
                ))}

                <button
                  onClick={() => { setShadowMultiplier(1); setTransportMultiplier(1); setCapacityTarget(0.8); }}
                  className="text-xs text-charcoal-500 hover:text-charcoal-700 underline"
                >
                  Reset to baseline
                </button>
              </div>

              {/* Projected outputs */}
              <div className="space-y-4">
                <div className="border border-charcoal-200 rounded-sm bg-white p-6">
                  <h3 className="text-xs font-bold text-charcoal-900 uppercase tracking-wider mb-4">Projected Outputs</h3>
                  {whatIfProjected && overviewData ? (
                    <div className="space-y-4">
                      {[
                        {
                          label: 'Projected Net Value',
                          baseline: fmtINR(overviewData.kpis.net_value_inr),
                          projected: fmtINR(whatIfProjected.netValue),
                          delta: whatIfProjected.netValue - overviewData.kpis.net_value_inr,
                          accent: true,
                        },
                        {
                          label: 'Projected CO₂ at Target Capacity',
                          baseline: `${overviewData.kpis.total_co2_t.toFixed(2)} t`,
                          projected: `${whatIfProjected.co2Delta} t`,
                          delta: whatIfProjected.co2Delta - overviewData.kpis.total_co2_t,
                          accent: false,
                        },
                        {
                          label: 'Break-Even Volume',
                          baseline: `${overviewData.kpis.total_waste_diverted_t.toFixed(1)} t`,
                          projected: `${whatIfProjected.breakEvenVol} t`,
                          delta: whatIfProjected.breakEvenVol - overviewData.kpis.total_waste_diverted_t,
                          accent: false,
                        },
                      ].map(row => (
                        <div key={row.label} className={`p-3.5 rounded-sm border ${row.accent ? 'border-forest-300 bg-forest-50' : 'border-charcoal-100 bg-charcoal-50'}`}>
                          <p className="text-[10px] font-bold text-charcoal-500 uppercase">{row.label}</p>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className={`text-xl font-bold ${row.accent ? 'text-forest-700' : 'text-charcoal-800'}`}>{row.projected}</span>
                            <span className={`text-xs font-semibold ${row.delta >= 0 ? 'text-forest-600' : 'text-red-600'}`}>
                              {row.delta >= 0 ? '▲' : '▼'} vs {row.baseline}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-charcoal-400">Load Overview tab first to see baseline figures</div>
                  )}
                </div>

                {/* Parameter note */}
                <div className="border border-charcoal-100 rounded-sm bg-charcoal-50 p-4 flex gap-2">
                  <Info className="w-3.5 h-3.5 text-charcoal-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-charcoal-500 leading-relaxed">
                    Projections are multiplicative adjustments on the current period baseline. Carbon value uses the same dual shadow prices from ARCHITECTURE.md: ₹10,800/tCO₂e durable (biochar) and ₹520/tCO₂e avoided (other pathways). Transport cost uses ₹12/tonne-km base. All figures are indicative.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── INVESTMENT OPPORTUNITIES TAB ── */}
        {activeTab === 'investment' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-charcoal-900 uppercase tracking-wider">Investment Opportunities</h2>
                <p className="text-xs text-charcoal-500 mt-0.5">Facilities ranked by 5-year DCF at 10% from remaining capacity headroom</p>
              </div>
              <div className="flex gap-2">
                <CsvBtn onClick={() => {
                  apiClient.get('/api/reports/economics/investment-opportunities/csv', { responseType: 'blob' })
                    .then(r => {
                      const bl = URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }));
                      const a = document.createElement('a'); a.href = bl;
                      a.download = `carbonloop-investment-opportunities-${TODAY}.csv`;
                      a.click(); URL.revokeObjectURL(bl);
                      toast.success('Investment data exported');
                    });
                }} />
                <ReportBtn onClick={() => openReportPanel('investment')} />
              </div>
            </div>

            {loadingInvestments ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 skeleton rounded-sm" />)}</div>
            ) : investments.length === 0 ? (
              <div className="text-center py-16 text-sm text-charcoal-400">No facility data available.</div>
            ) : (
              <div className="border border-charcoal-200 rounded-sm bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-charcoal-50 border-b border-charcoal-200">
                      <tr>
                        {['#', 'Facility', 'City', 'Pathway', 'Remaining Cap.', 'Headroom', 'CO₂/t', 'Shadow Price', 'LCOP', 'Break-Even (km)', 'Annual Net', '5Y DCF'].map(h => (
                          <th key={h} className="text-left py-2.5 px-3 text-[10px] font-bold text-charcoal-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-charcoal-100">
                      {investments.map((fac, i) => (
                        <tr key={fac.id} className="hover:bg-charcoal-50 transition-colors">
                          <td className="py-2.5 px-3">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                              i === 0 ? 'bg-forest-800 text-white' : i < 3 ? 'bg-forest-100 text-forest-800' : 'bg-charcoal-100 text-charcoal-600'
                            }`}>{i + 1}</span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-charcoal-900 max-w-[130px]">
                            <p className="truncate">{fac.name}</p>
                          </td>
                          <td className="py-2.5 px-3 text-charcoal-500">{fac.city}</td>
                          <td className="py-2.5 px-3 text-charcoal-600">
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: PATHWAY_COLORS[fac.conversion_type] || '#166534' }} />
                              {(CONVERSION_LABELS[fac.conversion_type] || fac.conversion_type).split(' ')[0]}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono">{fac.remaining_capacity_t.toFixed(0)} t</td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 h-1.5 bg-charcoal-100 rounded-full overflow-hidden max-w-[48px]">
                                <div className="h-full rounded-full bg-forest-500" style={{ width: `${Math.min(fac.headroom_pct, 100)}%` }} />
                              </div>
                              <span className="font-mono text-charcoal-700">{fac.headroom_pct}%</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono">{fac.avg_co2_per_tonne.toFixed(3)}</td>
                          <td className="py-2.5 px-3 font-mono text-blue-700">₹{fac.shadow_price_inr.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3 font-mono text-charcoal-600">₹{fac.lcop_inr_per_tonne.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3 font-mono">{fac.break_even_distance_km} km</td>
                          <td className={`py-2.5 px-3 font-mono font-semibold ${fac.annual_net_value_inr >= 0 ? 'text-forest-700' : 'text-red-600'}`}>
                            {fmtINR(fac.annual_net_value_inr)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-charcoal-900">{fmtINR(fac.dcf_5y_inr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Report Options Panel Modal ── */}
      {reportPanel && (
        <ReportOptionsPanel
          viewName={reportPanel.viewName}
          viewKey={reportPanel.view}
          supportsCSV={reportPanel.view !== 'whats-if' && reportPanel.view !== 'full'}
          showLedgerToggle={reportPanel.view === 'trade-ledger' || reportPanel.view === 'full'}
          defaultOptions={{ dateStart, dateEnd, format: 'pdf' }}
          onGenerate={(opts) => handleGenerateReport(reportPanel.view, opts)}
          onClose={() => setReportPanel(null)}
        />
      )}
    </AppLayout>
  );
}
