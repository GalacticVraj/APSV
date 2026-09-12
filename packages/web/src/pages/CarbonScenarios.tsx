/**
 * Carbon Scenarios — the shock engine.
 *
 * This is the screen that proves TerraFlux is a twin rather than a report. The
 * user changes one real-world constraint, the whole network re-solves, and the
 * page shows that the system did not recalculate a number — it changed a physical
 * decision about where material goes.
 *
 * The causal chain is the layout, in order:
 *
 *   Builder      what changes, where, by how much — and the exact instance
 *   Canvas       baseline → shock → re-optimised → carbon delta
 *   Response     which sources moved to which plants, and which pathway
 *   Drivers      the ledger-line diff, which reconciles to the delta exactly
 *   Trade-off    carbon and economics classified, never merged
 *   Objectives   the same shock under each objective, each on its own baseline
 *   Why          composed from measured facts only
 *
 * Nothing here simulates. `runShock` wraps the existing scenario engine, which
 * deep-clones the network, applies the instance and re-optimises; this page reads
 * the result. The live network is never touched — the twin is only mutated if the
 * user explicitly commits, which this screen does not do.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, useResource, useTwin } from '../store.tsx';
import { ErrorState, Loading, Panel, SectionHead } from '../components/Primitives.tsx';
import { Link, useRouter } from '../router.tsx';
import { inr, num, pct } from '../format.ts';
import type { ObjectiveOutcome, ShockResult } from '../../../engine/src/shock.ts';
import type { ScenarioDef, ScenarioInstance } from '../../../engine/src/types.ts';

const CLASS_LABEL: Record<ShockResult['classification'], { carbon: string; econ: string; tone: string }> = {
  carbon_up_econ_up: { carbon: 'Carbon positive', econ: 'Economically positive', tone: 'agree' },
  carbon_up_econ_down: { carbon: 'Carbon positive', econ: 'Economic trade-off', tone: 'tradeoff' },
  carbon_down_econ_up: { carbon: 'Carbon negative', econ: 'Economically positive', tone: 'tradeoff' },
  carbon_down_econ_down: { carbon: 'Carbon negative', econ: 'Economically negative', tone: 'bad' },
};

export default function CarbonScenarios() {
  const { boot, state, version } = useTwin();
  const { search } = useRouter();

  const defs: ScenarioDef[] = boot?.scenarios ?? [];
  const [kind, setKind] = useState<string>('facility_offline');
  const [params, setParams] = useState<Record<string, string | number>>({});
  const [withObjectives, setWithObjectives] = useState(false);

  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<ShockResult | null>(null);
  const [objectives, setObjectives] = useState<ObjectiveOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromOpportunity, setFromOpportunity] = useState(false);

  const def = defs.find((d) => d.kind === kind) ?? defs[0];

  // Reset parameters to the definition's own defaults when the kind changes,
  // unless a deep link is mid-adoption.
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
   * A shock can arrive from Opportunities as a deep link. The instance is adopted
   * verbatim so the user re-runs exactly what was measured there — §16's
   * determinism requirement — rather than rebuilding it from UI values.
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
      if (pd.type === 'number') {
        const v = Number(raw);
        next[pd.key] = Number.isFinite(v) ? v : pd.defaultValue;
      } else {
        next[pd.key] = raw;
      }
    }
    setKind(target.kind);
    setParams(next);
    setFromOpportunity(q.get('from') === 'opportunity');
  }, [search, defs.length]);

  const instance: ScenarioInstance | null = def
    ? { kind: def.kind, params }
    : null;

  const run = useCallback(async () => {
    if (!instance) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setObjectives(null);
    setStage(0);

    // The stages are real: apply, re-optimise, rebuild the ledger, diff. They are
    // revealed on a short timer because the solve itself finishes in ~30 ms, which
    // is too fast to read. Nothing waits on the animation.
    const ticker = window.setInterval(() => setStage((s) => Math.min(s + 1, 3)), 260);
    try {
      const res = await api.shock(instance, withObjectives);
      setResult(res.shock);
      setObjectives(res.objectives);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That shock could not be evaluated.');
    } finally {
      window.clearInterval(ticker);
      setStage(4);
      setRunning(false);
    }
  }, [instance, withObjectives]);

  if (!boot || !state) return <Loading message="Loading…" />;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Carbon Scenarios</h1>
          <div className="lede">
            Change one real constraint and the whole network re-solves. Everything below is the
            difference between two full optimiser runs — including which source now goes to which
            plant, and on which pathway.
          </div>
        </div>
      </div>

      <Builder
        defs={defs}
        def={def}
        kind={kind}
        setKind={setKind}
        params={params}
        setParams={setParams}
        instance={instance}
        withObjectives={withObjectives}
        setWithObjectives={setWithObjectives}
        onRun={run}
        running={running}
        fromOpportunity={fromOpportunity}
      />

      {running && <Stages stage={stage} />}

      {error && (
        <div className="section">
          <ErrorState message={error} />
        </div>
      )}

      {result && !running && (
        <>
          <Canvas r={result} />
          <Response r={result} />
          <Drivers r={result} />
          <Objectives outcomes={objectives} requested={withObjectives} />
          <Why r={result} />
        </>
      )}

      {!result && !running && !error && <Idle />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Builder
// ─────────────────────────────────────────────────────────────────────────────

function Builder({
  defs,
  def,
  kind,
  setKind,
  params,
  setParams,
  instance,
  withObjectives,
  setWithObjectives,
  onRun,
  running,
  fromOpportunity,
}: {
  defs: ScenarioDef[];
  def: ScenarioDef | undefined;
  kind: string;
  setKind: (k: string) => void;
  params: Record<string, string | number>;
  setParams: (p: Record<string, string | number>) => void;
  instance: ScenarioInstance | null;
  withObjectives: boolean;
  setWithObjectives: (v: boolean) => void;
  onRun: () => void;
  running: boolean;
  fromOpportunity: boolean;
}) {
  const [showInstance, setShowInstance] = useState(false);
  if (!def) return null;

  return (
    <div className="section">
      <div className="shockbar">
        <div className="sb-field sb-what">
          <label className="sb-label">What changes</label>
          <select
            className="sb-select"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            disabled={running}
          >
            {defs.map((d) => (
              <option key={d.kind} value={d.kind}>
                {d.label}
              </option>
            ))}
          </select>
          <span className="sb-desc">{def.description}</span>
        </div>

        {def.params.map((p) => (
          <div key={p.key} className="sb-field">
            <label className="sb-label">{p.label}</label>
            {p.type === 'choice' ? (
              <select
                className="sb-select"
                value={String(params[p.key] ?? p.defaultValue)}
                onChange={(e) => setParams({ ...params, [p.key]: e.target.value })}
                disabled={running}
              >
                {(p.choices ?? []).map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="sb-num">
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={p.step ?? 1}
                  value={Number(params[p.key] ?? p.defaultValue)}
                  onChange={(e) => setParams({ ...params, [p.key]: Number(e.target.value) })}
                  disabled={running}
                />
                <span className="sb-numval mono">
                  {num(Number(params[p.key] ?? p.defaultValue), 0)}
                  {p.unit ? ` ${p.unit}` : ''}
                </span>
              </span>
            )}
          </div>
        ))}

        <div className="sb-run">
          <button className="btn primary" onClick={onRun} disabled={running}>
            {running ? 'Running…' : 'Run scenario'}
          </button>
        </div>
      </div>

      <div className="sb-foot">
        <button className="sb-toggle" onClick={() => setShowInstance(!showInstance)}>
          {showInstance ? '− ' : '+ '}Exact instance
        </button>
        <label className="sb-check">
          <input
            type="checkbox"
            checked={withObjectives}
            onChange={(e) => setWithObjectives(e.target.checked)}
            disabled={running}
          />
          Also evaluate under every objective <span className="muted">(eight solves)</span>
        </label>
        {fromOpportunity && (
          <span className="sb-from">Found in Opportunities · instance preserved exactly</span>
        )}
      </div>

      {showInstance && instance && (
        <pre className="sb-instance mono">{JSON.stringify(instance, null, 2)}</pre>
      )}
    </div>
  );
}

function Stages({ stage }: { stage: number }) {
  const labels = [
    'Cloning the network',
    'Applying the shock',
    'Re-optimising from scratch',
    'Rebuilding the carbon ledger',
  ];
  return (
    <div className="section">
      <div className="stages">
        {labels.map((l, i) => (
          <div key={l} className={`stg ${i <= stage ? 'on' : ''} ${i === stage ? 'active' : ''}`}>
            <span className="stg-dot" />
            <span className="stg-label">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Idle() {
  return (
    <div className="section">
      <div className="empty">
        <h4>No scenario run yet</h4>
        <p>
          Pick a change above and run it. The network is cloned, the change applied, and the
          optimiser re-solves from scratch — the live network is never modified, so nothing here
          can affect the plan the other screens are showing.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas
// ─────────────────────────────────────────────────────────────────────────────

function Canvas({ r }: { r: ShockResult }) {
  const cls = CLASS_LABEL[r.classification];
  const up = r.carbonDeltaT >= 0;

  return (
    <div className="section">
      <div className="canvas">
        <div className="cv-col">
          <div className="cv-label">Baseline</div>
          <div className="cv-value mono">{num(r.baseline.netT)}</div>
          <div className="cv-unit">tCO₂e</div>
          <div className="cv-meta">
            {num(r.baseline.divertedT)} t placed · {inr(r.baseline.marginInr)}
          </div>
        </div>

        <div className="cv-arrow" aria-hidden />

        <div className="cv-col cv-shock">
          <div className="cv-label">Shock applied</div>
          <div className="cv-shocktext">{r.label}</div>
          <div className="cv-meta">
            Network cloned, optimiser re-solved in {r.solveMs} ms
          </div>
        </div>

        <div className="cv-arrow" aria-hidden />

        <div className="cv-col">
          <div className="cv-label">Re-optimised</div>
          <div className="cv-value mono">{num(r.after.netT)}</div>
          <div className="cv-unit">tCO₂e</div>
          <div className="cv-meta">
            {num(r.after.divertedT)} t placed · {inr(r.after.marginInr)}
          </div>
        </div>

        <div className={`cv-delta ${up ? 'up' : 'down'}`}>
          <div className="cvd-label">Net carbon change</div>
          <div className="cvd-value mono">
            {up ? '+' : '−'}
            {num(Math.abs(r.carbonDeltaT))}
          </div>
          <div className="cvd-unit">tCO₂e · {pct(Math.abs(r.carbonDeltaPct), 1)}</div>
        </div>
      </div>

      <div className={`classify ${cls.tone}`}>
        <span className="cl-item">
          <span className="cl-key">Carbon</span>
          <span className={`cl-val ${up ? 'pos' : 'neg'}`}>{cls.carbon}</span>
          <span className="cl-num mono">
            {up ? '+' : '−'}
            {num(Math.abs(r.carbonDeltaT))} tCO₂e
          </span>
        </span>
        <span className="cl-item">
          <span className="cl-key">Economics</span>
          <span className={`cl-val ${r.marginDeltaInr >= 0 ? 'pos' : 'neg'}`}>{cls.econ}</span>
          <span className="cl-num mono">
            {r.marginDeltaInr >= 0 ? '+' : '−'}
            {inr(Math.abs(r.marginDeltaInr))}
          </span>
        </span>
        <span className="cl-item">
          <span className="cl-key">Transport burden</span>
          <span className="cl-num mono">
            {r.after.tkm >= r.baseline.tkm ? '+' : '−'}
            {num(Math.abs(r.after.tkm - r.baseline.tkm) / 1000)}k t·km
          </span>
        </span>
        <span className="cl-item">
          <span className="cl-key">Stranded</span>
          <span className="cl-num mono">
            {r.after.strandedT >= r.baseline.strandedT ? '+' : '−'}
            {num(Math.abs(r.after.strandedT - r.baseline.strandedT))} t
          </span>
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Network response
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The point of the whole screen: the system did not recalculate a number, it made
 * a different physical decision. Each row is one source and the plant it moved
 * between, drawn before → after.
 */
function Response({ r }: { r: ShockResult }) {
  if (!r.physicallyChanged) {
    return (
      <div className="section">
        <SectionHead title="Network response" />
        <Panel>
          <div className="empty">
            <h4>Network allocation unchanged</h4>
            <p>
              {r.unchangedReason} The carbon difference of{' '}
              {num(Math.abs(r.carbonDeltaT))} tCO₂e comes from how the same plan is valued or
              charged, not from material moving. The drivers below show which ledger lines moved.
            </p>
          </div>
        </Panel>
      </div>
    );
  }

  const reroutes = r.flowChanges.filter((f) => f.changeType === 'rerouted');
  const added = r.flowChanges.filter((f) => f.changeType === 'added');
  const dropped = r.flowChanges.filter((f) => f.changeType === 'dropped');
  const resized = r.flowChanges.filter(
    (f) => f.changeType === 'increased' || f.changeType === 'decreased',
  );
  const shown = [...reroutes, ...dropped, ...added, ...resized].slice(0, 10);

  return (
    <div className="section">
      <SectionHead
        title="Network response"
        note={
          `${r.flowChanges.length} flow${r.flowChanges.length === 1 ? '' : 's'} altered · ` +
          `${r.changedFacilities.length} plant${r.changedFacilities.length === 1 ? '' : 's'} changed intake`
        }
      />

      <Panel flush>
        <div className="respond">
          {shown.map((f, i) => (
            <div key={`${f.sourceId}-${i}`} className={`rp-row t-${f.changeType}`}>
              <span className="rp-src">
                <span className="rp-name">{f.sourceName}</span>
                <span className="rp-t mono">{num(f.tonnes)} t</span>
              </span>

              <span className="rp-chain">
                <span className="rp-before">
                  <span className="rp-stage">Before</span>
                  <span className="rp-dest">{f.fromFacilityName ?? 'stranded'}</span>
                </span>
                <span className="rp-arrow" aria-hidden />
                <span className="rp-after">
                  <span className="rp-stage">After</span>
                  <span className="rp-dest">{f.toFacilityName ?? 'stranded'}</span>
                </span>
              </span>

              <span className="rp-km mono">
                {f.distanceDeltaKm >= 0 ? '+' : '−'}
                {num(Math.abs(f.distanceDeltaKm))} km
              </span>
              <span className={`rp-c mono ${f.carbonDeltaT >= 0 ? 'pos' : 'neg'}`}>
                {f.carbonDeltaT >= 0 ? '+' : '−'}
                {num(Math.abs(f.carbonDeltaT))}
              </span>
              <span className="rp-act">
                {f.toFacilityId && (
                  <Link
                    to={`/carbon/ledger?source=${encodeURIComponent(f.sourceId)}&facility=${encodeURIComponent(f.toFacilityId)}`}
                    className="btn sm"
                  >
                    Trace
                  </Link>
                )}
              </span>
            </div>
          ))}
          {r.flowChanges.length > shown.length && (
            <div className="rp-more">
              {r.flowChanges.length - shown.length} further flows changed, ordered by size above.
            </div>
          )}
        </div>
      </Panel>

      {r.changedFacilities.length > 0 && (
        <div className="facdelta">
          <div className="fd-head">Plants whose intake changed</div>
          {r.changedFacilities.slice(0, 6).map((f) => (
            <div key={f.id} className="fd-row">
              <span className="fd-name">
                {f.name}
                <span className="fd-path">{f.pathwayShort}</span>
              </span>
              <span className="fd-t mono">
                {num(f.beforeT)} → {num(f.afterT)} t
              </span>
              <span className={`fd-c mono ${f.carbonDeltaT >= 0 ? 'pos' : 'neg'}`}>
                {f.carbonDeltaT >= 0 ? '+' : '−'}
                {num(Math.abs(f.carbonDeltaT))} tCO₂e
              </span>
              <Link to="/carbon/facilities" className="btn sm">
                Profile
              </Link>
            </div>
          ))}
        </div>
      )}

      {r.constraints.length > 0 && (
        <div className="constraints">
          <div className="cn-head">Constraints that flipped</div>
          {r.constraints.map((c) => (
            <div key={c.facilityId} className="cn-row">
              <span className="cn-name">{c.facilityName}</span>
              <span className={`cn-change ${c.change}`}>
                {c.change === 'became_binding' ? 'became binding' : 'went slack'}
              </span>
              <span className="cn-util mono">
                {pct(c.beforeUtilPct, 0)} → {pct(c.afterUtilPct, 0)} utilisation
              </span>
            </div>
          ))}
          <div className="cn-note">
            Read from the optimiser's own shadow prices before and after, not inferred from
            utilisation.
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Drivers
// ─────────────────────────────────────────────────────────────────────────────

function Drivers({ r }: { r: ShockResult }) {
  const max = Math.max(...r.groupDeltas.map((g) => Math.abs(g.delta)), 1);
  const sum = r.groupDeltas.reduce((a, g) => a + g.delta, 0);

  return (
    <div className="section">
      <SectionHead
        title="Where the carbon change came from"
        note="The two ledgers, differenced line by line"
      />
      <div className="grid g2 drv-grid">
        <Panel>
          <div className="drv">
            {r.groupDeltas.map((g) => (
              <div key={g.key} className="drv-row">
                <span className="drv-label">{g.label}</span>
                <span className="drv-track">
                  <span className="drv-mid" />
                  <span
                    className={`drv-fill ${g.delta >= 0 ? 'pos' : 'neg'}`}
                    style={{
                      width: `${(Math.abs(g.delta) / max) * 50}%`,
                      left: g.delta >= 0 ? '50%' : undefined,
                      right: g.delta < 0 ? '50%' : undefined,
                    }}
                  />
                </span>
                <span className={`drv-val mono ${g.delta >= 0 ? 'pos' : 'neg'}`}>
                  {g.delta >= 0 ? '+' : '−'}
                  {num(Math.abs(g.delta))}
                </span>
              </div>
            ))}
            <div className="drv-row drv-total">
              <span className="drv-label">Net change</span>
              <span className="drv-track" />
              <span className="drv-val mono">
                {r.carbonDeltaT >= 0 ? '+' : '−'}
                {num(Math.abs(r.carbonDeltaT))}
              </span>
            </div>
          </div>
          <div className="drv-note">
            These are ledger lines, not categories invented for this chart, so they sum to the net
            change exactly — {num(sum)} against {num(r.carbonDeltaT)} tCO₂e. There is no residual
            and no “other” bucket.
          </div>
        </Panel>

        <Panel title="Lines that moved">
          <table className="lined">
            <tbody>
              {r.lineDeltas.slice(0, 9).map((l) => (
                <tr key={l.key}>
                  <td className="ld-label">
                    {l.label}
                    <span className="ld-kind">{l.kind}</span>
                  </td>
                  <td className="mono ld-num">{num(l.before)}</td>
                  <td className="mono ld-num">{num(l.after)}</td>
                  <td className={`mono ld-num ${l.delta >= 0 ? 'pos' : 'neg'}`}>
                    {l.delta >= 0 ? '+' : '−'}
                    {num(Math.abs(l.delta))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="drv-note">
            <Link to="/carbon/evidence" className="btn sm">
              Inspect these lines in Evidence
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Objectives
// ─────────────────────────────────────────────────────────────────────────────

function Objectives({
  outcomes,
  requested,
}: {
  outcomes: ObjectiveOutcome[] | null;
  requested: boolean;
}) {
  if (!requested) return null;
  if (!outcomes) return null;

  const max = Math.max(...outcomes.map((o) => Math.abs(o.carbonDeltaT)), 1);

  return (
    <div className="section">
      <SectionHead
        title="The same shock under each objective"
        note="Each measured against its own baseline, so the objective switch is not counted as part of the shock"
      />
      <Panel flush>
        <div className="objcmp">
          {outcomes.map((o) => (
            <div key={o.objective} className={`oc-row ${o.isCurrent ? 'current' : ''}`}>
              <span className="oc-name">
                {o.label}
                {o.isCurrent && <span className="oc-tag">in force</span>}
              </span>
              <span className="oc-base mono">
                {num(o.baselineNetT)} → {num(o.scenarioNetT)}
              </span>
              <span className="oc-track">
                <span className="oc-mid" />
                <span
                  className={`oc-fill ${o.carbonDeltaT >= 0 ? 'pos' : 'neg'}`}
                  style={{
                    width: `${(Math.abs(o.carbonDeltaT) / max) * 50}%`,
                    left: o.carbonDeltaT >= 0 ? '50%' : undefined,
                    right: o.carbonDeltaT < 0 ? '50%' : undefined,
                  }}
                />
              </span>
              <span className={`oc-delta mono ${o.carbonDeltaT >= 0 ? 'pos' : 'neg'}`}>
                {o.carbonDeltaT >= 0 ? '+' : '−'}
                {num(Math.abs(o.carbonDeltaT))}
              </span>
              <span className={`oc-margin mono ${o.marginDeltaInr >= 0 ? 'pos' : 'neg'}`}>
                {o.marginDeltaInr >= 0 ? '+' : '−'}
                {inr(Math.abs(o.marginDeltaInr))}
              </span>
            </div>
          ))}
        </div>
      </Panel>
      <div className="oc-note">
        Every row is two real solves under that objective — the same optimiser and the same
        scalarisation Pathways and Opportunities use. Where the rows disagree, the network's
        response to this shock genuinely depends on what it is being asked to maximise.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Why
// ─────────────────────────────────────────────────────────────────────────────

function Why({ r }: { r: ShockResult }) {
  return (
    <div className="section">
      <SectionHead title="Why the network responded this way" />
      <Panel>
        <p className="shock-why">{r.why}</p>
        {r.narrative.length > 0 && (
          <ul className="shock-narr">
            {r.narrative.slice(0, 6).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
        <div className="shock-links">
          <Link to="/carbon/opportunities" className="btn sm">
            Carbon Opportunities
          </Link>
          <Link to="/carbon/pathways" className="btn sm">
            Pathway comparison
          </Link>
          <Link to="/carbon" className="btn sm">
            Carbon Home
          </Link>
        </div>
      </Panel>
      <div className="shock-basis">
        <span className="q-tag">Modelled estimate</span>
        Both sides are modelled plans for one planning window, produced by the same optimiser and
        the same carbon ledger the rest of the product uses. The live network was not modified —
        the shock was applied to a clone. Not measured, not verified, and not a carbon credit.
      </div>
    </div>
  );
}
