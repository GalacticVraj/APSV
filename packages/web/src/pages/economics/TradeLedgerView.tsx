import { useState, useMemo, Fragment } from 'react';
import { inr, num } from '../../format.ts';
import { PATHWAY_SHORT } from '../../components/NetworkMap.tsx';
import type { Allocation, PathwayId } from '../../../../engine/src/types.ts';
import {
  buildLedgerCSV, downloadCSV, triggerPrint,
  saveReportRecord, reportFilename,
} from './ReportHelpers.ts';

const PAGE_SIZE = 20;

const EVENT_TYPES = ['Match', 'Pickup', 'Processing', 'Settlement'] as const;
type EventType = typeof EVENT_TYPES[number];

// Deterministic event type for an allocation based on its index
function eventType(i: number): EventType {
  return EVENT_TYPES[i % EVENT_TYPES.length];
}

function statusFor(a: Allocation): 'completed' | 'pending' | 'flagged' {
  if (a.marginInr >= 0) return 'completed';
  if (a.marginInr > -50000) return 'pending';
  return 'flagged';
}

type SortKey = 'timestamp' | 'source' | 'facility' | 'pathway' | 'tonnes' | 'revenue' | 'cost' | 'margin' | 'carbon';

export function TradeLedgerView({
  allocations,
  sourceById,
  facilityById,
  explainMode,
}: {
  allocations: Allocation[];
  sourceById: Record<string, { name: string; stream?: string }>;
  facilityById: Record<string, { name: string }>;
  explainMode: boolean;
}) {
  const [search, setSearch] = useState('');
  const [filterPathway, setFilterPathway] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Build row objects
  const rows = useMemo(() =>
    allocations.map((a, i) => ({
      id: `${a.sourceId}>${a.facilityId}>${i}`,
      allocation: a,
      ts: new Date(Date.now() - i * 600_000),
      eventType: eventType(i),
      sourceName: sourceById[a.sourceId]?.name ?? a.sourceId,
      facilityName: facilityById[a.facilityId]?.name ?? a.facilityId,
      stream: a.stream,
      status: statusFor(a),
    })),
    [allocations, sourceById, facilityById]
  );

  // Filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (q && !r.sourceName.toLowerCase().includes(q) && !r.facilityName.toLowerCase().includes(q)) return false;
      if (filterPathway !== 'all' && r.allocation.pathway !== filterPathway) return false;
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      return true;
    });
  }, [rows, search, filterPathway, filterStatus]);

  // Sort
  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0;
      switch (sortKey) {
        case 'timestamp': av = a.ts.getTime(); bv = b.ts.getTime(); break;
        case 'source': av = a.sourceName; bv = b.sourceName; break;
        case 'facility': av = a.facilityName; bv = b.facilityName; break;
        case 'pathway': av = a.allocation.pathway; bv = b.allocation.pathway; break;
        case 'tonnes': av = a.allocation.tonnes; bv = b.allocation.tonnes; break;
        case 'revenue': av = a.allocation.revenueInr; bv = b.allocation.revenueInr; break;
        case 'cost': av = a.allocation.costInr; bv = b.allocation.costInr; break;
        case 'margin': av = a.allocation.marginInr; bv = b.allocation.marginInr; break;
        case 'carbon': av = a.allocation.netCarbonT; bv = b.allocation.netCarbonT; break;
      }
      if (typeof av === 'string') return sortDesc ? bv.toString().localeCompare(av) : av.localeCompare(bv.toString());
      return sortDesc ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });
    return copy;
  }, [filtered, sortKey, sortDesc]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filteredIds = new Set(filtered.map((r) => r.id));

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDesc(!sortDesc);
    else { setSortKey(k); setSortDesc(true); }
    setPage(1);
  };

  const sortArrow = (k: SortKey) => sortKey === k ? (sortDesc ? ' ↓' : ' ↑') : '';

  return (
    <>
      {explainMode && (
        <div className="econ-explain-banner">
          <strong>☰ Trade Ledger</strong> — Every single waste transaction, from match to settlement.
          Click any row to see a plain-language explanation of how that trade's revenue and cost were calculated,
          and why that particular facility was chosen. Use the filters to focus on specific pathways, statuses, or search for a generator.
        </div>
      )}

      <div className="panel" style={{ margin: '14px 22px', overflow: 'hidden' }}>
        {/* Controls */}
        <div className="econ-ledger-controls">
          <input
            className="econ-search"
            type="search"
            placeholder="Search generators or facilities…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            aria-label="Search transactions"
          />
          <select className="econ-select" value={filterPathway} onChange={(e) => { setFilterPathway(e.target.value); setPage(1); }}>
            <option value="all">All Pathways</option>
            {Object.entries(PATHWAY_SHORT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="econ-select" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="flagged">Flagged</option>
          </select>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ink-3)' }}>
            {sorted.length} of {rows.length} trades
          </span>
          <button className="econ-btn" onClick={() => {
            const csv = buildLedgerCSV(allocations, sourceById, facilityById, filteredIds);
            downloadCSV(csv, reportFilename('ledger', 'csv', 'all'));
          }}>
            ↓ Export CSV
          </button>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="econ-ledger-table">
            <thead>
              <tr>
                {([
                  ['timestamp', 'Time'],
                  ['source', 'Generator'],
                  ['facility', 'Facility'],
                  ['pathway', 'Type'],
                  ['tonnes', 'Volume (t)', true],
                  ['revenue', 'Revenue', true],
                  ['cost', 'Cost', true],
                  ['margin', 'Net Margin', true],
                  ['carbon', 'Carbon (tCO₂e)', true],
                ] as [SortKey, string, boolean?][]).map(([k, label, isNum]) => (
                  <th
                    key={k}
                    className={`${isNum ? 'num-col ' : ''}${sortKey === k ? 'sorted' : ''}`}
                    onClick={() => handleSort(k)}
                    aria-sort={sortKey === k ? (sortDesc ? 'descending' : 'ascending') : 'none'}
                  >
                    {label}<span className="sort-arrow">{sortArrow(k)}</span>
                  </th>
                ))}
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-3)' }}>
                    No trades match the current filters.
                  </td>
                </tr>
              )}
              {paginated.map((r) => (
                <Fragment key={r.id}>
                  <tr
                    className={expandedId === r.id ? 'expanded' : ''}
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    role="button"
                    aria-expanded={expandedId === r.id}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setExpandedId(expandedId === r.id ? null : r.id)}
                  >
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                      {r.ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.sourceName}
                    </td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.facilityName}
                    </td>
                    <td>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{r.eventType}</span>
                      <div style={{ fontSize: 11.5, fontWeight: 500 }}>{PATHWAY_SHORT[r.allocation.pathway]}</div>
                    </td>
                    <td className="num-col">{num(r.allocation.tonnes)}</td>
                    <td className="num-col">{inr(r.allocation.revenueInr)}</td>
                    <td className="num-col neg">{inr(r.allocation.costInr)}</td>
                    <td className={`num-col ${r.allocation.marginInr < 0 ? 'neg' : 'pos'}`} style={{ fontWeight: 700 }}>
                      {inr(r.allocation.marginInr)}
                    </td>
                    <td className="num-col">{num(r.allocation.netCarbonT, 2)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`econ-tag ${r.status}`}>{r.status}</span>
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr className="econ-expand-row">
                      <td colSpan={10}>
                        <div className="econ-expand-body">
                          {/* Plain-language explanation */}
                          <div>
                            <div className="econ-expand-section-title">Plain-language explanation</div>
                            <div className="econ-expand-prose">
                              <p style={{ margin: '0 0 10px' }}>
                                We matched <strong>{num(r.allocation.tonnes)} tonnes</strong> of waste
                                from <strong>{r.sourceName}</strong> to <strong>{r.facilityName}</strong> for
                                processing via <strong>{PATHWAY_SHORT[r.allocation.pathway]}</strong>.
                                This facility was selected because it offered the best combination of
                                distance ({r.allocation.distanceKm.toFixed(1)} km), pathway suitability, and
                                margin contribution under the current objective.
                              </p>
                              <p style={{ margin: '0 0 10px' }}>
                                The trade generated <strong>{inr(r.allocation.revenueInr)}</strong> in revenue
                                from product sales and carbon credits, against a total cost
                                of <strong>{inr(r.allocation.costInr)}</strong>, yielding
                                a net {r.allocation.marginInr >= 0 ? 'profit' : 'loss'} of{' '}
                                <strong style={{ color: r.allocation.marginInr >= 0 ? 'var(--green-700)' : 'var(--neg)' }}>
                                  {inr(r.allocation.marginInr)}
                                </strong>.
                              </p>
                              <p style={{ margin: 0 }}>
                                Environmentally, this activity avoided <strong>{num(r.allocation.avoidedT, 2)} tCO₂e</strong> of
                                emissions and durably removed <strong>{num(r.allocation.durableT, 2)} tCO₂e</strong>,
                                at a net sequestration of <strong>{num(r.allocation.netCarbonT, 2)} tCO₂e</strong>.
                                Transport generated {num(r.allocation.emittedT, 2)} tCO₂e over {r.allocation.trips} trip(s).
                              </p>
                            </div>
                          </div>
                          {/* Numeric breakdown */}
                          <div>
                            <div className="econ-expand-section-title">Economic breakdown</div>
                            <div>
                              {([
                                ['Distance', `${r.allocation.distanceKm.toFixed(1)} km`, ''],
                                ['Trips', `${r.allocation.trips}`, ''],
                                ['Revenue (products + carbon)', inr(r.allocation.revenueInr), 'pos'],
                                ['Total cost', inr(r.allocation.costInr), 'neg'],
                                ['Net margin', inr(r.allocation.marginInr), r.allocation.marginInr >= 0 ? 'pos' : 'neg'],
                                ['Net carbon', `${num(r.allocation.netCarbonT, 2)} tCO₂e`, ''],
                                ['Durable removal', `${num(r.allocation.durableT, 2)} tCO₂e`, ''],
                                ['Avoided emissions', `${num(r.allocation.avoidedT, 2)} tCO₂e`, ''],
                              ] as [string, string, string][]).map(([label, val, cls]) => (
                                <div key={label} className="econ-breakdown-row">
                                  <span className="bk-label">{label}</span>
                                  <span className={`bk-val ${cls}`}>{val}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="econ-pagination">
          <button className="page-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
          <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
          <span>Page {page} of {totalPages}</span>
          <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
          <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
          <span style={{ marginLeft: 'auto' }}>
            {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
        </div>
      </div>
    </>
  );
}
