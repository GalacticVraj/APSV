import { useState } from 'react';
import { loadReportHistory, redownloadReport, downloadCSV } from './ReportHelpers.ts';
import type { ReportRecord } from './ReportHelpers.ts';

const SCOPE_LABELS: Record<string, string> = {
  master: 'Full Master Report',
  overview: 'Overview',
  ledger: 'Trade Ledger',
  pathways: 'Pathway Economics',
  whatif: 'What-If Simulation',
  investment: 'Investment Opportunities',
};

export function ReportHistoryView() {
  const [history, setHistory] = useState<ReportRecord[]>(loadReportHistory);

  const clearHistory = () => {
    localStorage.removeItem('econ_report_history');
    setHistory([]);
  };

  if (history.length === 0) {
    return (
      <div style={{ padding: '40px 22px', textAlign: 'center', color: 'var(--ink-3)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No reports yet</div>
        <div style={{ fontSize: 12.5 }}>
          Generate a report from any view using the "Generate Report" button, or click "Full Master Report" in the left rail.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '14px 22px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Report History</h2>
        <span style={{ fontSize: 11.5, color: 'var(--ink-3)', marginLeft: 10 }}>{history.length} reports</span>
        <button className="econ-btn" style={{ marginLeft: 'auto' }} onClick={clearHistory}>Clear history</button>
      </div>

      <div className="panel" style={{ overflow: 'hidden' }}>
        {history.map((r) => (
          <div key={r.id} className="econ-history-item">
            <div style={{ fontSize: 20 }}>
              {r.format === 'csv' ? '📊' : r.format === 'pdf' ? '📄' : '🖨'}
            </div>
            <div style={{ flex: 1 }}>
              <div className="hi-title">{r.title}</div>
              <div className="hi-meta">
                {SCOPE_LABELS[r.scope] ?? r.scope} · {r.params.dateRange} ·{' '}
                {new Date(r.generatedAt).toLocaleString('en-IN')}
              </div>
            </div>
            <span className={`econ-tag ${r.format === 'csv' ? 'pending' : 'completed'}`}>
              {r.format.toUpperCase()}
            </span>
            {r.csvData && (
              <button className="econ-btn" onClick={() => redownloadReport(r)}>
                ↓ Re-download
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
