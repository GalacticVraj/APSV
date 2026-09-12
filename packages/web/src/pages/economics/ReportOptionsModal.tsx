import { useState } from 'react';
import type { ReportRecord } from './ReportHelpers.ts';

export type ReportScope = 'master' | 'overview' | 'ledger' | 'pathways' | 'whatif' | 'investment';
export type ReportFormat = 'pdf' | 'csv' | 'print';

export interface ReportOptions {
  format: ReportFormat;
  dateRange: '7d' | '30d' | 'all';
  includeLedgerDetail: boolean;
}

const SCOPE_LABELS: Record<ReportScope, string> = {
  master: 'Full Master Report',
  overview: 'Overview Report',
  ledger: 'Trade Ledger Report',
  pathways: 'Pathway Economics Report',
  whatif: 'What-If Simulation Report',
  investment: 'Investment Opportunities Report',
};

export function ReportOptionsModal({
  isOpen,
  scope,
  onClose,
  onGenerate,
}: {
  isOpen: boolean;
  scope: ReportScope;
  onClose: () => void;
  onGenerate: (opts: ReportOptions) => void;
}) {
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'all'>('30d');
  const [includeLedger, setIncludeLedger] = useState(true);

  if (!isOpen) return null;

  const isMaster = scope === 'master';
  const hasLedger = scope === 'ledger' || isMaster;

  return (
    <div className="econ-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
      <div className="econ-modal">
        <div className="econ-modal-head">
          <h2 id="report-modal-title" style={{ fontSize: 15, margin: 0 }}>
            {SCOPE_LABELS[scope]}
          </h2>
          <button className="econ-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="econ-modal-body">
          {/* Cover notice */}
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
            Report generated live from current data at {new Date().toLocaleString('en-IN')}.
            Includes a cover section, KPI summary, methodology footnotes, and a footer on every page.
          </div>

          {/* Date range */}
          <div className="econ-form-group">
            <label className="econ-form-label" htmlFor="date-range-select">Date Range</label>
            <select
              id="date-range-select"
              className="econ-select"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </div>

          {/* Ledger detail toggle */}
          {hasLedger && (
            <div className="econ-form-group">
              <label className="econ-form-label">Trade Ledger</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
                  <input type="radio" name="ledger-detail" checked={includeLedger} onChange={() => setIncludeLedger(true)} />
                  Include full ledger rows
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
                  <input type="radio" name="ledger-detail" checked={!includeLedger} onChange={() => setIncludeLedger(false)} />
                  Summary only
                </label>
              </div>
            </div>
          )}

          {/* Format */}
          <div className="econ-form-group">
            <label className="econ-form-label">Output format</label>
            <div className="econ-format-btns">
              {(['pdf', 'print', 'csv'] as ReportFormat[]).map((f) => (
                <button
                  key={f}
                  className={`econ-format-btn${format === f ? ' selected' : ''}`}
                  onClick={() => setFormat(f)}
                >
                  {f === 'pdf' && '⬇ PDF'}
                  {f === 'print' && '🖨 Print'}
                  {f === 'csv' && '📊 CSV'}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 5 }}>
            {format === 'pdf' && "Opens the browser print dialog. Save as PDF using your browser's built-in PDF export."}
              {format === 'print' && 'Opens print dialog optimised for paper output. Navigation and buttons are hidden.'}
              {format === 'csv' && 'Downloads a machine-readable CSV with raw numbers, ISO timestamps, and no formatting.'}
            </div>
          </div>
        </div>

        <div className="econ-modal-foot">
          <button className="econ-btn" onClick={onClose}>Cancel</button>
          <button
            className="econ-btn green"
            onClick={() => onGenerate({ format, dateRange, includeLedgerDetail: includeLedger })}
          >
            Generate Report
          </button>
        </div>
      </div>
    </div>
  );
}
