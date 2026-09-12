/**
 * Scenario simulator — the screen the whole product is built around.
 *
 * Layout: controls left, live network centre, impact analysis right, before/after
 * along the bottom. Running a scenario re-optimises the network from scratch on the
 * server and the map redraws with the new flows animating in, so the audience sees
 * the system respond rather than a page swap.
 *
 * Preview does not mutate live state. Apply does, and the header shows that the
 * network is no longer at baseline until it is reset.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from '../router.tsx';
import { api, useTwin } from '../store.tsx';
import { NetworkMap, type Selection } from '../components/NetworkMap.tsx';
import {
  Empty,
  ErrorState,
  Loading,
  Panel,
  SectionHead,
  Tag,
  DecisionBanner,
  ValueFlowChain,
} from '../components/Primitives.tsx';
import { inr, num, signedPct, deltaClass, km } from '../format.ts';
import type { ScenarioDef, ScenarioResult } from '../../../engine/src/types.ts';

export default function Scenarios() {
  const { boot, state, optimization, commitScenario, lastScenario, setLastScenario, busy } =
    useTwin();
  const { search } = useRouter();
  const [kind, setKind] = useState<string>('facility_offline');
  const [params, setParams] = useState<Record<string, string | number>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [stageIdx, setStageIdx] = useState(0);

  const defs = boot?.scenarios ?? [];
  const def = defs.find((d) => d.kind === kind) ?? defs[0];

  // Reset parameters to the scenario's declared defaults when the kind changes.
  const adopting = useRef(false);
  useEffect(() => {
    if (!def) return;
    if (adopting.current) {
      adopting.current = false;
      return;
    }
    const next: Record<string, string | number> = {};
    for (const p of def.params) next[p.key] = p.defaultValue;
    setParams(next);
  }, [def?.kind]);

  /**
   * A scenario can arrive as a deep link: /scenarios?kind=…&param=…
   *
   * Carbon Opportunities hands over the exact instance it measured, so the user
   * re-runs that change rather than rebuilding it from memory. Adopted once, then
   * the controls behave normally — this preselects, it does not lock.
   */
  const adoptedLink = useRef(false);
  useEffect(() => {
    if (adoptedLink.current || defs.length === 0) return;
    const q = new URLSearchParams(search);
    const linked = q.get('kind');
    if (!linked) return;
    const target = defs.find((d) => d.kind === linked);
    if (!target) return;

    adoptedLink.current = true;
    adopting.current = true;
    const next: Record<string, string | number> = {};
    for (const pd of target.params) {
      const raw = q.get(pd.key);
      if (raw === null) {
        next[pd.key] = pd.defaultValue;
        continue;
      }
      // Numbers arrive as strings; anything unparseable falls back to the
      // declared default rather than reaching the solver as NaN.
      if (pd.type === 'number') {
        const v = Number(raw);
        next[pd.key] = Number.isFinite(v) ? v : pd.defaultValue;
      } else {
        next[pd.key] = raw;
      }
    }
    setKind(target.kind);
    setParams(next);
  }, [search, defs.length]);

  // A scenario can also arrive from outside this screen — the guided demo runs
  // one directly. When that happens, adopt its selection so the controls describe
  // the result being shown rather than something the operator never chose.
  const ownRun = useRef<string | null>(null);
  useEffect(() => {
    if (!lastScenario) return;
    const signature = JSON.stringify(lastScenario.scenario);
    if (signature === ownRun.current) return;
    ownRun.current = signature;
    adopting.current = true;
    setKind(lastScenario.scenario.kind);
    setParams({ ...lastScenario.scenario.params });
  }, [lastScenario]);

  // Reveal computation stages in sequence once a result lands.
  useEffect(() => {
    if (!lastScenario) return;
    setStageIdx(0);
    const total = lastScenario.computeStages.length;
    const t = window.setInterval(() => {
      setStageIdx((i) => {
        if (i >= total) {
          window.clearInterval(t);
          return i;
        }
        return i + 1;
      });
    }, 130);
    return () => window.clearInterval(t);
  }, [lastScenario]);

  const run = async (commit: boolean) => {
    if (!def) return;
    setRunning(true);
    setError(null);
    try {
      if (commit) {
        await commitScenario({ kind: def.kind, params });
      } else {
        const r = await api.scenario({ kind: def.kind as never, params }, false);
        setLastScenario(r.result);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const sc = lastScenario;

  // The map shows the after-state when a scenario has been simulated.
  const shownAllocations = sc ? sc.after.allocations : (optimization?.result.allocations ?? []);
  const focusIds = useMemo(
    () => (sc ? new Set(sc.affectedEntityIds) : undefined),
    [sc],
  );
  const changedIds = useMemo(() => {
    if (!sc) return undefined;
    return new Set(sc.flowChanges.map((f) => f.sourceId));
  }, [sc]);

  if (!boot || !state || !optimization) return <Loading message="Loading scenario engine…" />;

  return (
    <div className="page flush" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="page-head">
        <div>
          <h1>Scenario Simulator</h1>
          <div className="lede">
            Mutate the network, re-solve from scratch, and attribute every difference. Preview
            leaves the live network untouched; Apply commits the mutation.
          </div>
        </div>
        <div className="head-actions">
          {state.appliedScenarios.length > 0 && (
            <Tag tone="amber">{state.appliedScenarios.length} applied to live network</Tag>
          )}
        </div>
      </div>

      <div className="scenwrap">
        {/* ── Controls ─────────────────────────────────────────────────────── */}
        <div className="scenpanel">
          <div style={{ padding: '12px 12px 4px' }}>
            <div className="stat-label">Disruption</div>
          </div>
          <div style={{ padding: '0 12px' }}>
            {(['disruption', 'supply', 'market', 'strategy'] as const).map((cat) => (
              <div key={cat}>
                {cat !== 'disruption' && (
                  <div className="stat-label" style={{ margin: '12px 0 6px' }}>
                    {cat === 'supply' ? 'Supply' : cat === 'market' ? 'Market' : 'Strategy'}
                  </div>
                )}
                {defs
                  .filter((d) => d.category === cat)
                  .map((d) => (
                    <div
                      key={d.kind}
                      className={`scencard ${kind === d.kind ? 'sel' : ''}`}
                      onClick={() => setKind(d.kind)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setKind(d.kind);
                      }}
                    >
                      <div className="sc-t">{d.label}</div>
                      <div className="sc-d">{d.description}</div>
                    </div>
                  ))}
              </div>
            ))}
          </div>

          {def && (
            <div className="scenparams">
              <div className="stat-label" style={{ marginBottom: 9 }}>
                Parameters
              </div>
              {def.params.map((p) => (
                <ParamField
                  key={p.key}
                  def={p}
                  value={params[p.key]}
                  onChange={(v) => setParams((s) => ({ ...s, [p.key]: v }))}
                />
              ))}

              <div style={{ display: 'flex', gap: 7, marginTop: 12 }}>
                <button
                  className="btn primary"
                  onClick={() => run(false)}
                  disabled={running || !!busy}
                  style={{ flex: 1 }}
                >
                  {running ? 'Re-optimising…' : 'Simulate'}
                </button>
                <button
                  className="btn"
                  onClick={() => run(true)}
                  disabled={running || !!busy}
                  title="Commit this mutation to the live network state"
                >
                  Apply
                </button>
              </div>
              {sc && (
                <button
                  className="btn sm"
                  style={{ marginTop: 7, width: '100%' }}
                  onClick={() => setLastScenario(null)}
                >
                  Clear simulation
                </button>
              )}
              <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.5 }}>
                {def.demoHeadline}
              </p>
            </div>
          )}
        </div>

        {/* ── Map + stages ─────────────────────────────────────────────────── */}
        <div className="scencenter">
          {/* The map keeps a floor height so that on a short laptop viewport the
              stage log and delta strip push it into a scroll rather than
              squeezing it into a strip. */}
          <div style={{ flex: 1, minHeight: 340, display: 'flex' }}>
            <div className="mapwrap" style={{ gridTemplateColumns: '1fr', flex: 1 }}>
              <NetworkMap
                sources={state.sources}
                facilities={state.facilities}
                allocations={shownAllocations}
                selection={selection}
                onSelect={setSelection}
                focusIds={focusIds}
                highlightIds={changedIds}
                showLegend={false}
              />
            </div>
          </div>

          {sc && (
            <div className="stagelog" style={{ maxHeight: 132, overflowY: 'auto' }}>
              {sc.computeStages.slice(0, stageIdx).map((s, i) => (
                <div className="stagerow done" key={s.label}>
                  <div className="st-i">{String(i + 1).padStart(2, '0')}</div>
                  <div>
                    <div>{s.label}</div>
                    <div className="st-d">{s.detail}</div>
                  </div>
                  <div className="st-ms">{s.ms} ms</div>
                </div>
              ))}
            </div>
          )}

          {sc && <DeltaStrip sc={sc} />}
        </div>

        {/* ── Impact analysis ──────────────────────────────────────────────── */}
        <div className="scenpanel right">
          {error ? (
            <div style={{ padding: 14 }}>
              <ErrorState message={error} />
            </div>
          ) : !sc ? (
            <div style={{ padding: 14 }}>
              <Empty
                title="No scenario simulated yet"
                body="Pick a disruption on the left, set its parameters, and press Simulate. The network will be re-optimised from scratch and every difference attributed flow by flow."
                why="Nothing here is precomputed — the after-state is what the optimiser would produce if the world had always looked that way."
              />
            </div>
          ) : (
            <>
              <div className="inspect-head">
                <div className="kind">Simulation result</div>
                <h3>{sc.label}</h3>
                <div className="sub">
                  Re-solved in {sc.after.telemetry.solveMs} ms · {sc.flowChanges.length} flow changes
                </div>
              </div>

              <div style={{ padding: 14 }}>
                {(() => {
                  const carbonDelta = sc.deltas.find((d) => d.key === 'netCarbonT')?.deltaPct ?? 0;
                  const marginDelta = sc.deltas.find((d) => d.key === 'marginInr')?.deltaPct ?? 0;
                  return (
                    <>
                      <DecisionBanner
                        badge="Scenario Impact State"
                        happening={sc.narrative[0] ?? sc.label}
                        why={
                          <>
                            Carbon shift: <strong>{signedPct(carbonDelta)}</strong> ({num(sc.after.totals.netCarbonT - sc.before.totals.netCarbonT)} tCO₂e), Margin shift: <strong>{signedPct(marginDelta)}</strong> ({inr(sc.after.totals.marginInr - sc.before.totals.marginInr)}).
                          </>
                        }
                        action="Press 'Apply' to commit this scenario state to the live network digital twin."
                        actionLabel="Apply to Network"
                        onAction={() => commitScenario(sc.scenario)}
                      />

                      <ValueFlowChain
                        title="Scenario Shift Flow"
                        steps={[
                          { label: 'Shock Type', value: sc.label, sub: 'State Mutation' },
                          { label: 'Flow Changes', value: `${sc.flowChanges.length} Arcs`, sub: `${sc.after.telemetry.solveMs} ms Re-solve` },
                          { label: 'Net Carbon Shift', value: `${signedPct(carbonDelta)}`, sub: `${num(sc.after.totals.netCarbonT)} tCO₂e After`, tone: carbonDelta >= 0 ? 'pos' : 'neg' },
                          { label: 'Margin Impact', value: `${signedPct(marginDelta)}`, sub: `${inr(sc.after.totals.marginInr)} After`, tone: marginDelta >= 0 ? 'pos' : 'neg' },
                        ]}
                      />
                    </>
                  );
                })()}

                <div className="stat-label">Detailed Narrative</div>
                <ul style={{ margin: '7px 0 0', paddingLeft: 16, fontSize: 12, lineHeight: 1.6 }}>
                  {sc.narrative.slice(1).map((n, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      {n}
                    </li>
                  ))}
                </ul>

                <hr className="hairline" />
                <div className="stat-label">Flow changes</div>
                {sc.flowChanges.length === 0 ? (
                  <p style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 6 }}>
                    The optimal allocation did not change. The scenario affected something the
                    current plan does not depend on.
                  </p>
                ) : (
                  <div className="flowlist" style={{ marginTop: 4 }}>
                    {sc.flowChanges.slice(0, 12).map((f, i) => (
                      <div className="fl-row" key={i}>
                        <div className="fl-t">{num(f.tonnes)} t</div>
                        <div className="fl-d">
                          <b>{f.sourceName}</b>{' '}
                          <Tag
                            tone={
                              f.changeType === 'dropped'
                                ? 'red'
                                : f.changeType === 'added'
                                  ? 'green'
                                  : undefined
                            }
                          >
                            {f.changeType}
                          </Tag>
                          <br />
                          {f.changeType === 'rerouted' ? (
                            <>
                              {f.fromFacilityName} → {f.toFacilityName}
                              {' · '}
                              <span className={f.distanceDeltaKm > 0 ? 'neg' : 'pos'}>
                                {f.distanceDeltaKm >= 0 ? '+' : '−'}
                                {km(Math.abs(f.distanceDeltaKm))}
                              </span>
                            </>
                          ) : f.changeType === 'dropped' ? (
                            <>was going to {f.fromFacilityName}, now stranded</>
                          ) : f.changeType === 'added' ? (
                            <>now going to {f.toFacilityName}</>
                          ) : (
                            <>
                              {f.changeType} at {f.toFacilityName}
                            </>
                          )}
                          {Math.abs(f.carbonDeltaT) > 0.5 && (
                            <>
                              {' · '}
                              <span className={f.carbonDeltaT >= 0 ? 'pos' : 'neg'}>
                                {f.carbonDeltaT >= 0 ? '+' : '−'}
                                {num(Math.abs(f.carbonDeltaT))} tCO₂e
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {sc.flowChanges.length > 12 && (
                      <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 7 }}>
                        and {sc.flowChanges.length - 12} more.
                      </p>
                    )}
                  </div>
                )}

                {sc.newBottlenecks.length > 0 && (
                  <>
                    <hr className="hairline" />
                    <div className="stat-label">New bottlenecks</div>
                    {sc.newBottlenecks.slice(0, 4).map((b) => (
                      <div key={b.id} style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                          <Tag tone={b.severity === 'critical' ? 'red' : 'amber'}>{b.severity}</Tag>
                          <strong style={{ fontSize: 12 }}>{b.title}</strong>
                        </div>
                        <p style={{ fontSize: 11.5, color: 'var(--ink-2)', margin: '4px 0 0', lineHeight: 1.5 }}>
                          {b.detail}
                        </p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ParamField({
  def,
  value,
  onChange,
}: {
  def: ScenarioDef['params'][number];
  value: string | number | undefined;
  onChange: (v: string | number) => void;
}) {
  if (def.type === 'choice') {
    return (
      <div className="field">
        <label htmlFor={`p-${def.key}`}>{def.label}</label>
        <select
          id={`p-${def.key}`}
          className="inp"
          value={String(value ?? def.defaultValue)}
          onChange={(e) => onChange(e.target.value)}
        >
          {def.choices?.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  const v = Number(value ?? def.defaultValue);
  return (
    <div className="field">
      <label htmlFor={`p-${def.key}`}>
        {def.label}
        <span className="val">
          {num(v, def.step && def.step < 1 ? 2 : 0)} {def.unit}
        </span>
      </label>
      <input
        id={`p-${def.key}`}
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function DeltaStrip({ sc }: { sc: ScenarioResult }) {
  const show = [
    'divertedT',
    'netCarbonT',
    'durableRemovalT',
    'marginInr',
    'strandedT',
    'tkm',
    'transportEmissionsT',
  ];
  const rows = show
    .map((k) => sc.deltas.find((d) => d.key === k))
    .filter(Boolean) as ScenarioResult['deltas'];

  return (
    <div className="deltastrip">
      {rows.map((d) => {
        const fmt = (v: number) => (d.unit === '₹' ? inr(v) : num(v));
        return (
          <div className="deltacell" key={d.key}>
            <div className="dl">{d.label}</div>
            <div className="dv">{fmt(d.after)}</div>
            <div className={`dd ${deltaClass(d.delta, d.higherIsBetter)}`}>
              {signedPct(d.deltaPct)}
            </div>
            <div className="dbefore">was {fmt(d.before)}</div>
          </div>
        );
      })}
    </div>
  );
}
