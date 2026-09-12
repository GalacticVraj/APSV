import React, { useEffect, useRef } from 'react';
import { X, FileText, Download, Printer, FileSpreadsheet, Calendar } from 'lucide-react';

export interface ReportOptions {
  dateStart: string;
  dateEnd: string;
  includeLedgerDetail: boolean;
  format: 'pdf' | 'print' | 'csv';
}

interface ReportOptionsPanelProps {
  viewName: string;
  viewKey: string;
  supportsCSV?: boolean;
  showLedgerToggle?: boolean;
  defaultOptions?: Partial<ReportOptions>;
  onGenerate: (options: ReportOptions) => void;
  onClose: () => void;
}

const TODAY = new Date().toISOString().slice(0, 10);
const MONTH_START = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

export default function ReportOptionsPanel({
  viewName,
  viewKey,
  supportsCSV = true,
  showLedgerToggle = false,
  defaultOptions,
  onGenerate,
  onClose,
}: ReportOptionsPanelProps) {
  const [opts, setOpts] = React.useState<ReportOptions>({
    dateStart: defaultOptions?.dateStart ?? MONTH_START,
    dateEnd:   defaultOptions?.dateEnd   ?? TODAY,
    includeLedgerDetail: defaultOptions?.includeLedgerDetail ?? true,
    format: defaultOptions?.format ?? 'pdf',
  });
  const [generating, setGenerating] = React.useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await onGenerate(opts);
    } finally {
      setGenerating(false);
    }
  };

  const FORMAT_OPTIONS: { key: ReportOptions['format']; label: string; icon: React.ReactNode; desc: string; available: boolean }[] = [
    {
      key: 'pdf',
      label: 'PDF Download',
      icon: <Download className="w-4 h-4" />,
      desc: 'Downloadable PDF with cover, KPI summary, charts, and methodology',
      available: true,
    },
    {
      key: 'print',
      label: 'Print',
      icon: <Printer className="w-4 h-4" />,
      desc: 'Opens browser print dialog with clean, ink-optimised layout',
      available: true,
    },
    {
      key: 'csv',
      label: 'CSV Export',
      icon: <FileSpreadsheet className="w-4 h-4" />,
      desc: 'Raw tabular data with machine-readable values and ISO timestamps',
      available: supportsCSV,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-fade-in border border-charcoal-200"
        style={{ animation: 'fadeSlideUp 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-charcoal-100 bg-forest-50 rounded-t-xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-forest-800 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-charcoal-900">Generate Report</p>
              <p className="text-xs text-charcoal-500">{viewName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-charcoal-400 hover:text-charcoal-700 hover:bg-charcoal-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Date range */}
          <div>
            <label className="label flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-forest-700" />
              Date Range
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={opts.dateStart}
                max={opts.dateEnd || TODAY}
                onChange={e => setOpts(o => ({ ...o, dateStart: e.target.value }))}
                className="input flex-1 text-xs py-2"
              />
              <span className="text-charcoal-400 text-xs font-medium flex-shrink-0">to</span>
              <input
                type="date"
                value={opts.dateEnd}
                min={opts.dateStart}
                max={TODAY}
                onChange={e => setOpts(o => ({ ...o, dateEnd: e.target.value }))}
                className="input flex-1 text-xs py-2"
              />
            </div>
            <div className="flex gap-2 mt-2">
              {[
                { label: 'This month', start: MONTH_START, end: TODAY },
                { label: 'Last 90d', start: new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10), end: TODAY },
                { label: 'This year', start: `${new Date().getFullYear()}-01-01`, end: TODAY },
              ].map(preset => (
                <button
                  key={preset.label}
                  onClick={() => setOpts(o => ({ ...o, dateStart: preset.start, dateEnd: preset.end }))}
                  className="text-[10px] font-semibold px-2 py-1 rounded-md border border-charcoal-200 text-charcoal-600 hover:bg-charcoal-50 hover:border-charcoal-300 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ledger detail toggle */}
          {showLedgerToggle && (
            <div>
              <label className="label">Trade Ledger Detail</label>
              <div className="flex gap-2">
                {[
                  { value: true, label: 'Full detail', desc: 'Every transaction row' },
                  { value: false, label: 'Summary only', desc: 'Aggregated totals' },
                ].map(opt => (
                  <button
                    key={String(opt.value)}
                    onClick={() => setOpts(o => ({ ...o, includeLedgerDetail: opt.value }))}
                    className={`flex-1 p-2.5 rounded-lg border text-left transition-colors ${
                      opts.includeLedgerDetail === opt.value
                        ? 'border-forest-600 bg-forest-50'
                        : 'border-charcoal-200 hover:bg-charcoal-50'
                    }`}
                  >
                    <p className={`text-xs font-semibold ${opts.includeLedgerDetail === opt.value ? 'text-forest-800' : 'text-charcoal-700'}`}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-charcoal-400 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Output format */}
          <div>
            <label className="label">Output Format</label>
            <div className="space-y-2">
              {FORMAT_OPTIONS.filter(f => f.available).map(fmt => (
                <button
                  key={fmt.key}
                  onClick={() => setOpts(o => ({ ...o, format: fmt.key }))}
                  disabled={!fmt.available}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                    opts.format === fmt.key
                      ? 'border-forest-600 bg-forest-50'
                      : 'border-charcoal-200 hover:bg-charcoal-50'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    opts.format === fmt.key ? 'bg-forest-800 text-white' : 'bg-charcoal-100 text-charcoal-500'
                  }`}>
                    {fmt.icon}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${opts.format === fmt.key ? 'text-forest-800' : 'text-charcoal-800'}`}>
                      {fmt.label}
                    </p>
                    <p className="text-[11px] text-charcoal-500 mt-0.5">{fmt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleGenerate}
            disabled={generating || !opts.dateStart || !opts.dateEnd}
            className="btn-primary flex-1"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating…
              </span>
            ) : opts.format === 'pdf' ? 'Download PDF' : opts.format === 'print' ? 'Open Print View' : 'Export CSV'}
          </button>
        </div>
      </div>
    </div>
  );
}
