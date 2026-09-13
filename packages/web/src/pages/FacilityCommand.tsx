/**
 * Facility Command — single-facility operational control view.
 *
 * Route: /facility-command?id=<facilityId>
 *
 * Answers: what feedstock is available → what is currently allocated →
 * what capacity I have → what is constraining me → what additional
 * capacity is worth → what happens if conditions change.
 *
 * All data comes from the shared twin (useTwin). No new API endpoints.
 * All hooks are called unconditionally above any conditional returns
 * (React Rules of Hooks compliance).
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from '../router.tsx';
import { api, useResource, useTwin } from '../store.tsx';
import {
  Panel,
  Loading,
  Empty,
  Notice,
  StatusDot,
  Tag,
  SectionHead,
  InfoTip,
  ParameterRow,
} from '../components/Primitives.tsx';
import {
  FeedstockOutlookChart,
  AllocationFlow,
  WhatIfBars,
  SourceScoreBar,
  type AllocSource,
  type OutlookPoint,
  type SourceScore,
} from '../components/FacilityCharts.tsx';
import { PATHWAY_SHORT } from '../components/NetworkMap.tsx';
import { num, pct, inr, inrExact, km, dateShort } from '../format.ts';
import type { PathwayId, ScenarioInstance } from '../../../engine/src/types.ts';
import { Package, Settings, Activity, TrendingUp } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function readId(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('id');
}

// ─────────────────────────────────────────────────────────────────────────────
// Source detail side panel
// ─────────────────────────────────────────────────────────────────────────────

function SourceDetail({
  src,
  onClose,
}: {
  src: AllocSource;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--rule)',
        background: 'var(--surface)',
        padding: '12px 14px',
        fontSize: 12,
        marginTop: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 8,
        }}
      >
        <strong style={{ fontSize: 13 }}>{src.name}</strong>
        <button className="btn sm" onClick={onClose}>
          ✕
        </button>
      </div>
      <dl className="kv">
        <dt>Feedstock</dt>
        <dd>{src.stream.replace(/_/g, ' ')}</dd>
        <dt>Allocated tonnes</dt>
        <dd>{num(src.tonnes, 1)} t</dd>
        <dt>Haul distance</dt>
        <dd>{km(src.distanceKm)}</dd>
        <dt>Trips</dt>
        <dd>{num(src.trips)}</dd>
        <dt>Margin contribution</dt>
        <dd style={{ color: src.marginInr >= 0 ? 'var(--green-500)' : 'var(--neg)' }}>
          {inr(src.marginInr)}
        </dd>
      </dl>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// What-If section (isolated so its own hooks are always called)
// ─────────────────────────────────────────────────────────────────────────────

function WhatIfSection({ facilityId, district }: { facilityId: string; district: string }) {
  const [supplyShock, setSupplyShock] = useState(0); // -30 to +30 %
  const [derateShock, setDerateShock] = useState(0); // 0 to 30 %
  const [preview, setPreview] = useState<{
    metrics: ReturnType<typeof buildMetrics>;
    narrative: string[];
    networkEffect: { reallocatedT: number; marginDeltaInr: number; carbonDeltaT: number } | null;
  } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  function buildMetrics(
    beforeTpd: number, afterTpd: number,
    beforeMargin: number, afterMargin: number,
    beforeCarbon: number, afterCarbon: number,
  ) {
    return [
      {
        label: 'Throughput',
        before: beforeTpd,
        after: afterTpd,
        unit: 't/d',
        higherIsBetter: true,
        format: (v: number) => `${num(v, 1)} t/d`,
      },
      {
        label: 'Facility margin',
        before: beforeMargin,
        after: afterMargin,
        unit: '',
        higherIsBetter: true,
        format: (v: number) => inr(v),
      },
      {
        label: 'Carbon outcome',
        before: beforeCarbon,
        after: afterCarbon,
        unit: 'tCO₂e',
        higherIsBetter: true,
        format: (v: number) => `${num(v, 1)} tCO₂e`,
      },
    ];
  }

  const runPreview = useCallback(
    async (supply: number, derate: number) => {
      setRunning(true);
      setError(null);

      try {
        let scenario: ScenarioInstance;
        if (Math.abs(supply) >= 1) {
          scenario = {
            kind: supply > 0 ? 'supply_surge' : 'supply_shortage',
            params: { district, changePct: Math.abs(supply) },
          };
        } else if (derate >= 1) {
          scenario = {
            kind: 'facility_derate',
            params: { facilityId, deratePct: derate },
          };
        } else {
          setPreview(null);
          setRunning(false);
          return;
        }

        const res = await api.scenario(scenario, false);
        const sr = res.result;

        const sum = (allocs: typeof sr.before.allocations, key: 'tonnes' | 'marginInr' | 'netCarbonT') =>
          allocs.filter((a) => a.facilityId === facilityId).reduce((s, a) => s + a[key], 0);

        const wDays = sr.before.windowDays;
        const beforeTpd = wDays > 0 ? sum(sr.before.allocations, 'tonnes') / wDays : 0;
        const afterTpd = wDays > 0 ? sum(sr.after.allocations, 'tonnes') / wDays : 0;

        const reallocatedT = sr.flowChanges
          .filter((fc) => fc.changeType === 'rerouted')
          .reduce((s, fc) => s + fc.tonnes, 0);

        setPreview({
          metrics: buildMetrics(
            beforeTpd, afterTpd,
            sum(sr.before.allocations, 'marginInr'), sum(sr.after.allocations, 'marginInr'),
            sum(sr.before.allocations, 'netCarbonT'), sum(sr.after.allocations, 'netCarbonT'),
          ),
          narrative: sr.narrative,
          networkEffect: {
            reallocatedT,
            marginDeltaInr: sr.after.totals.marginInr - sr.before.totals.marginInr,
            carbonDeltaT: sr.after.totals.netCarbonT - sr.before.totals.netCarbonT,
          },
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Preview failed');
        setPreview(null);
      } finally {
        setRunning(false);
      }
    },
    [facilityId, district],
  );

  const schedulePreview = (supply: number, derate: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => runPreview(supply, derate), 380);
  };

  const clearPreview = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setPreview(null);
    setSupplyShock(0);
    setDerateShock(0);
    setError(null);
  };

  return (
    <div className="section">
      <SectionHead title="What-If Analysis">
        {(supplyShock !== 0 || derateShock !== 0) && (
          <button className="btn sm" onClick={clearPreview} style={{ marginLeft: 'auto' }}>
            Clear
          </button>
        )}
      </SectionHead>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 10, lineHeight: 1.5 }}>
        Run a real network re-optimisation against a hypothetical scenario — without committing to the live twin.
        Adjust a slider and the optimiser re-solves the network in the background.
        The Before → After result shows the actual consequence, not a visual estimate.
      </div>
      <div className="grid g2" style={{ gap: 14 }}>
        <Panel title="Supply shock">
          <div className="field">
            <label>
              Supply change{' '}
              <span
                className="val"
                style={{
                  color:
                    supplyShock < 0
                      ? 'var(--neg)'
                      : supplyShock > 0
                        ? 'var(--green-500)'
                        : 'var(--ink-3)',
                }}
              >
                {supplyShock > 0 ? '+' : ''}
                {supplyShock}%
              </span>
            </label>
            <input
              type="range"
              min={-30}
              max={30}
              step={5}
              value={supplyShock}
              onChange={(e) => {
                const v = Number(e.target.value);
                setSupplyShock(v);
                setDerateShock(0);
                schedulePreview(v, 0);
              }}
            />
            <div className="hint">
              Simulates a district-wide supply surge or shortage.
              Uses the <strong>supply_surge</strong> / <strong>supply_shortage</strong> scenario
              engine (<code>commit: false</code>). The live twin is <strong>not changed</strong>.
            </div>
          </div>
        </Panel>

        <Panel title="Facility capacity derate">
          <div className="field">
            <label>
              Derate{' '}
              <span
                className="val"
                style={{ color: derateShock > 0 ? 'var(--warn)' : 'var(--ink-3)' }}
              >
                {derateShock > 0 ? '-' : ''}
                {derateShock}%
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={30}
              step={5}
              value={derateShock}
              onChange={(e) => {
                const v = Number(e.target.value);
                setDerateShock(v);
                setSupplyShock(0);
                schedulePreview(0, v);
              }}
            />
            <div className="hint">
              Simulates a partial capacity loss (e.g. equipment downgrade).
              Uses the <strong>facility_derate</strong> scenario engine.
              The live twin is <strong>not changed</strong> — preview only.
            </div>
          </div>
        </Panel>
      </div>

      {running && (
        <div style={{ marginTop: 14 }}>
          <Loading message="Re-optimising network for preview…" />
        </div>
      )}
      {error && (
        <div style={{ marginTop: 14 }}>
          <Notice>{error}</Notice>
        </div>
      )}
      {preview && !running && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel title="Before → After">
            <WhatIfBars metrics={preview.metrics} />
          </Panel>

          {preview.networkEffect && (
            <Panel title="Network effect">
              <dl className="kv">
                <dt>Reallocated material</dt>
                <dd>{num(preview.networkEffect.reallocatedT, 1)} t</dd>
                <dt>Network margin change</dt>
                <dd
                  style={{
                    color:
                      preview.networkEffect.marginDeltaInr > 0
                        ? 'var(--green-500)'
                        : preview.networkEffect.marginDeltaInr < 0
                          ? 'var(--neg)'
                          : undefined,
                  }}
                >
                  {inr(preview.networkEffect.marginDeltaInr, { sign: true })}
                </dd>
                <dt>Carbon outcome change</dt>
                <dd
                  style={{
                    color:
                      preview.networkEffect.carbonDeltaT > 0
                        ? 'var(--green-500)'
                        : preview.networkEffect.carbonDeltaT < 0
                          ? 'var(--neg)'
                          : undefined,
                  }}
                >
                  {preview.networkEffect.carbonDeltaT > 0 ? '+' : ''}
                  {num(preview.networkEffect.carbonDeltaT, 1)} tCO₂e
                </dd>
              </dl>
              {preview.narrative.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 11.5,
                    color: 'var(--ink-2)',
                    borderTop: '1px solid var(--rule)',
                    paddingTop: 8,
                    lineHeight: 1.55,
                  }}
                >
                  {preview.narrative[0]}
                </div>
              )}
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// All React hooks are called unconditionally at the top of this component,
// before any conditional return, satisfying Rules of Hooks.
// ─────────────────────────────────────────────────────────────────────────────

export default function FacilityCommand() {
  const { navigate } = useRouter();
  const { boot, state, optimization, version } = useTwin();
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  // Hooks — called unconditionally
  const facilityId = readId();

  const forecast = useResource(() => api.forecast(), [version], [
    'Loading feedstock forecasts…',
    'Aggregating source availability…',
  ]);
  const bottlenecks = useResource(() => api.bottlenecks(), [version], [
    'Loading bottleneck data…',
  ]);

  // Derived values — all useMemo calls must be here, before any return
  const r = optimization?.result;
  const windowDays = state?.assumptions.windowDays ?? 30;

  const fac = useMemo(
    () => (state && facilityId ? state.facilities.find((f) => f.id === facilityId) : undefined),
    [state, facilityId],
  );

  const feeds = useMemo(
    () => (r && facilityId ? r.allocations.filter((a) => a.facilityId === facilityId) : []),
    [r, facilityId],
  );

  const loadT = useMemo(() => feeds.reduce((s, a) => s + a.tonnes, 0), [feeds]);
  const capWindow = fac ? fac.capacityTpd * fac.availability * windowDays : 0;
  const loadTpd = windowDays > 0 ? loadT / windowDays : 0;
  const utilPct = capWindow > 0 ? (loadT / capWindow) * 100 : 0;
  const marginInrTotal = useMemo(() => feeds.reduce((s, a) => s + a.marginInr, 0), [feeds]);
  const carbonTTotal = useMemo(() => feeds.reduce((s, a) => s + a.netCarbonT, 0), [feeds]);
  const intensityPerT = loadT > 0 ? carbonTTotal / loadT : 0;
  const marginPerT = loadT > 0 ? marginInrTotal / loadT : 0;

  const shadow = useMemo(
    () => (r && facilityId ? r.shadowPrices.find((s) => s.facilityId === facilityId) : undefined),
    [r, facilityId],
  );
  const isBinding = shadow?.binding ?? false;
  const isIdle = loadT === 0;

  const allocSources: AllocSource[] = useMemo(
    () =>
      state
        ? feeds.map((a) => ({
            id: a.sourceId,
            name: state.sources.find((s) => s.id === a.sourceId)?.name ?? a.sourceId,
            tonnes: a.tonnes,
            distanceKm: a.distanceKm,
            stream: a.stream,
            trips: a.trips,
            marginInr: a.marginInr,
          }))
        : [],
    [feeds, state],
  );

  const selectedSrc = useMemo(
    () => (selectedSourceId ? allocSources.find((s) => s.id === selectedSourceId) ?? null : null),
    [selectedSourceId, allocSources],
  );

  const outlookPoints: OutlookPoint[] = useMemo(() => {
    if (!forecast.data || feeds.length === 0) return [];
    const feedSourceIds = new Set(feeds.map((a) => a.sourceId));
    const allPoints: Map<string, { avail: number; lower: number; upper: number }> = new Map();

    for (const [sid, sf] of Object.entries(forecast.data.bySource)) {
      if (!feedSourceIds.has(sid)) continue;
      for (const pt of sf.points) {
        const existing = allPoints.get(pt.date) ?? { avail: 0, lower: 0, upper: 0 };
        existing.avail += pt.predicted;
        existing.lower += pt.lower;
        existing.upper += pt.upper;
        allPoints.set(pt.date, existing);
      }
    }

    return Array.from(allPoints.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 12)
      .map(([date, v], i) => ({
        weekIndex: i,
        label: dateShort(date),
        availableT: v.avail,
        lowerT: v.lower,
        upperT: v.upper,
      }));
  }, [forecast.data, feeds]);

  const totalAvailableFromSources = useMemo(
    () =>
      state
        ? feeds.reduce((s, a) => {
            const src = state.sources.find((x) => x.id === a.sourceId);
            return s + (src?.availableT ?? 0);
          }, 0)
        : 0,
    [feeds, state],
  );
  const availableTpd = windowDays > 0 ? totalAvailableFromSources / windowDays : 0;

  const opportunity = useMemo(() => {
    if (!bottlenecks.data || !facilityId) return null;
    if (capWindow - loadT < 5) return null;
    const engOpp = bottlenecks.data.opportunities.find(
      (o) => o.bestFacilityId === facilityId && o.headroomT > 0,
    );
    if (!engOpp) return null;
    return {
      headroomT: engOpp.headroomT,
      sourceName: engOpp.name,
      sourceT: engOpp.tonnes,
      potentialMarginInr: engOpp.headroomT * marginPerT,
      potentialCarbonT: engOpp.headroomT * intensityPerT,
      note: engOpp.note,
    };
  }, [bottlenecks.data, capWindow, loadT, facilityId, marginPerT, intensityPerT]);

  // ── Guards — all conditional returns are AFTER all hook calls ──

  if (!boot || !state || !optimization) {
    return <Loading message="Loading facility data…" />;
  }

  if (!facilityId) {
    return (
      <div className="section" style={{ marginTop: 24 }}>
        <Empty
          title="No facility selected"
          body="Navigate here from the Facilities screen by clicking a row."
        />
      </div>
    );
  }

  if (!fac) {
    return (
      <div className="section" style={{ marginTop: 24 }}>
        <Empty
          title="Facility not found"
          body={`No facility with ID "${facilityId}" exists in the current network state.`}
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="page">
      {/* ── Command header ── */}
      <div
        className="page-head"
        style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10, padding: '14px 22px' }}
      >
        {/* Back link + facility identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn sm"
            onClick={() => navigate('/facilities')}
            style={{ flexShrink: 0 }}
          >
            ← Facilities
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 18, letterSpacing: '-0.015em', margin: 0 }}>
                {fac.name.toUpperCase()}
              </h1>
              <Tag>{PATHWAY_SHORT[fac.pathway as PathwayId] ?? fac.pathway}</Tag>
              <StatusDot status={fac.status} />
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                {fac.operator} · {fac.district}
              </span>
            </div>
          </div>

          {/* Constraint badge — prominent in header */}
          {isBinding && shadow && (
            <div
              style={{
                background: 'var(--warn-bg)',
                border: '1px solid #ddc79a',
                padding: '6px 12px',
                flexShrink: 0,
                textAlign: 'right',
              }}
            >
              <div
                style={{
                  fontSize: 9.5,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--warn)',
                  fontWeight: 600,
                  marginBottom: 1,
                }}
              >
                Capacity constrained
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--ink)',
                  fontWeight: 600,
                }}
              >
                {inrExact(shadow.marginPerExtraTonne)} / additional t/day
              </div>
            </div>
          )}

          {isIdle && (
            <div
              style={{
                background: 'var(--neg-bg)',
                border: '1px solid #ddb7ad',
                padding: '6px 12px',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: 9.5,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--neg)',
                  fontWeight: 600,
                }}
              >
                Idle — below minimum viable feed
              </div>
              <div style={{ fontSize: 11, color: 'var(--neg)', marginTop: 1 }}>
                Needs ≥ {num(fac.minFeedTpd)} t/d to operate
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Operator orientation strip — lucide icon tiles ── */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid var(--rule)',
          fontSize: 11.5,
          background: 'var(--surface-sunken)',
        }}
      >
        {([
          {
            Icon: Package,
            label: 'Feedstock available',
            value: `${num(availableTpd, 1)} t/d`,
            hint: 'From all allocated sources',
          },
          {
            Icon: Settings,
            label: 'Currently allocated',
            value: `${num(loadTpd, 1)} t/d`,
            hint: `Optimiser decision · ${pct(utilPct, 0)} of nameplate`,
          },
          {
            Icon: Activity,
            label: 'Status',
            value: isBinding ? 'Constrained' : isIdle ? 'Idle / offline' : 'Operating normally',
            hint: isBinding
              ? `Shadow price: ${shadow ? `${shadow.marginPerExtraTonne.toFixed(0)}/t` : '—'}`
              : isIdle
                ? `Needs ≥ ${num(fac.minFeedTpd)} t/d to run`
                : 'Spare capacity available',
            valueColor: isBinding ? 'var(--warn)' : isIdle ? 'var(--neg)' : 'var(--green-500)',
          },

        ] as const).map((item, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRight: i < 2 ? '1px solid var(--rule)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--ink-3)', marginBottom: 3, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
              <item.Icon size={11} style={{ flexShrink: 0 }} />
              {item.label}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: ('valueColor' in item ? item.valueColor : undefined) ?? 'var(--ink)', fontSize: 12 }}>
              {item.value}
            </div>
            <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 1 }}>{item.hint}</div>
          </div>
        ))}
      </div>


      {/* ── Feedstock Availability Outlook ── */}
      <div className="section">
        <SectionHead
          title="Feedstock Availability Outlook"
        >
          <InfoTip content="Green area = forecasted source supply (with uncertainty band). Dashed line = optimiser allocation. Solid line = nameplate ceiling." />
        </SectionHead>
        {forecast.loading ? (
          <Loading message={forecast.message} />
        ) : outlookPoints.length === 0 ? (
          <Empty
            title="No forecast available"
            body="Forecast data could not be aggregated for the sources feeding this facility."
          />
        ) : (
          <Panel flush>
            <div style={{ padding: '12px 12px 8px' }}>
              {/* Key numbers above chart */}
              <div
                style={{
                  display: 'flex',
                  gap: 28,
                  marginBottom: 12,
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <div>
                  <span
                    style={{
                      color: 'var(--ink-3)',
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.09em',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    Available supply
                  </span>
                  <br />
                  <strong style={{ color: 'var(--green-500)' }}>{num(availableTpd, 1)} t/d</strong>
                </div>
                <div>
                  <span
                    style={{
                      color: 'var(--ink-3)',
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.09em',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    Current allocation
                  </span>
                  <br />
                  <strong style={{ color: 'var(--ink)' }}>{num(loadTpd, 1)} t/d</strong>
                </div>
                <div>
                  <span
                    style={{
                      color: 'var(--ink-3)',
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.09em',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    Facility capacity
                  </span>
                  <br />
                  <strong style={{ color: 'var(--ink-3)' }}>{num(fac.capacityTpd)} t/d</strong>
                </div>
              </div>
              <FeedstockOutlookChart
                points={outlookPoints}
                allocationTpd={loadTpd}
                nameplateT={fac.capacityTpd}
                windowDays={windowDays}
                height={180}
              />
            </div>
          </Panel>
        )}
      </div>

      {/* ── Current Feedstock Allocation + Capacity Intelligence ── */}
      <div className="section">
        <div className="grid g-3-2" style={{ gap: 14 }}>
          {/* Left: score bars + flow diagram */}
          <Panel title={`Current Feedstock Allocation (${allocSources.length} sources)`}>
            {/* Concise header with InfoTip instead of long paragraph */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink-3)', marginBottom: 10 }}>
              Optimiser-routed feedstock batches this window.
              <strong style={{ color: 'var(--ink)' }}>Click any source</strong> for details.
              <InfoTip content="These are the feedstock batches the optimiser has routed to this facility this window. Each source shows tonnes allocated. Click any source to see feedstock type, haul distance, trips and margin." />
            </div>

            {/* Source score breakdown */}
            {allocSources.length > 0 && (
              <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--rule)' }}>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 6 }}>
                  Source match quality
                </div>
                <SourceScoreBar
                  sources={allocSources.map((s) => ({
                    id: s.id,
                    name: s.name,
                    distanceKm: s.distanceKm,
                    tonnes: s.tonnes,
                    marginInr: s.marginInr,
                    carbonPerT: loadT > 0 ? carbonTTotal / loadT : 0,
                  }))}
                />
              </div>
            )}

            {allocSources.length === 0 ? (
              <Empty
                title="No allocation"
                body="The optimiser did not assign feedstock to this facility this window."
              />
            ) : (
              <>
                <AllocationFlow
                  sources={allocSources}
                  facilityName={fac.name}
                  onSourceClick={setSelectedSourceId}
                  selectedSourceId={selectedSourceId}
                  height={Math.max(120, Math.min(allocSources.length, 14) * 34 + 24)}
                />
                {selectedSrc ? (
                  <SourceDetail
                    src={selectedSrc}
                    onClose={() => setSelectedSourceId(null)}
                  />
                ) : (
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-4)', fontStyle: 'italic' }}>
                    Click a source to inspect allocation details.
                  </div>
                )}
              </>
            )}
          </Panel>

          {/* Right: capacity intelligence — visual parameter matrix */}
          <Panel title="Capacity Intelligence">
            {/* Parameter matrix: label | value | bar | dot */}
            <div style={{ marginBottom: 10 }}>
              <ParameterRow
                label="Utilisation"
                value={pct(utilPct, 0)}
                barValue={utilPct}
                barMax={100}
                tone={utilPct >= 97 ? 'bad' : utilPct >= 85 ? 'warn' : 'ok'}
              />
              <ParameterRow
                label="Availability"
                value={pct(fac.availability * 100, 0)}
                barValue={fac.availability * 100}
                barMax={100}
                tone={fac.availability >= 0.85 ? 'ok' : 'warn'}
              />
              <ParameterRow
                label="Throughput"
                value={`${num(loadTpd, 1)} t/d`}
                barValue={loadTpd}
                barMax={fac.capacityTpd}
                tone={isIdle ? 'bad' : isBinding ? 'warn' : 'ok'}
              />
              <ParameterRow
                label="Spare headroom"
                value={`${num(capWindow - loadT, 0)} t`}
                barValue={Math.max(0, capWindow - loadT)}
                barMax={capWindow > 0 ? capWindow : 1}
                tone={capWindow - loadT < capWindow * 0.05 ? 'bad' : capWindow - loadT < capWindow * 0.2 ? 'warn' : 'ok'}
              />
              <ParameterRow
                label="Min viable feed"
                value={`${num(fac.minFeedTpd)} t/d`}
                barValue={loadTpd}
                barMax={fac.minFeedTpd}
                tone={loadTpd >= fac.minFeedTpd ? 'ok' : 'bad'}
              />
            </div>

            {/* Status */}
            <div style={{ borderTop: '1px solid var(--rule)', paddingTop: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 4 }}>Status</div>
              {isIdle ? (
                <div style={{ color: 'var(--neg)', fontWeight: 600 }}>Idle — insufficient feedstock</div>
              ) : isBinding ? (
                <div style={{ color: 'var(--warn)', fontWeight: 600 }}>Capacity constrained</div>
              ) : (
                <div style={{ color: 'var(--green-500)', fontWeight: 600 }}>Operating normally</div>
              )}

              {isBinding && shadow && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 4 }}>Marginal capacity value</div>
                  <div style={{ fontSize: 18, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--warn)' }}>
                    {inrExact(shadow.marginPerExtraTonne)} / t/day
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>
                    +{shadow.carbonPerExtraTonne.toFixed(3)} tCO₂e per additional t/day
                  </div>
                </div>
              )}
            </div>

            {/* Economics summary */}
            {loadT > 0 && (
              <div style={{ borderTop: '1px solid var(--rule)', paddingTop: 8 }}>
                <div style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 6 }}>Economics (from optimiser)</div>
                <dl className="kv" style={{ rowGap: 4 }}>
                  <dt>Margin</dt>
                  <dd style={{ color: marginInrTotal >= 0 ? 'var(--green-500)' : 'var(--neg)' }}>{inr(marginInrTotal)}</dd>
                  <dt>Margin / t</dt>
                  <dd>{inrExact(marginPerT)}</dd>
                  <dt>Carbon outcome</dt>
                  <dd>{num(carbonTTotal, 1)} tCO₂e</dd>
                  <dt>Carbon intensity</dt>
                  <dd>{intensityPerT.toFixed(3)} tCO₂e/t</dd>
                </dl>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* ── Capacity Opportunity ── */}
      {opportunity && (
        <div className="section">
          <SectionHead title="Capacity Opportunity" />
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 8, lineHeight: 1.5 }}>
            The optimisation engine has identified unallocated feedstock supply that this facility has headroom to absorb.
            This is <em>not</em> a manual estimate — it comes directly from the bottleneck analysis.
          </div>
          <div
            style={{
              background: 'var(--green-100)',
              border: '1px solid var(--green-300)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 9.5,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--green-700)',
                  fontWeight: 600,
                  marginBottom: 2,
                }}
              >
                Recoverable supply
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  color: 'var(--green-700)',
                }}
              >
                {num(opportunity.headroomT, 1)} t
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 2 }}>
                {opportunity.sourceName} · {num(opportunity.sourceT, 1)} t available
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 9.5,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                  fontWeight: 600,
                  marginBottom: 2,
                }}
              >
                Potential incremental value
              </div>
              <div
                style={{ fontSize: 16, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}
              >
                {inr(opportunity.potentialMarginInr)}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 9.5,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                  fontWeight: 600,
                  marginBottom: 2,
                }}
              >
                Potential carbon outcome
              </div>
              <div
                style={{ fontSize: 16, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}
              >
                +{num(opportunity.potentialCarbonT, 1)} tCO₂e
              </div>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <button className="btn primary" onClick={() => navigate('/bottlenecks')}>
                Explore opportunity →
              </button>
            </div>
          </div>
          {opportunity.note && (
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6, fontStyle: 'italic' }}>
              {opportunity.note}
            </div>
          )}
        </div>
      )}

      {/* ── What-If ── */}
      <WhatIfSection facilityId={facilityId} district={fac.district} />

      <div style={{ height: 32 }} />
    </div>
  );
}
