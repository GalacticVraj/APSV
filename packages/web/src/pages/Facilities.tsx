/**
 * Facilities — processing infrastructure fleet view.
 *
 * Clean SaaS table view. One mode, one truth.
 * No heatmap bar, no card grid, no toggle — just the data.
 */

import { useState } from 'react';
import { useRouter } from '../router.tsx';
import { api, useResource, useTwin } from '../store.tsx';
import {
  DataTable,
  Loading,
  MiniBar,
  Panel,
  Stat,
  StatStrip,
  StatusDot,
  DecisionBanner,
} from '../components/Primitives.tsx';
import { MunicipalSitingScreener } from '../components/MunicipalSitingScreener.tsx';
import { PATHWAY_SHORT } from '../components/NetworkMap.tsx';
import { inr, num, pct } from '../format.ts';
import type { PathwayId, StreamId } from '../../../engine/src/types.ts';
import { Building2, Compass } from 'lucide-react';

export default function Facilities() {
  const { navigate } = useRouter();
  const { boot, state, optimization, version } = useTwin();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'operations' | 'siting'>('operations');

  if (!boot || !state || !optimization) return <Loading message="Loading facilities..." />;

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

  const constrained = rows.filter((f) => f.binding || f.util >= 97).length;
  const idle = rows.filter((f) => f.util < 1 || f.status === 'offline').length;
  const healthy = rows.length - constrained - idle;

  const DOT_COLORS = {
    healthy: 'var(--green-500)',
    constrained: 'var(--warn)',
    idle: 'var(--ink-4)',
  };

  return (
    <div className="page">
      {/* ── Page header ── */}
      <div
        className="page-head"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          paddingBottom: 16,
          borderBottom: '1px solid var(--rule)',
        }}
      >
        <div>
          <h1 style={{ marginBottom: 6 }}>Processing Facilities</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <span className="lede" style={{ margin: 0 }}>
              {num(state.facilities.length)} sites across five pathways &middot; {r.openFacilities.length} operating &middot; {r.idleFacilities.length} idle
            </span>
            {/* Status dot-legend (replaces ring chart) */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: 11, color: 'var(--ink-3)' }}>
              {[
                { color: DOT_COLORS.healthy, count: healthy, label: 'Healthy' },
                { color: DOT_COLORS.constrained, count: constrained, label: 'Constrained' },
                { color: DOT_COLORS.idle, count: idle, label: 'Idle' },
              ].map(({ color, count, label }) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <strong style={{ color: 'var(--ink-2)' }}>{count}</strong> {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Fleet Operations / Site Planning toggle */}
        <div style={{ display: 'flex', background: 'var(--surface-sunken)', padding: 4, borderRadius: 8, border: '1px solid var(--rule)' }}>
          <button
            onClick={() => setViewMode('operations')}
            style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', background: viewMode === 'operations' ? '#ffffff' : 'transparent', color: viewMode === 'operations' ? 'var(--ink)' : 'var(--ink-3)', boxShadow: viewMode === 'operations' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Building2 size={13} /> Fleet Operations
          </button>
          <button
            onClick={() => setViewMode('siting')}
            style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', background: viewMode === 'siting' ? 'var(--green-700)' : 'transparent', color: viewMode === 'siting' ? '#ffffff' : 'var(--ink-3)', boxShadow: viewMode === 'siting' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Compass size={13} /> Site Planning
          </button>
        </div>
      </div>

      {/* Decision banner */}
      {viewMode !== 'siting' && (
        <div className="section">
          <DecisionBanner
            badge="Facility Operations State"
            happening={
              <>
                <strong>{r.openFacilities.length} of {rows.length} facilities active</strong>, processing{' '}
                <strong>{num(rows.reduce((a, f) => a + f.load, 0))} t</strong> ({pct((rows.reduce((a, f) => a + f.load, 0) / Math.max(1, rows.reduce((a, f) => a + f.capWindow, 0))) * 100, 1)} utilisation).
              </>
            }
            why={
              <>
                {rows.filter((f) => f.util >= 97).length} facilities are capacity-bound. Idle plants ({r.idleFacilities.length}) lack feedstock density to reach minimum viable feed.
              </>
            }
            action="Examine binding facility shadow prices before allocating headroom or de-bottlenecking capital."
            actionLabel="Inspect shadow prices →"
            to="/bottlenecks"
          />
        </div>
      )}

      {viewMode === 'siting' ? (
        <div className="section">
          <MunicipalSitingScreener />
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="section">
            <StatStrip>
              <Stat label="Total capacity" value={num(rows.reduce((a, f) => a + f.capWindow, 0))} unit="t" sub={num(state.facilities.reduce((a, f) => a + f.capacityTpd, 0)) + ' t/day nameplate'} />
              <Stat label="Throughput" value={num(rows.reduce((a, f) => a + f.load, 0))} unit="t" sub={pct((rows.reduce((a, f) => a + f.load, 0) / Math.max(1, rows.reduce((a, f) => a + f.capWindow, 0))) * 100, 1)} />
              <Stat label="Operating" value={r.openFacilities.length + '/' + rows.length} />
              <Stat label="At capacity" value={num(rows.filter((f) => f.util >= 97).length)} sub="binding constraints" tone="warnc" />
              <Stat
                label="Best carbon intensity"
                value={rows.filter((f) => f.load > 0).sort((a, b) => b.intensity - a.intensity)[0]?.intensity.toFixed(2) ?? '—'}
                unit="tCO₂e/t"
                sub={rows.filter((f) => f.load > 0).sort((a, b) => b.intensity - a.intensity)[0]?.name}
              />
              <Stat
                label="Best margin"
                value={inr(rows.filter((f) => f.load > 0).sort((a, b) => b.marginPerT - a.marginPerT)[0]?.marginPerT ?? 0)}
                unit="/t"
                sub={rows.filter((f) => f.load > 0).sort((a, b) => b.marginPerT - a.marginPerT)[0]?.name}
              />
            </StatStrip>
          </div>

          {/* Fleet table + throughput breakdown */}
          <div className="section">
            <div className="grid g-3-2">
              <Panel flush>
                <DataTable
                  rows={rows}
                  rowKey={(f) => f.id}
                  onRowClick={(f) => navigate('/facility-command?id=' + f.id)}
                  selectedKey={hoveredId}
                  initialSort="util"
                  maxHeight={560}
                  columns={[
                    {
                      key: 'name', header: 'Facility',
                      render: (f) => <span className="name"><StatusDot status={f.status} /> {f.name}</span>,
                      sort: (f) => f.name,
                    },
                    { key: 'pathway', header: 'Pathway', render: (f) => PATHWAY_SHORT[f.pathway], sort: (f) => f.pathway },
                    { key: 'district', header: 'District', render: (f) => f.district, sort: (f) => f.district },
                    { key: 'cap', header: 'Capacity', num: true, sort: (f) => f.capacityTpd, render: (f) => num(f.capacityTpd) + ' t/d' },
                    {
                      key: 'util', header: 'Utilisation', num: true, sort: (f) => f.util,
                      render: (f) => (
                        <>
                          <span className={f.util >= 97 ? 'warnc' : f.util === 0 ? 'muted' : 'pos'}>{pct(f.util, 0)}</span>
                          <MiniBar value={f.util} max={100} tone={f.util >= 97 ? 'amber' : undefined} />
                        </>
                      ),
                    },
                    { key: 'carbon', header: 'Net carbon', num: true, sort: (f) => f.carbon, render: (f) => f.load > 0 ? num(f.carbon) + ' t' : '—' },
                    { key: 'intensity', header: 'tCO₂e/t', num: true, sort: (f) => f.intensity, render: (f) => f.load > 0 ? f.intensity.toFixed(2) : '—' },
                    {
                      key: 'margin', header: 'Margin/t', num: true, sort: (f) => f.marginPerT,
                      render: (f) => f.load > 0 ? <span className={f.marginPerT < 0 ? 'neg' : ''}>{inr(f.marginPerT)}</span> : '—',
                    },
                    {
                      key: 'shadow', header: 'Shadow price', num: true, sort: (f) => f.shadow?.marginPerExtraTonne ?? -1,
                      render: (f) => f.shadow?.binding
                        ? <strong>{inr(f.shadow.marginPerExtraTonne)}/t</strong>
                        : <span className="muted">—</span>,
                    },
                    {
                      key: 'cmd', header: '',
                      render: () => <span style={{ fontSize: 10.5, color: 'var(--green-700)', fontWeight: 600, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Command →</span>,
                    },
                  ]}
                />
              </Panel>

              <Panel title="Throughput by pathway">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{PATHWAY_SHORT[k as PathwayId]}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
                            {num(v.used)} / {num(v.cap)} t &middot; {pct(v.cap > 0 ? (v.used / v.cap) * 100 : 0, 0)}
                          </span>
                        </div>
                        <div style={{ height: 5, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: (v.cap > 0 ? Math.min(100, (v.used / v.cap) * 100) : 0) + '%', background: 'var(--ink-3)', borderRadius: 3, transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </Panel>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
