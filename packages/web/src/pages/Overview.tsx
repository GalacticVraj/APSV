/**
 * Overview — the control tower.
 *
 * Answers three questions in order, and nothing else:
 *   WHAT IS HAPPENING   the current network state
 *   WHAT CHANGED        deltas against the status-quo baseline
 *   WHAT SHOULD WE DO   the binding constraint and its priced fix
 *
 * Deliberately not a grid of KPI cards. The numbers that matter sit in one ruled
 * strip; everything below it is either an instruction or the evidence for one.
 */

import { useMemo } from 'react';
import { useTwin, useResource, api } from '../store.tsx';
import { Link } from '../router.tsx';
import {
  DataTable,
  Empty,
  ErrorState,
  Loading,
  Panel,
  SectionHead,
  Stat,
  StatStrip,
  Tag,
  CountUp,
  DecisionBanner,
  ValueFlowChain,
} from '../components/Primitives.tsx';
import { NetworkMap } from '../components/NetworkMap.tsx';
import { BarList, StackedBar, seriesColor } from '../components/Charts.tsx';
import { inr, num, pct, signedPct, tonnes, deltaClass, dateShort } from '../format.ts';
import type { PathwayId } from '../../../engine/src/types.ts';

export default function Overview() {
  const { boot, state, optimization, version } = useTwin();
  const bn = useResource(() => api.bottlenecks(), [version], [
    'Scanning facility utilisation…',
    'Attributing stranded feedstock…',
    'Scoring opportunity by source…',
  ]);
  const fc = useResource(() => api.forecast(), [version], [
    'Training ridge models on 104 weeks of supply history…',
    'Running walk-forward backtest…',
  ]);

  // Hooks must run unconditionally, so the composition is derived before the
  // loading guard rather than after it.
  const pathwayMeta = boot?.reference.pathways as Record<string, { short: string }> | undefined;
  const byPathway = useMemo(() => {
    const allocations = optimization?.result.allocations ?? [];
    const m = new Map<string, number>();
    for (const a of allocations) m.set(a.pathway, (m.get(a.pathway) ?? 0) + a.tonnes);
    return [...m.entries()]
      .map(([k, v]) => ({ label: pathwayMeta?.[k]?.short ?? k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [optimization, pathwayMeta]);

  if (!boot || !state || !optimization) return <Loading message="Loading network…" />;

  const r = optimization.result;
  const T = r.totals;
  const B = optimization.baseline;

  const topBottleneck = bn.data?.bottlenecks[0] ?? null;
  // Show the shadow price *for the facility this finding is about*, so the two
  // halves of the panel describe the same asset. Fall back to the network's
  // highest-value binding constraint only when the finding names no facility.
  const binding = r.shadowPrices.filter((s) => s.binding);
  const topShadow =
    binding.find((s) => topBottleneck?.entityIds.includes(s.facilityId)) ?? binding[0] ?? null;

  const deltaVsBaseline = (a: number, b: number) => (b !== 0 ? ((a - b) / Math.abs(b)) * 100 : 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Network Overview</h1>
          <div className="lede">
            {boot.product.region}. {num(state.sources.length)} aggregation points,{' '}
            {num(state.facilities.length)} processing facilities, {state.assumptions.windowDays}-day
            planning window from {dateShort(state.asOf)}.
          </div>
        </div>
        <div className="head-actions">
          <Tag tone={r.telemetry.provenOptimal ? 'green' : 'amber'}>
            {r.telemetry.provenOptimal ? 'Proven optimal' : `Gap ${r.telemetry.gapPct.toFixed(2)}%`}
          </Tag>
          <Tag>{boot.reference.objectives[state.objective].label}</Tag>
        </div>
      </div>

      {/* ── WHAT IS HAPPENING ─────────────────────────────────────────────── */}
      <div className="section">
        <DecisionBanner
          badge="Control Tower Operating State"
          happening={
            <>
              <strong>{num(T.divertedT)} t waste</strong> ({pct(T.divertedPct, 0)}) routed to{' '}
              <strong>{r.openFacilities.length} active facilities</strong> out of {state.facilities.length} available.
            </>
          }
          why={
            <>
              Optimised allocation delivers <strong>{signedPct(deltaVsBaseline(T.netCarbonT, B.netCarbonT))} carbon gain</strong> ({num(T.netCarbonT)} tCO₂e) and{' '}
              <strong>{signedPct(deltaVsBaseline(T.marginInr, B.marginInr))} margin</strong> ({inr(T.marginInr)}) over status-quo.
            </>
          }
          action={
            topBottleneck ? (
              <>
                <strong>{topBottleneck.title}:</strong> {topBottleneck.recommendation}
              </>
            ) : (
              'Network routing operating at mathematical optimum. Review shadow prices to allocate capital.'
            )
          }
          actionLabel="View Bottlenecks →"
          to="/bottlenecks"
        />

        <ValueFlowChain
          title="Value Storytelling — Primary Waste-to-Carbon Pathway"
          steps={[
            { label: 'Feedstock Supply', value: `${num(T.divertedT)} t Waste`, sub: `${num(state.sources.length)} District Sources` },
            { label: 'Network Routing', value: `${r.openFacilities.length} Plants Running`, sub: 'Min-Cost Flow Solver' },
            { label: 'Primary Pathway', value: byPathway[0]?.label ?? 'Pyrolysis', sub: `${pct(((byPathway[0]?.value ?? 0) / Math.max(1, T.divertedT)) * 100, 0)} Vol Share` },
            { label: 'Carbon Impact', value: `${num(T.netCarbonT)} tCO₂e`, sub: `${signedPct(deltaVsBaseline(T.netCarbonT, B.netCarbonT))} vs Baseline`, tone: 'pos' },
            { label: 'Economic Value', value: `${inr(T.marginInr)} Margin`, sub: `${inr(T.marginPerTonneInr)}/t Net`, tone: 'pos' },
          ]}
        />

        <SectionHead
          title="Network Performance Metrics"
          note={`Solved in ${r.telemetry.solveMs} ms · seed ${r.seed}`}
        />
        <StatStrip>
          <Stat
            label="Waste diverted"
            value={<CountUp value={T.divertedT} format={(v) => num(v)} />}
            unit="t"
            sub={`of ${num(T.suppliedT)} t available · ${pct(T.divertedPct, 1)}`}
            delta={deltaVsBaseline(T.divertedT, B.divertedT)}
          />
          <Stat
            label="Net carbon impact"
            value={<CountUp value={T.netCarbonT} format={(v) => num(v)} />}
            unit="tCO₂e"
            sub={`${num(T.durableRemovalT)} t durable · ${num(T.avoidedEmissionsT)} t avoided`}
            delta={deltaVsBaseline(T.netCarbonT, B.netCarbonT)}
            size="lg"
          />
          <Stat
            label="Operating margin"
            value={<CountUp value={T.marginInr} format={(v) => inr(v)} />}
            sub={`${inr(T.marginPerTonneInr)} per tonne`}
            delta={deltaVsBaseline(T.marginInr, B.marginInr)}
          />
          <Stat
            label="Stranded"
            value={<CountUp value={T.strandedT} format={(v) => num(v)} />}
            unit="t"
            sub={`${pct(100 - T.divertedPct, 1)} of supply unplaced`}
            tone={T.strandedT > T.suppliedT * 0.3 ? 'neg' : undefined}
          />
          <Stat
            label="Transport burden"
            value={num(T.tkm / 1000)}
            unit="k t·km"
            sub={`${num(T.vehicleTrips)} trips · fleet ${pct(T.fleetUtilisationPct, 0)}`}
          />
          <Stat
            label="Facilities running"
            value={`${r.openFacilities.length}/${state.facilities.length}`}
            sub={`${r.idleFacilities.length} below minimum viable feed`}
          />
        </StatStrip>
      </div>

      {/* ── WHAT SHOULD WE DO ─────────────────────────────────────────────── */}
      <div className="section">
        <SectionHead title="What should we do" />
        {bn.loading ? (
          <Loading message={bn.message} />
        ) : bn.error ? (
          <ErrorState message={bn.error} onRetry={bn.reload} />
        ) : topBottleneck ? (
          <div className="panel">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 300px',
                borderBottom: '1px solid var(--rule)',
              }}
            >
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                  <Tag tone={topBottleneck.severity === 'critical' ? 'red' : 'amber'}>
                    {topBottleneck.severity}
                  </Tag>
                  <strong style={{ fontSize: 14 }}>{topBottleneck.title}</strong>
                </div>
                <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--ink-2)', maxWidth: '72ch' }}>
                  {topBottleneck.detail}
                </p>
                <p style={{ margin: 0, fontSize: 12.5 }}>
                  <strong>Recommended:</strong> {topBottleneck.recommendation}
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--ink-3)' }}>
                  {topBottleneck.quantifiedUpside}
                </p>
              </div>
              <div
                style={{
                  borderLeft: '1px solid var(--rule)',
                  padding: '14px 16px',
                  background: 'var(--surface-sunken)',
                }}
              >
                <div className="stat-label">Marginal value of capacity</div>
                {topShadow ? (
                  <>
                    <div className="stat-value sm" style={{ marginTop: 5 }}>
                      {topShadow.carbonPerExtraTonne.toFixed(2)}
                      <span className="stat-unit">tCO₂e / t</span>
                    </div>
                    <div className="stat-value sm">
                      {inr(topShadow.marginPerExtraTonne)}
                      <span className="stat-unit">/ t</span>
                    </div>
                    <div className="stat-sub" style={{ marginTop: 6 }}>
                      at {topShadow.facilityName}, measured by re-optimising with one extra tonne
                      per day of headroom.
                    </div>
                  </>
                ) : (
                  <div className="stat-sub" style={{ marginTop: 6 }}>
                    No capacity constraint is currently binding.
                  </div>
                )}
                <div style={{ marginTop: 10 }}>
                  <Link to="/bottlenecks">All findings and shadow prices →</Link>
                </div>
              </div>
            </div>
            {bn.data && bn.data.bottlenecks.length > 1 && (
              <div style={{ padding: '9px 16px', fontSize: 11.5, color: 'var(--ink-3)' }}>
                {bn.data.bottlenecks.length - 1} further findings —{' '}
                {bn.data.bottlenecks
                  .slice(1, 4)
                  .map((b) => b.title)
                  .join('; ')}
                .
              </div>
            )}
          </div>
        ) : (
          <Empty
            title="No bottlenecks detected"
            body="No facility is capacity-bound, no stream is without a pathway, and the fleet has headroom. The network is not currently constrained."
          />
        )}
      </div>

      {/* ── Map + composition ─────────────────────────────────────────────── */}
      <div className="section">
        <SectionHead title="Active network" note="Click any node to inspect it on the map screen" />
        <div className="grid g-3-2">
          <div className="panel" style={{ height: 380, display: 'flex', flexDirection: 'column' }}>
            <div className="mapwrap" style={{ gridTemplateColumns: '1fr', flex: 1 }}>
              <NetworkMap
                sources={state.sources}
                facilities={state.facilities}
                allocations={r.allocations}
                selection={null}
                onSelect={() => {}}
                showLabels={false}
                showLegend={false}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Panel title="Where the tonnage goes">
              <StackedBar
                segments={byPathway.map((p, i) => ({ ...p, color: seriesColor(i) }))}
                format={(v) => `${num(v)} t`}
              />
            </Panel>

            <Panel
              title="Upcoming supply"
              right={fc.data ? `MAPE ${fc.data.networkMapePct.toFixed(1)}%` : undefined}
            >
              {fc.loading ? (
                <Loading message={fc.message} />
              ) : fc.error ? (
                <ErrorState message={fc.error} onRetry={fc.reload} />
              ) : fc.data ? (
                <>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 9 }}>
                    Expected over the next {state.assumptions.windowDays} days:{' '}
                    <strong className="num">{num(fc.data.windowTotalT)} t</strong>{' '}
                    <span className="muted">
                      (90% interval {num(fc.data.windowLowerT)}–{num(fc.data.windowUpperT)} t)
                    </span>
                  </div>
                  <BarList
                    rows={fc.data.peakWeeks.map((p) => ({
                      label: `Week of ${dateShort(p.date)}`,
                      value: p.tonnes,
                    }))}
                    format={(v) => `${num(v)} t`}
                  />
                </>
              ) : null}
            </Panel>
          </div>
        </div>
      </div>

      {/* ── WHAT CHANGED ──────────────────────────────────────────────────── */}
      <div className="section">
        <SectionHead
          title="What changed"
          note="Against the nearest-facility heuristic an operator uses today"
        />
        <Panel flush>
          <DataTable
            rows={[
              { k: 'Waste diverted', a: T.divertedT, b: B.divertedT, u: 't', up: true },
              { k: 'Net carbon impact', a: T.netCarbonT, b: B.netCarbonT, u: 'tCO₂e', up: true },
              {
                k: 'Durable removal',
                a: T.durableRemovalT,
                b: B.durableRemovalT,
                u: 'tCO₂e',
                up: true,
              },
              {
                k: 'Transport emissions',
                a: T.transportEmissionsT,
                b: B.transportEmissionsT,
                u: 'tCO₂e',
                up: false,
              },
              { k: 'Operating margin', a: T.marginInr, b: B.marginInr, u: '₹', up: true },
              { k: 'Transport burden', a: T.tkm, b: B.tkm, u: 't·km', up: false },
              { k: 'Vehicle trips', a: T.vehicleTrips, b: B.vehicleTrips, u: 'trips', up: false },
            ]}
            rowKey={(r2) => r2.k}
            columns={[
              { key: 'k', header: 'Metric', render: (x) => <span className="name">{x.k}</span> },
              {
                key: 'b',
                header: 'Status quo',
                num: true,
                render: (x) => (x.u === '₹' ? inr(x.b) : num(x.b)),
              },
              {
                key: 'a',
                header: 'Optimised',
                num: true,
                render: (x) => (
                  <strong>{x.u === '₹' ? inr(x.a) : num(x.a)}</strong>
                ),
              },
              { key: 'u', header: 'Unit', render: (x) => <span className="muted">{x.u}</span> },
              {
                key: 'd',
                header: 'Change',
                num: true,
                render: (x) => {
                  const d = x.b !== 0 ? ((x.a - x.b) / Math.abs(x.b)) * 100 : 0;
                  return <span className={deltaClass(d, x.up)}>{signedPct(d)}</span>;
                },
              },
            ]}
          />
        </Panel>
        {T.divertedT < B.divertedT && (
          <div style={{ marginTop: 9, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6, maxWidth: '86ch' }}>
            <strong>The optimiser moves less material on purpose.</strong> The status-quo heuristic
            hauls {num(B.divertedT - T.divertedT)} t more than this plan does, because it sends
            every lot to the nearest site that will take it regardless of what that lot is worth on
            arrival. Those tonnes lose money and, on some arcs, lose carbon once transport and
            process emissions are charged. Dropping them is what buys{' '}
            <strong>{signedPct(deltaVsBaseline(T.netCarbonT, B.netCarbonT))} net carbon</strong> and{' '}
            <strong>{signedPct(deltaVsBaseline(T.marginInr, B.marginInr))} margin</strong> on{' '}
            {pct((T.tkm / Math.max(1, B.tkm)) * 100 - 100, 1).replace('-', '−')} of the transport
            burden. Tonnage diverted is an activity metric; carbon and margin are outcome metrics.
          </div>
        )}
      </div>
    </div>
  );
}
