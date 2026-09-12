/**
 * Carbon Control Center.
 *
 * Not a page with a map on it. The network *is* the screen, edge to edge, and it
 * is moving before the reader has done anything. Everything else — the position,
 * the opportunity, the risk, the chain from material to carbon — sits in a rail
 * over it, so nothing is ever read in isolation from the system it describes.
 *
 * What the reader gets, in the order they get it:
 *
 *   3 s   a network with material visibly moving through it
 *   5 s   the carbon position of that network, beside it, not above it
 *  10 s   one opportunity and one risk, each a single figure
 *  20 s   four commands, each of which does something real
 *
 * Four commands, and every one is a real engine call:
 *
 *   OPTIMIZE   re-solves the live twin under a chosen objective and reports the
 *              difference between two ledgers.
 *   SIMULATE   runs a real ScenarioInstance uncommitted, keeps both plans, and
 *              the network redraws into the one you pick. The live twin is never
 *              mutated by a simulation.
 *   FOLLOW     walks one real allocation from field to ledger line.
 *   TRACE      opens the decomposition, which opens the Ledger, which opens
 *              Evidence.
 *
 * Three things this file will not do:
 *
 *  - Compute carbon. Every figure comes from /api/brief or a scenario run. An
 *    allocation-level sum sits on a different permanence basis and would
 *    disagree with the Plants screen by about 1.7%.
 *  - Fabricate liveness. Tokens move because the optimiser allocated tonnes to
 *    those arcs; plants pulse at a rate set by what they receive. No GPS, no
 *    vehicles, no clock, no telemetry.
 *  - Put engineering in the hero. Solver milliseconds and duality gap are real
 *    and worth showing, but they belong behind "why this number", not in front
 *    of someone deciding whether this product is worth their attention.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, useResource, useTwin } from '../store.tsx';
import { CountUp, ErrorState, Loading } from '../components/Primitives.tsx';
import { LiveNetwork, type LiveSelection } from '../components/LiveNetwork.tsx';
import { Drawer } from '../components/Drawer.tsx';
import { Link, useRouter } from '../router.tsx';
import { dateFull, inr, num, pct, timeShort } from '../format.ts';
import type { AllocationTrace, TraceCandidate } from '../../../engine/src/trace.ts';
import type { CarbonBrief } from '../../../engine/src/brief.ts';
import type {
  Allocation,
  Facility,
  ObjectiveMode,
  ScenarioResult,
  WasteSource,
} from '../../../engine/src/types.ts';
import '../styles/carbon-command.css';

type Overlay = null | 'why' | 'follow' | 'optimise' | 'simulate';

export default function CarbonCommand() {
  const { boot, state, optimization, version, setObjective, busy } = useTwin();
  const { navigate, search } = useRouter();

  const brief = useResource(() => api.brief(), [version], [
    'Reading the carbon position…',
    'Collecting opportunities and contingencies…',
  ]);

  const [overlay, setOverlay] = useState<Overlay>(null);
  const [selection, setSelection] = useState<LiveSelection>(null);

  /** A completed shock, kept so the network can be flipped between its two plans. */
  const [shock, setShock] = useState<ScenarioResult | null>(null);
  const [shockSide, setShockSide] = useState<'before' | 'after'>('after');

  const [pending, setPending] = useState<{ beforeT: number; beforeObjective: string } | null>(null);
  const [result, setResult] = useState<{ deltaT: number; from: string; to: string } | null>(null);

  const b = brief.data;

  // Another screen can hand work over with ?do=simulate.
  useEffect(() => {
    const want = new URLSearchParams(search).get('do');
    if (want === 'simulate' || want === 'optimise' || want === 'follow' || want === 'why') {
      setOverlay(want as Overlay);
    }
  }, [search]);

  // When the twin re-solves under a new objective, report the difference between
  // two real ledger reads a solve apart.
  useEffect(() => {
    if (!pending || !b) return;
    if (b.objective === pending.beforeObjective) return;
    setResult({
      deltaT: b.position.netT - pending.beforeT,
      from: pending.beforeObjective.replace(/_/g, ' '),
      to: b.objectiveLabel,
    });
    setPending(null);
  }, [b, pending]);

  const runOptimise = useCallback(
    async (mode: ObjectiveMode) => {
      if (!b || b.objective === mode) return;
      setResult(null);
      setShock(null);
      setSelection(null);
      setPending({ beforeT: b.position.netT, beforeObjective: b.objective });
      await setObjective(mode);
    },
    [b, setObjective],
  );

  // Plants the scenario knocked out — drawn offline. Above the guards below,
  // because hooks cannot run conditionally.
  const offline = useMemo(() => {
    if (!shock || shockSide !== 'after') return undefined;
    const on = new Set(shock.after.allocations.map((a) => a.facilityId));
    const was = new Set(shock.before.allocations.map((a) => a.facilityId));
    const out = new Set<string>();
    for (const id of was) if (!on.has(id)) out.add(id);
    return out;
  }, [shock, shockSide]);

  if (!boot || !state) return <Loading message="Loading…" />;
  if (brief.loading) return <Loading message={brief.message} />;
  if (brief.error) return <ErrorState message={brief.error} onRetry={brief.reload} />;
  if (!b) return null;

  const live = optimization?.result.allocations ?? [];
  const plan: Allocation[] = shock
    ? (shockSide === 'after' ? shock.after : shock.before).allocations
    : live;

  const movingT = plan.reduce((a, x) => a + x.tonnes, 0);

  return (
    <div className="cc">
      <CommandBar
        b={b}
        flows={plan.length}
        movingT={movingT}
        plants={boot.network.facilities.length}
        busy={busy !== null}
        shock={shock}
        shockSide={shockSide}
        onShockSide={setShockSide}
        onClearShock={() => setShock(null)}
        onOptimise={() => setOverlay('optimise')}
        onSimulate={() => setOverlay('simulate')}
        onFollow={() => setOverlay('follow')}
        onTrace={() => setOverlay('why')}
      />

      <div className="cc-stage">
        <LiveNetwork
          sources={boot.network.sources}
          facilities={boot.network.facilities}
          allocations={plan}
          selection={selection}
          onSelect={setSelection}
          busy={busy !== null}
          offlineIds={offline}
        />

        <SignalRail
          b={b}
          result={result}
          onDismiss={() => setResult(null)}
          onTrace={() => setOverlay('why')}
          onExplore={() => navigate('/carbon/opportunities')}
          onSimulate={() => setOverlay('simulate')}
          shock={shock}
        />
      </div>

      {overlay === 'why' && <WhyPanel b={b} onClose={() => setOverlay(null)} />}
      {overlay === 'follow' && <FollowPanel version={version} onClose={() => setOverlay(null)} />}
      {overlay === 'optimise' && (
        <OptimisePanel b={b} busy={busy !== null} onRun={runOptimise} onClose={() => setOverlay(null)} />
      )}
      {overlay === 'simulate' && (
        <SimulatePanel
          b={b}
          onDone={(r) => {
            setShock(r);
            setShockSide('after');
            setSelection(null);
            setOverlay(null);
          }}
          onClose={() => setOverlay(null)}
        />
      )}

      {selection && (
        <SelectionDrawer
          selection={selection}
          sources={boot.network.sources}
          facilities={boot.network.facilities}
          allocations={plan}
          windowDays={b.windowDays}
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The command bar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One line of chrome, then the network.
 *
 * Name, what the network is doing right now in physical units, and four
 * commands. No title block, no description paragraph, no tab strip, no solver
 * telemetry — all of which the previous version spent about 220px of vertical
 * space on before the reader reached anything worth looking at.
 */
function CommandBar({
  b,
  flows,
  movingT,
  plants,
  busy,
  shock,
  shockSide,
  onShockSide,
  onClearShock,
  onOptimise,
  onSimulate,
  onFollow,
  onTrace,
}: {
  b: CarbonBrief;
  flows: number;
  movingT: number;
  plants: number;
  busy: boolean;
  shock: ScenarioResult | null;
  shockSide: 'before' | 'after';
  onShockSide: (s: 'before' | 'after') => void;
  onClearShock: () => void;
  onOptimise: () => void;
  onSimulate: () => void;
  onFollow: () => void;
  onTrace: () => void;
}) {
  return (
    <header className="cc-bar">
      <div className="cc-id">
        <span className="cc-name">Carbon Control</span>
        <span className="cc-live" aria-hidden />
        <span className="cc-status">
          {num(movingT)} t moving · {num(flows)} flows · {num(plants)} plants
        </span>
      </div>

      {shock && (
        <div className="cc-flip" role="group" aria-label="Compare plans">
          <span className="cc-flip-l">{shock.label}</span>
          <button className={shockSide === 'before' ? 'on' : ''} onClick={() => onShockSide('before')}>
            Before
          </button>
          <button className={shockSide === 'after' ? 'on' : ''} onClick={() => onShockSide('after')}>
            After
          </button>
          <button className="cc-flip-x" onClick={onClearShock} title="Return to the live network">
            Return to live
          </button>
        </div>
      )}

      <div className="cc-cmds">
        <button className="cc-cmd primary" onClick={onOptimise} disabled={busy}>
          {busy ? 'Solving…' : 'Optimize'}
        </button>
        <button className="cc-cmd" onClick={onSimulate} disabled={busy}>
          Simulate
        </button>
        <button className="cc-cmd" onClick={onFollow} disabled={busy}>
          Follow
        </button>
        <button className="cc-cmd" onClick={onTrace} disabled={busy}>
          Trace
        </button>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The signal rail
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The position, and the two signals worth acting on, over the network.
 *
 * Deliberately a rail rather than a row of cards under the map. A number sitting
 * on top of the system it measures reads as that system's state; the same number
 * in a box below reads as a report about it.
 */
function SignalRail({
  b,
  result,
  onDismiss,
  onTrace,
  onExplore,
  onSimulate,
  shock,
}: {
  b: CarbonBrief;
  result: { deltaT: number; from: string; to: string } | null;
  onDismiss: () => void;
  onTrace: () => void;
  onExplore: () => void;
  onSimulate: () => void;
  shock: ScenarioResult | null;
}) {
  const p = b.position;
  const t = b.trend;

  return (
    <aside className="cc-rail">
      <section className="cc-pos">
        <div className="cc-k">Net carbon position</div>
        <button className="cc-figure" onClick={onTrace} title="Why this number?">
          <span className="cc-sign">{p.netT >= 0 ? '+' : '−'}</span>
          <CountUp value={Math.abs(p.netT)} />
          <span className="cc-unit">tCO₂e</span>
        </button>
        {t && (
          <div className={`cc-trend ${t.improving ? 'up' : 'down'}`}>
            {t.improving ? '↑' : '↓'} {pct(Math.abs(t.deltaPct), 1)} vs the previous {t.weeks} weeks
          </div>
        )}
        <div className="cc-basis">
          {b.windowDays}-day window · {b.objectiveLabel.toLowerCase()} objective
        </div>

        {result && (
          <div className="cc-result" role="status">
            <span className={`cc-res-d ${result.deltaT >= 0 ? 'pos' : 'neg'}`}>
              {result.deltaT >= 0 ? '+' : '−'}
              {num(Math.abs(result.deltaT))}
            </span>
            <span className="cc-res-t">
              measured, re-solving from {result.from} to {result.to.toLowerCase()}
            </span>
            <button onClick={onDismiss} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        {shock && <ShockReadout shock={shock} />}
      </section>

      {b.action && (
        <button className="cc-sig up" onClick={onExplore}>
          <span className="cc-sig-k">Opportunity</span>
          <span className="cc-sig-v">+{num(b.action.carbonDeltaT)}</span>
          <span className="cc-sig-u">tCO₂e</span>
          <span className="cc-sig-t">{b.action.headline}</span>
          <span className="cc-sig-m">
            {b.action.marginDeltaInr >= 0 ? '+' : '−'}
            {inr(Math.abs(b.action.marginDeltaInr))} margin
          </span>
        </button>
      )}

      {b.risk && (
        <button className="cc-sig risk" onClick={onSimulate}>
          <span className="cc-sig-k">Risk</span>
          <span className="cc-sig-v">−{num(Math.abs(b.risk.carbonDeltaT))}</span>
          <span className="cc-sig-u">tCO₂e</span>
          <span className="cc-sig-t">{b.risk.facilityName} offline</span>
          <span className="cc-sig-m">
            {pct(Math.abs(b.risk.carbonLossPct), 1)} of the network · {b.risk.resilienceGrade}
          </span>
        </button>
      )}

      <Chain b={b} />

      <p className="cc-note">
        Modelled network activity. Material moves on the routes the optimiser allocated it to —
        there is no live telemetry in this product.
      </p>
    </aside>
  );
}


/**
 * What the shock cost, on the ledger basis.
 *
 * NOT . That pair is the
 * optimiser's own running total, which sits on a different permanence basis
 * than the ledger and reports this scenario as −5,816 where the ledger — and
 * the risk card three inches above it — says −7,038. The engine already
 * computed the right figure into `deltas`; this reads it rather than
 * recomputing it.
 */
function ShockReadout({ shock }: { shock: ScenarioResult }) {
  const carbon = shock.deltas.find((d) => d.key === 'netCarbonT');
  const margin = shock.deltas.find((d) => d.key === 'marginInr');
  if (!carbon) return null;
  return (
    <div className="cc-result shock" role="status">
      <span className={`cc-res-d ${carbon.delta >= 0 ? 'pos' : 'neg'}`}>
        {carbon.delta >= 0 ? '+' : '−'}
        {num(Math.abs(carbon.delta))}
      </span>
      <span className="cc-res-t">
        tCO₂e against the live plan
        {margin
          ? `, and ${margin.delta >= 0 ? '+' : '−'}${inr(Math.abs(margin.delta))} of margin`
          : ''}
        . {shock.flowChanges.length} flows moved. The live network is untouched.
      </span>
    </div>
  );
}

/**
 * Material → pathway → carbon, as one band per conversion route.
 *
 * The brief already groups the network this way, so this selects and formats;
 * it does not re-derive anything.
 */
function Chain({ b }: { b: CarbonBrief }) {
  const max = Math.max(...b.flow.map((f) => f.netT), 1);
  return (
    <section className="cc-chain">
      <div className="cc-k">Material → pathway → carbon</div>
      {b.flow.map((f) => (
        <div className="cc-chain-row" key={f.pathway}>
          <span className="cc-chain-n">{f.label}</span>
          <span className="cc-chain-t">{num(f.tonnes)} t</span>
          <span className="cc-chain-track">
            <span className="cc-chain-fill" style={{ width: `${(f.netT / max) * 100}%` }} />
          </span>
          <span className="cc-chain-v">+{num(f.netT)}</span>
        </div>
      ))}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inspection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What one selected thing is worth, without leaving the network.
 *
 * Everything here is read off the allocation set already on screen. The drawer
 * is a lens on the plan, not a second query.
 */
function SelectionDrawer({
  selection,
  sources,
  facilities,
  allocations,
  windowDays,
  onClose,
}: {
  selection: Exclude<LiveSelection, null>;
  sources: WasteSource[];
  facilities: Facility[];
  allocations: Allocation[];
  windowDays: number;
  onClose: () => void;
}) {
  const d = useMemo(() => {
    if (selection.kind === 'facility') {
      const f = facilities.find((x) => x.id === selection.id);
      if (!f) return null;
      const inbound = allocations.filter((a) => a.facilityId === selection.id);
      const t = inbound.reduce((s, a) => s + a.tonnes, 0);
      return {
        title: f.name,
        sub: `${f.district} · ${f.operator}`,
        rows: [
          ['Inbound flows', `${num(inbound.length)} from ${num(new Set(inbound.map((a) => a.sourceId)).size)} sources`],
          ['Material received', `${num(t)} t`],
          ['Nameplate capacity', `${num(f.capacityTpd)} t/day`],
          [
            'Utilisation',
            t > 0 ? pct(Math.min(100, (t / Math.max(1, f.capacityTpd * windowDays)) * 100), 0) : 'idle',
          ],
          ['Pathway', f.pathway.replace(/_/g, ' ')],
        ] as Array<[string, string]>,
        to: '/carbon/facilities',
        cta: 'Open plant carbon',
      };
    }

    if (selection.kind === 'source') {
      const s = sources.find((x) => x.id === selection.id);
      if (!s) return null;
      const out = allocations.filter((a) => a.sourceId === selection.id);
      const t = out.reduce((x, a) => x + a.tonnes, 0);
      return {
        title: s.name,
        sub: `${s.district} · ${s.stream.replace(/_/g, ' ')}`,
        rows: [
          ['Available this window', `${num(s.availableT)} t`],
          ['Placed', out.length ? `${num(t)} t to ${num(out.length)} plant${out.length > 1 ? 's' : ''}` : 'nothing placed'],
          ['Unplaced', `${num(Math.max(0, s.availableT - t))} t`],
          ['Road access', s.access.replace(/_/g, ' ')],
        ] as Array<[string, string]>,
        to: '/carbon/pathways',
        cta: 'Compare its pathways',
      };
    }

    const s = sources.find((x) => x.id === selection.sourceId);
    const f = facilities.find((x) => x.id === selection.facilityId);
    const a = allocations.find(
      (x) => x.sourceId === selection.sourceId && x.facilityId === selection.facilityId,
    );
    if (!a) return null;
    return {
      title: `${s?.name ?? selection.sourceId} → ${f?.name ?? selection.facilityId}`,
      sub: 'One allocation in the plan currently drawn',
      rows: [
        ['Material moved', `${num(a.tonnes)} t`],
        ['Pathway', a.pathway.replace(/_/g, ' ')],
        ['Haul', `${a.distanceKm.toFixed(0)} km`],
        ['Margin', inr(a.marginInr)],
      ] as Array<[string, string]>,
      to: `/carbon/ledger?source=${encodeURIComponent(selection.sourceId)}&facility=${encodeURIComponent(selection.facilityId)}`,
      cta: 'Trace this carbon',
    };
  }, [selection, sources, facilities, allocations, windowDays]);

  if (!d) return null;

  return (
    <Drawer title={d.title} onClose={onClose}>
      <p className="dr-sub">{d.sub}</p>
      <dl className="cc-dl">
        {d.rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="dr-note">
        Material, capacity and geometry are shown here because they are unambiguous. The carbon
        figure is not, because it depends on the permanence basis it is valued under — so it is
        left to the screen that owns it rather than re-derived in this panel.
      </p>
      <Link to={d.to} className="btn primary" onClick={onClose}>
        {d.cta}
      </Link>
    </Drawer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 · What to do
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Choosing an objective, with what each one is already measured to be worth.
 *
 * One trap here, worth naming because I fell in it first. `ObjectiveOutcome`
 * carries four figures and only one of them belongs on this panel:
 *
 *   baselineNetT   the network solved under THIS objective — what you get
 *   scenarioNetT   the same objective's net AFTER the risk shock
 *   carbonDeltaT   scenarioNetT − baselineNetT, i.e. what the shock costs it
 *   marginDeltaInr the same, in rupees
 *
 * The last three are a resilience comparison — how well each objective would
 * survive losing the network's most important plant. Showing carbonDeltaT here
 * would tell the reader that switching to carbon-first LOSES 7,017 tCO₂e, when
 * it actually gains 275. Only baselineNetT answers "what would this objective
 * give me", and the difference against the objective in force is the difference
 * of two baselines.
 *
 * Every baseline is a real solve with its own ledger. Nothing is interpolated.
 */
function OptimisePanel({
  b,
  busy,
  onRun,
  onClose,
}: {
  b: CarbonBrief;
  busy: boolean;
  onRun: (m: ObjectiveMode) => void;
  onClose: () => void;
}) {
  const objectives = b.objectives ?? [];

  /** The objective in force, whose baseline every other row is measured against. */
  const current = useMemo(() => objectives.find((o) => o.isCurrent) ?? null, [objectives]);

  const best = useMemo(
    () =>
      objectives.length
        ? objectives.reduce((a, x) => (x.baselineNetT > a.baselineNetT ? x : a), objectives[0])
        : null,
    [objectives],
  );

  /** Highest carbon first, so the answer to "which one" is the top row. */
  const rows = useMemo(
    () => [...objectives].sort((x, y) => y.baselineNetT - x.baselineNetT),
    [objectives],
  );

  return (
    <Drawer title="Optimize network" onClose={onClose} wide>
      <p className="dr-sub">
        Each objective below was solved against this network and had its own ledger built. Running
        one re-solves the live twin, and the position on the front page moves to the measured
        result.
      </p>

      {rows.length === 0 && (
        <p className="dr-note">
          The objective comparison has not been produced for this network state, so there is
          nothing measured to choose between. Open <Link to="/carbon/scenarios">Scenarios</Link> to
          run one directly.
        </p>
      )}

      <div className="cc-obj">
        {rows.map((o) => {
          const delta = current ? o.baselineNetT - current.baselineNetT : 0;
          return (
            <div className={`cc-obj-row ${o.isCurrent ? 'current' : ''}`} key={o.objective}>
              <div className="cc-obj-name">
                {o.label}
                {o.isCurrent && <span className="cc-obj-tag">in force</span>}
                {best && o.objective === best.objective && !o.isCurrent && (
                  <span className="cc-obj-tag best">most carbon</span>
                )}
              </div>
              <div className="cc-obj-net">
                {num(o.baselineNetT)} <i>tCO₂e</i>
              </div>
              <div className={`cc-obj-d ${delta >= 0 ? 'pos' : 'neg'}`}>
                {o.isCurrent ? '—' : `${delta >= 0 ? '+' : '−'}${num(Math.abs(delta))}`}
              </div>
              <button
                className="cc-btn sm primary"
                disabled={busy || o.isCurrent}
                onClick={() => {
                  onRun(o.objective as ObjectiveMode);
                  onClose();
                }}
              >
                {o.isCurrent ? 'Current' : 'Run'}
              </button>
            </div>
          );
        })}
      </div>

      <p className="dr-note">
        The second column is each objective's own net carbon position; the third is the difference
        against the objective in force. Both come from full optimiser runs. What this panel does
        not show is how each objective would cope with losing a plant — that is a different
        question, answered on <Link to="/carbon/scenarios">Scenarios</Link>.
      </p>
    </Drawer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Simulate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A shock, run for real, returned as two plans.
 *
 * The scenarios offered are the ones the engine already identified as material:
 * the plant whose loss costs the most carbon, and the change with the largest
 * measured upside. Running either calls the same endpoint the Scenarios screen
 * uses, uncommitted — the live twin is never mutated by a simulation here.
 */
function SimulatePanel({
  b,
  onDone,
  onClose,
}: {
  b: CarbonBrief;
  onDone: (r: ScenarioResult) => void;
  onClose: () => void;
}) {
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choices = useMemo(() => {
    const out: Array<{ id: string; title: string; sub: string; expect: string; scenario: unknown }> = [];
    if (b.risk) {
      out.push({
        id: 'risk',
        title: `${b.risk.facilityName} goes offline`,
        sub: 'The plant whose loss costs the most carbon',
        expect: `−${num(Math.abs(b.risk.carbonDeltaT))} tCO₂e expected`,
        scenario: b.risk.scenario,
      });
    }
    if (b.action) {
      out.push({
        id: 'action',
        title: b.action.headline,
        sub: 'The largest measured upside available',
        expect: `+${num(b.action.carbonDeltaT)} tCO₂e expected`,
        scenario: b.action.scenario,
      });
    }
    return out;
  }, [b]);

  const run = useCallback(
    async (id: string, scenario: unknown) => {
      setError(null);
      setRunning(id);
      try {
        // commit: false — a simulation must never mutate the live twin.
        const res = await api.scenario(scenario as never, false);
        onDone(res.result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'The scenario could not be run.');
        setRunning(null);
      }
    },
    [onDone],
  );

  return (
    <Drawer title="Simulate shock" onClose={onClose} wide>
      <p className="dr-sub">
        Each of these is a real change applied to a clone of the network and re-optimised. The map
        then holds both plans so the reroute can be seen. The live network is not touched.
      </p>

      <div className="cc-sim">
        {choices.map((c) => (
          <div className="cc-sim-row" key={c.id}>
            <div>
              <div className="cc-sim-title">{c.title}</div>
              <div className="cc-sim-sub">{c.sub}</div>
            </div>
            <div className="cc-sim-exp">{c.expect}</div>
            <button
              className="cc-btn sm primary"
              disabled={running !== null}
              onClick={() => run(c.id, c.scenario)}
            >
              {running === c.id ? 'Solving…' : 'Run'}
            </button>
          </div>
        ))}
      </div>

      {error && <p className="dr-note err">{error}</p>}

      <p className="dr-note">
        For the full scenario library — capacity cuts, supply surges, fuel price moves, logistics
        disruption — open <Link to="/carbon/scenarios">Scenarios</Link>.
      </p>
    </Drawer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Kept from the previous Control Center: the decomposition, the tonne walk, and
// the drawer they both live in.
// ─────────────────────────────────────────────────────────────────────────────

function WhyPanel({ b, onClose }: { b: CarbonBrief; onClose: () => void }) {
  const p = b.position;
  const rows = [
    { k: 'Durable removal', v: p.removalT, op: '+' },
    { k: 'Avoided disposal', v: p.avoidedT, op: '+' },
    { k: 'Fossil displacement', v: p.substitutionT, op: '+' },
    { k: 'Transport emissions', v: -p.transportT, op: '−' },
    { k: 'Processing emissions', v: -p.processT, op: '−' },
  ].filter((r) => Math.abs(r.v) > 1e-6);
  const max = Math.max(...rows.map((r) => Math.abs(r.v)), 1);

  return (
    <Drawer title="Why this number?" onClose={onClose}>
      <p className="dr-lead">
        The position is the sum of five terms. Removal, avoidance and displacement are kept apart —
        they are different commodities and this product never adds them into one figure.
      </p>
      <div className="dr-decomp">
        {rows.map((r) => (
          <div key={r.k} className="drd-row">
            <span className="drd-op">{r.op}</span>
            <span className="drd-label">{r.k}</span>
            <span className="drd-track">
              <span
                className={`drd-fill ${r.v >= 0 ? 'pos' : 'neg'}`}
                style={{ width: `${(Math.abs(r.v) / max) * 100}%` }}
              />
            </span>
            <span className={`drd-val mono ${r.v >= 0 ? 'pos' : 'neg'}`}>{num(Math.abs(r.v))}</span>
          </div>
        ))}
        <div className="drd-row drd-net">
          <span className="drd-op">=</span>
          <span className="drd-label">Net carbon</span>
          <span className="drd-track" />
          <span className="drd-val mono">{num(p.netT)}</span>
        </div>
      </div>
      {p.uncertainty && (
        <p className="dr-note">
          <span className="mono">
            {num(p.uncertainty.p5)}–{num(p.uncertainty.p95)}
          </span>{' '}
          across {num(p.uncertainty.draws)} Monte Carlo draws over every emission factor at once.
        </p>
      )}
      <div className="dr-cta">
        <Link to="/carbon/ledger" className="btn sm primary">
          Open the Ledger
        </Link>
        <Link to="/carbon/evidence" className="btn sm">
          Inspect evidence
        </Link>
      </div>
      <div className="dr-foot">
        <span className="q-tag">Modelled estimate</span>
        Not measured, not verified, and not a carbon credit.
      </div>
    </Drawer>
  );
}

/**
 * Follow a tonne: pick a real allocation, watch it become carbon.
 *
 * Reuses the Ledger's trace endpoint verbatim; the stages, figures and wording
 * are the engine's. The drawer is a shortcut into that experience, not a copy.
 */
function FollowPanel({ version, onClose }: { version: number; onClose: () => void }) {
  const cands = useResource(() => api.traceCandidates(), [version], ['Ranking contributions…']);
  const [picked, setPicked] = useState<TraceCandidate | null>(null);
  const [trace, setTrace] = useState<AllocationTrace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearInterval(timer.current);
    if (!trace) {
      setRevealed(0);
      return;
    }
    setRevealed(0);
    const total = trace.stages.length;
    timer.current = window.setInterval(() => {
      setRevealed((r) => {
        if (r >= total) {
          if (timer.current) window.clearInterval(timer.current);
          return r;
        }
        return r + 1;
      });
    }, 230);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [trace]);

  const pick = async (c: TraceCandidate) => {
    setPicked(c);
    setTrace(null);
    setError(null);
    try {
      setTrace(await api.trace(c.sourceId, c.facilityId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That contribution could not be traced.');
    }
  };

  const running = trace
    ? trace.stages.slice(0, revealed).reduce((a, s) => a + (s.carbonT ?? 0), 0)
    : 0;

  return (
    <Drawer title="Follow a tonne" onClose={onClose} wide>
      {!picked && (
        <>
          <p className="dr-lead">
            Pick a consignment in the current plan. It will be followed through collection,
            haulage, the receiving plant and conversion, with the carbon booked at the stage that
            physically causes it.
          </p>
          {cands.loading && <p className="muted">{cands.message}</p>}
          <div className="dr-cands">
            {(cands.data ?? []).slice(0, 8).map((c) => (
              <button key={c.key} className="drc-item" onClick={() => pick(c)}>
                <span className="drc-src">{c.sourceName}</span>
                <span className="drc-sub">
                  {c.streamLabel} → {c.facilityName}
                </span>
                <span className="drc-t mono">{num(c.tonnes)} t</span>
                <span className="drc-c mono pos">{num(c.netCarbonT)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {picked && (
        <>
          <div className="dr-tracehead">
            <div>
              <div className="drt-title">
                {num(picked.tonnes)} t {picked.streamLabel.toLowerCase()}
              </div>
              <div className="drt-sub">
                {picked.sourceName} → {picked.facilityName} · {picked.pathwayLabel}
              </div>
            </div>
            <div className="drt-run">
              <span className="drt-runlabel">Running total</span>
              <span className={`drt-runval mono ${running >= 0 ? 'pos' : 'neg'}`}>
                {running >= 0 ? '+' : '−'}
                {num(Math.abs(running))}
              </span>
            </div>
          </div>

          {error && <p className="neg">{error}</p>}
          {!error && !trace && <p className="muted">Tracing…</p>}

          {trace && (
            <>
              <ol className="dr-stages">
                {trace.stages.map((s, i) => (
                  <li
                    key={s.key}
                    className={`drs ${i < revealed ? 'on' : ''} ${s.kind ? `k-${s.kind}` : ''}`}
                  >
                    <span className="drs-rail" aria-hidden>
                      <span className="drs-dot" />
                    </span>
                    <span className="drs-body">
                      <span className="drs-label">{s.label}</span>
                      <span className="drs-head">{s.headline}</span>
                      <span className="drs-detail">{s.detail}</span>
                    </span>
                    <span className="drs-c">
                      {s.carbonT === null ? (
                        <span className="drs-none">—</span>
                      ) : (
                        <span className={`mono ${s.carbonT >= 0 ? 'pos' : 'neg'}`}>
                          {s.carbonT >= 0 ? '+' : '−'}
                          {num(Math.abs(s.carbonT))}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="dr-note">{trace.why}</p>
              <div className="dr-cta">
                <Link
                  to={`/carbon/ledger?source=${encodeURIComponent(picked.sourceId)}&facility=${encodeURIComponent(picked.facilityId)}`}
                  className="btn sm primary"
                >
                  Open full trace
                </Link>
                <button className="btn sm" onClick={() => setPicked(null)}>
                  Follow another
                </button>
              </div>
            </>
          )}
        </>
      )}
    </Drawer>
  );
}
