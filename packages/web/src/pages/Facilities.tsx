/**
 * Facilities — processing infrastructure fleet view.
 *
 * Primary question: where is capacity available and where is it constrained?
 *
 * The FleetBar gives an at-a-glance capacity distribution across all facilities.
 * Cards give a scannable grid view — click any card to go straight to Command.
 * The Pathway × District heatmap exposes regional bottlenecks at a glance.
 * The sortable table is still available via the Grid / Table toggle.
 */

import { useState, useMemo } from 'react';
import { useRouter } from '../router.tsx';
import { api, useResource, useTwin } from '../store.tsx';
import {
  DataTable,
  Empty,
  Loading,
  MiniBar,
  Notice,
  Panel,
  SectionHead,
  Stat,
  StatStrip,
  StatusDot,
  Tag,
} from '../components/Primitives.tsx';
import { FleetBar, type FleetSegment, FacilityCard, type FacilityCardData, CapacityHeatmap, type HeatmapCell } from '../components/FacilityCharts.tsx';
import { MunicipalSitingScreener } from '../components/MunicipalSitingScreener.tsx';
import { PATHWAY_SHORT } from '../components/NetworkMap.tsx';
import { inr, num, pct, km } from '../format.ts';
import type { PathwayId, StreamId } from '../../../engine/src/types.ts';
import { Building2, Compass, LayoutGrid, List } from 'lucide-react';

export default function Facilities() {
  const { navigate } = useRouter();
  const { boot, state, optimization, version } = useTwin();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'operations' | 'siting'>('operations');
  const [displayMode, setDisplayMode] = useState<'cards' | 'table'>('cards');

  const pw = useResource(
    () => api.pathways((state?.sources[0]?.stream ?? 'paddy_straw') as StreamId),
    [version],
    ['Comparing pathways…'],
  );

  // ── Hoist all hooks above the early-return guard (Rules of Hooks) ──

  // Heatmap pathway/district derivations — safe with null state
  const allPathways = useMemo(() => {
    const seen = new Set<PathwayId>();
    (state?.facilities ?? []).forEach((f) => seen.add(f.pathway as PathwayId));
    return [...seen];
  }, [state]);

  const allDistricts = useMemo(() => {
    const seen = new Set<string>();
    (state?.facilities ?? []).forEach((f) => seen.add(f.district));
    return [...seen].sort();
  }, [state]);

  const heatmapCells = useMemo(() => {
    const map = new Map<string, HeatmapCell[]>();
    if (!state || !optimization) return map;
    const r = optimization.result;
    const windowDays = state.assumptions.windowDays;
    const loadMap = new Map<string, number>();
    const carbonMap = new Map<string, number>();
    for (const a of r.allocations) {
      loadMap.set(a.facilityId, (loadMap.get(a.facilityId) ?? 0) + a.tonnes);
      carbonMap.set(a.facilityId, (carbonMap.get(a.facilityId) ?? 0) + a.netCarbonT);
    }
    for (const f of state.facilities) {
      const cap = f.capacityTpd * f.availability * windowDays;
      const l = loadMap.get(f.id) ?? 0;
      const util = cap > 0 ? (l / cap) * 100 : 0;
      const shadow = r.shadowPrices.find((s) => s.facilityId === f.id);
      const key = `${f.pathway}__${f.district}`;
      const cell: HeatmapCell = {
        facilityId: f.id,
        facilityName: f.name,
        utilisationPct: util,
        capacityTpd: f.capacityTpd,
        status: f.status,
        binding: shadow?.binding ?? false,
      };
      const arr = map.get(key) ?? [];
      arr.push(cell);
      map.set(key, arr);
    }
    return map;
  }, [state, optimization]);

  if (!boot || !state || !optimization) return <Loading message="Loading facilities…" />;

  const pathways = boot.reference.pathways as Record<string, any>;
  const windowDays = state.assumptions.windowDays;
  const r = optimization.result;

  const load = new Map<string, number>();
  const carbon = new Map<string, number>();
  const margin = new Map<string, number>();
  for (const a of r.allocations) {
    load.set(a.facilityId, (load.get(a.facilityId) ?? 0) + a.tonnes);
    carbon.set(a.facilityId, (carbon.get(a.facilityId) ?? 0) + a.netCarbonT);
    margin.set(a.facilityId, (margin.get(a.facilityId) ?? 0) + a.marginInr);
  }

  const rows = state.facilities.map((f) => {
    const cap = f.capacityTpd * f.availability * windowDays;
    const l = load.get(f.id) ?? 0;
    const shadow = r.shadowPrices.find((s) => s.facilityId === f.id);
    const carbonVal = carbon.get(f.id) ?? 0;
    const marginVal = margin.get(f.id) ?? 0;
    return {
      ...f,
      capWindow: cap,
      load: l,
      util: cap > 0 ? (l / cap) * 100 : 0,
      carbon: carbonVal,
      margin: marginVal,
      intensity: l > 0 ? carbonVal / l : 0,
      marginPerT: l > 0 ? marginVal / l : 0,
      shadow,
      binding: shadow?.binding ?? false,
    };
  });

  // Fleet bar segments — sorted by nameplate capacity descending
  const fleetSegments: FleetSegment[] = rows
    .slice()
    .sort((a, b) => b.capacityTpd - a.capacityTpd)
    .map((f) => ({
      id: f.id,
      name: f.name,
      pathway: pathways[f.pathway]?.short ?? f.pathway,
      capacityTpd: f.capacityTpd,
      loadT: f.load,
      capWindow: f.capWindow,
      utilisationPct: f.util,
      status: f.status,
      binding: f.binding,
    }));

  // Card data
  const cardData: FacilityCardData[] = rows.map((f) => ({
    id: f.id,
    name: f.name,
    pathway: f.pathway as PathwayId,
    district: f.district,
    capacityTpd: f.capacityTpd,
    utilisationPct: f.util,
    remainingT: f.capWindow - f.load,
    status: f.status,
    binding: f.binding,
    carbonIntensity: f.intensity,
    marginPerT: f.marginPerT,
    load: f.load,
  }));

  // Fleet-level summary
  const constrained = rows.filter((f) => f.binding || f.util >= 97).length;
  const idle = rows.filter((f) => f.util < 1 || f.status === 'offline').length;
  const healthy = rows.length - constrained - idle;

  return (
    <div className="page">
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, paddingBottom: 16, borderBottom: '1px solid var(--rule)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div>
            <h1 style={{ marginBottom: 4 }}>Processing Facilities</h1>
            <div className="lede" style={{ margin: 0 }}>
              {num(state.facilities.length)} sites across five pathways · {r.openFacilities.length} operating · {r.idleFacilities.length} idle
            </div>
          </div>

          {/* Fleet Health Ring */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 24, borderLeft: '1px solid var(--rule-2)' }}>
            <svg width="36" height="36" viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="20" cy="20" r="16" fill="none" stroke="var(--surface-sunken)" strokeWidth="6" />
              <circle cx="20" cy="20" r="16" fill="none" stroke="var(--green-500)" strokeWidth="6" strokeDasharray={`${(healthy / rows.length) * 100.53} 100.53`} />
              <circle cx="20" cy="20" r="16" fill="none" stroke="#ef4444" strokeWidth="6" strokeDasharray={`${(constrained / rows.length) * 100.53} 100.53`} strokeDashoffset={-((healthy / rows.length) * 100.53)} />
              <circle cx="20" cy="20" r="16" fill="none" stroke="var(--ink-4)" strokeWidth="6" strokeDasharray={`${(idle / rows.length) * 100.53} 100.53`} strokeDashoffset={-(((healthy + constrained) / rows.length) * 100.53)} />
            </svg>
            <div style={{ fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.4 }}>
              <div><strong style={{ color: 'var(--green-700)' }}>{healthy}</strong> Healthy</div>
              <div><strong style={{ color: 'var(--warn)' }}>{constrained}</strong> Constrained</div>
            </div>
          </div>
        </div>

        {/* View Mode Toggles */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Grid / Table sub-toggle — only visible in operations mode */}
          {viewMode === 'operations' && (
            <div style={{ display: 'flex', background: 'var(--surface-sunken)', padding: 3, borderRadius: 7, border: '1px solid var(--rule)', gap: 2 }}>
              <button
                onClick={() => setDisplayMode('cards')}
                title="Card grid view"
                style={{
                  padding: '5px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 5,
                  border: 'none',
                  background: displayMode === 'cards' ? '#fff' : 'transparent',
                  color: displayMode === 'cards' ? 'var(--ink)' : 'var(--ink-3)',
                  boxShadow: displayMode === 'cards' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <LayoutGrid size={12} /> Cards
              </button>
              <button
                onClick={() => setDisplayMode('table')}
                title="Table view"
                style={{
                  padding: '5px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 5,
                  border: 'none',
                  background: displayMode === 'table' ? '#fff' : 'transparent',
                  color: displayMode === 'table' ? 'var(--ink)' : 'var(--ink-3)',
                  boxShadow: displayMode === 'table' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <List size={12} /> Table
              </button>
            </div>
          )}

          {/* Fleet Operations / Site Planning main toggle */}
          <div style={{ display: 'flex', background: 'var(--surface-sunken)', padding: 4, borderRadius: 8, border: '1px solid var(--rule)' }}>
            <button
              onClick={() => setViewMode('operations')}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                border: 'none',
                background: viewMode === 'operations' ? '#ffffff' : 'transparent',
                color: viewMode === 'operations' ? 'var(--ink)' : 'var(--ink-3)',
                boxShadow: viewMode === 'operations' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Building2 size={13} /> Fleet Operations
            </button>
            <button
              onClick={() => setViewMode('siting')}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                border: 'none',
                background: viewMode === 'siting' ? 'var(--green-700)' : 'transparent',
                color: viewMode === 'siting' ? '#ffffff' : 'var(--ink-3)',
                boxShadow: viewMode === 'siting' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Compass size={13} /> Site Planning
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'siting' ? (
        <div className="section">
          <MunicipalSitingScreener />
        </div>
      ) : (
        <>
          {/* ── Fleet capacity distribution bar ── */}
          <div className="section">
            <SectionHead
              title="Fleet Capacity Distribution"
              note="Width = nameplate capacity · Fill = utilisation · Click to open Command view"
            />
            <FleetBar
              segments={fleetSegments}
              height={52}
              onHover={setHoveredId}
              onClick={(id) => navigate(`/facility-command?id=${id}`)}
            />
            <div style={{ display: 'flex', gap: 18, marginTop: 8, fontSize: 11, color: 'var(--ink-3)', alignItems: 'center' }}>
              {[
                { color: 'var(--green-500)', label: `${healthy} operating normally` },
                { color: '#ef4444',          label: `${constrained} constrained (binding)` },
                { color: 'var(--ink-4)',     label: `${idle} idle / offline` },
              ].map(({ color, label }) => (
                <span key={label}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 5, verticalAlign: 'middle' }} />
                  {label}
                </span>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-4)' }}>
                Fill = utilisation · Width = nameplate capacity
              </span>
            </div>
          </div>

          {/* ── Summary stats ── */}
          <div className="section">
            <StatStrip>
              <Stat
                label="Total capacity"
                value={num(rows.reduce((a, f) => a + f.capWindow, 0))}
                unit="t"
                sub={`${num(state.facilities.reduce((a, f) => a + f.capacityTpd, 0))} t/day nameplate`}
              />
              <Stat
                label="Throughput"
                value={num(rows.reduce((a, f) => a + f.load, 0))}
                unit="t"
                sub={pct(
                  (rows.reduce((a, f) => a + f.load, 0) /
                    Math.max(1, rows.reduce((a, f) => a + f.capWindow, 0))) *
                    100,
                  1,
                )}
              />
              <Stat label="Operating" value={`${r.openFacilities.length}/${rows.length}`} />
              <Stat
                label="At capacity"
                value={num(rows.filter((f) => f.util >= 97).length)}
                sub="binding constraints"
                tone="warnc"
              />
              <Stat
                label="Best carbon intensity"
                value={
                  rows.filter((f) => f.load > 0).sort((a, b) => b.intensity - a.intensity)[0]?.intensity.toFixed(2) ??
                  '—'
                }
                unit="tCO₂e/t"
                sub={rows.filter((f) => f.load > 0).sort((a, b) => b.intensity - a.intensity)[0]?.name}
              />
              <Stat
                label="Best margin"
                value={inr(
                  rows.filter((f) => f.load > 0).sort((a, b) => b.marginPerT - a.marginPerT)[0]?.marginPerT ?? 0,
                )}
                unit="/t"
                sub={rows.filter((f) => f.load > 0).sort((a, b) => b.marginPerT - a.marginPerT)[0]?.name}
              />
            </StatStrip>
          </div>

          {/* ── Card grid or Table ── */}
          <div className="section">
            {displayMode === 'cards' ? (
              <>
                <SectionHead
                  title="Facility Fleet"
                  note="Click any card to open the Facility Command view."
                />
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                  gap: 12,
                }}>
                  {cardData
                    .slice()
                    .sort((a, b) => b.utilisationPct - a.utilisationPct)
                    .map((card) => (
                      <FacilityCard
                        key={card.id}
                        data={card}
                        onClick={() => navigate(`/facility-command?id=${card.id}`)}
                      />
                    ))}
                </div>
              </>
            ) : (
              <div className="grid g-3-2">
                <Panel flush>
                  <DataTable
                    rows={rows}
                    rowKey={(f) => f.id}
                    onRowClick={(f) => navigate(`/facility-command?id=${f.id}`)}
                    selectedKey={hoveredId}
                    initialSort="util"
                    maxHeight={520}
                    columns={[
                      {
                        key: 'name',
                        header: 'Facility',
                        render: (f) => (
                          <span className="name">
                            <StatusDot status={f.status} /> {f.name}
                          </span>
                        ),
                        sort: (f) => f.name,
                      },
                      {
                        key: 'pathway',
                        header: 'Pathway',
                        render: (f) => PATHWAY_SHORT[f.pathway],
                        sort: (f) => f.pathway,
                      },
                      { key: 'district', header: 'District', render: (f) => f.district, sort: (f) => f.district },
                      {
                        key: 'cap',
                        header: 'Capacity',
                        num: true,
                        sort: (f) => f.capacityTpd,
                        render: (f) => `${num(f.capacityTpd)} t/d`,
                      },
                      {
                        key: 'util',
                        header: 'Utilisation',
                        num: true,
                        sort: (f) => f.util,
                        render: (f) => (
                          <>
                            <span className={f.util >= 97 ? 'warnc' : f.util === 0 ? 'muted' : 'pos'}>
                              {pct(f.util, 0)}
                            </span>
                            <MiniBar value={f.util} max={100} tone={f.util >= 97 ? 'amber' : undefined} />
                          </>
                        ),
                      },
                      {
                        key: 'carbon',
                        header: 'Net carbon',
                        num: true,
                        sort: (f) => f.carbon,
                        render: (f) => (f.load > 0 ? `${num(f.carbon)} t` : '—'),
                      },
                      {
                        key: 'intensity',
                        header: 'tCO₂e/t',
                        num: true,
                        sort: (f) => f.intensity,
                        render: (f) => (f.load > 0 ? f.intensity.toFixed(2) : '—'),
                      },
                      {
                        key: 'margin',
                        header: 'Margin/t',
                        num: true,
                        sort: (f) => f.marginPerT,
                        render: (f) =>
                          f.load > 0 ? (
                            <span className={f.marginPerT < 0 ? 'neg' : ''}>{inr(f.marginPerT)}</span>
                          ) : (
                            '—'
                          ),
                      },
                      {
                        key: 'shadow',
                        header: 'Marginal value',
                        num: true,
                        sort: (f) => f.shadow?.marginPerExtraTonne ?? -1,
                        render: (f) =>
                          f.shadow?.binding ? (
                            <strong>{inr(f.shadow.marginPerExtraTonne)}/t</strong>
                          ) : (
                            <span className="muted">—</span>
                          ),
                      },
                      {
                        key: 'cmd',
                        header: '',
                        render: () => (
                          <span style={{ fontSize: 10.5, color: 'var(--green-700)', fontWeight: 600, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                            Command →
                          </span>
                        ),
                      },
                    ]}
                  />
                </Panel>

                <Panel title="Throughput by pathway">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(() => {
                      const m = new Map<string, { cap: number; used: number }>();
                      for (const f of rows) {
                        const e = m.get(f.pathway) ?? { cap: 0, used: 0 };
                        e.cap += f.capWindow;
                        e.used += f.load;
                        m.set(f.pathway, e);
                      }
                      return [...m.entries()].map(([k, v]) => (
                        <div key={k}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                            <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{PATHWAY_SHORT[k as PathwayId]}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
                              {num(v.used)} / {num(v.cap)} t · {pct(v.cap > 0 ? (v.used / v.cap) * 100 : 0, 0)}
                            </span>
                          </div>
                          <div style={{ height: 6, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${v.cap > 0 ? Math.min(100, (v.used / v.cap) * 100) : 0}%`,
                              background: 'var(--green-500)',
                              borderRadius: 3,
                            }} />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </Panel>
              </div>
            )}
          </div>

          {/* ── Capacity Heatmap ── */}
          <div className="section">
            <SectionHead
              title="Capacity Heatmap — Pathway × District"
              note="Each cell shows the highest utilisation of any facility at that pathway/district intersection. Hover for details."
            />
            <Panel flush>
              <div style={{ padding: '12px 16px 14px' }}>
                <CapacityHeatmap
                  pathways={allPathways}
                  districts={allDistricts}
                  cells={heatmapCells}
                />
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
