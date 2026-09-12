/**
 * Carbon Control Center.
 *
 * One surface, four moves, and a network you can actually touch.
 *
 * The screen this replaced was not wrong, it was crowded: a masthead, a status
 * list, a position block, a map, a decision pair, an event pulse — six competing
 * levels before the reader had decided anything. This version keeps one dominant
 * idea per band, in the order the job is done:
 *
 *   1. WHERE WE STAND    the number, its direction, and what you can do
 *   2. WHERE IT HAPPENS  the network, given the space it deserves
 *   3. WHAT TO DO        exactly one upside and exactly one risk
 *   4. HOW IT ADDS UP    one flow, from material to net
 *
 * Four actions, and every one is real:
 *
 *   OPTIMIZE NETWORK   re-solves the live twin under a different objective and
 *                      reports the measured difference between two ledgers.
 *   SIMULATE SHOCK     runs a real ScenarioInstance and holds the before and
 *                      after plans so the map can show the network move.
 *   FOLLOW A TONNE     walks one real allocation from field to ledger line.
 *   WHY THIS NUMBER    opens the decomposition, which opens the Ledger, which
 *                      opens Evidence.
 *
 * Rules this file keeps:
 *
 *  - Nothing is computed here. Every figure comes from /api/brief, the optimiser
 *    result, or a scenario run. The map draws the real allocation set. If a
 *    number cannot be traced to the engine it does not appear.
 *  - No fabricated liveness. Arcs animate because material is allocated along
 *    them in the current plan, and the network only changes when the optimiser
 *    actually produced a different one. There is no invented telemetry, no
 *    synthetic clock, no fake vehicle moving down a road.
 *  - Selection opens a drawer, not a page. Losing the network to look at one
 *    plant is how the old flow lost people.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, useResource, useTwin } from '../store.tsx';
import { CountUp, ErrorState, Loading } from '../components/Primitives.tsx';
import { NetworkMap, type Selection } from '../components/NetworkMap.tsx';
import { Drawer } from '../components/Drawer.tsx';
import { Link, useRouter } from '../router.tsx';
import { dateFull, inr, num, pct, timeShort } from '../format.ts';
import type { AllocationTrace, TraceCandidate } from '../../../engine/src/trace.ts';
import type { CarbonBrief } from '../../../engine/src/brief.ts';
import type {
  Allocation,
  ObjectiveMode,
  ScenarioResult,
} from '../../../engine/src/types.ts';
import '../styles/carbon-command.css';

type Overlay = null | 'why' | 'follow' | 'optimise' | 'simulate';

/** Which plan the map is drawing: the live one, or a scenario's before/after. */
type MapPlan = { label: string; allocations: Allocation[] } | null;

export default function CarbonCommand() {
  const { boot, state, optimization, version, setObjective, busy } = useTwin();
  const { navigate } = useRouter();

  const brief = useResource(() => api.brief(), [version], [
    'Reading the carbon position…',
    'Collecting opportunities and contingencies…',
  ]);

  const [overlay, setOverlay] = useState<Overlay>(null);
  const [selection, setSelection] = useState<Selection>(null);

  /** A completed shock, kept so the map can be flipped between its two plans. */
  const [shock, setShock] = useState<ScenarioResult | null>(null);
  const [shockSide, setShockSide] = useState<'before' | 'after'>('after');

  /** Before/after of a live re-optimisation. */
  const [pending, setPending] = useState<{ beforeT: number; beforeObjective: string } | null>(null);
  const [optimiseResult, setOptimiseResult] = useState<{
    deltaT: number;
    fromLabel: string;
    toLabel: string;
  } | null>(null);

  const b = brief.data;

  // When the twin re-solves under a new objective, report the difference between
  // the two positions. Both figures are real ledger reads, a solve apart.
  useEffect(() => {
    if (!pending || !b) return;
    if (b.objective === pending.beforeObjective) return;
    setOptimiseResult({
      deltaT: b.position.netT - pending.beforeT,
      fromLabel: pending.beforeObjective.replace(/_/g, ' '),
      toLabel: b.objectiveLabel,
    });
    setPending(null);
  }, [b, pending]);

  const runOptimise = useCallback(
    async (mode: ObjectiveMode) => {
      if (!b || b.objective === mode) return;
      setOptimiseResult(null);
      setShock(null);
      setPending({ beforeT: b.position.netT, beforeObjective: b.objective });
      await setObjective(mode);
    },
    [b, setObjective],
  );

  if (!boot || !state) return <Loading message="Loading…" />;
  if (brief.loading) return <Loading message={brief.message} />;
  if (brief.error) return <ErrorState message={brief.error} onRetry={brief.reload} />;
  if (!b) return null;

  const livePlan = optimization?.result.allocations ?? [];
  const plan: MapPlan = shock
    ? {
        label:
          shockSide === 'after'
            ? `${shock.label} — after`
            : `${shock.label} — before`,
        allocations: (shockSide === 'after' ? shock.after : shock.before).allocations,
      }
    : null;

  return (
    <div className="cc">
      <Hero
        b={b}
        busy={busy !== null}
        result={optimiseResult}
        onDismiss={() => setOptimiseResult(null)}
        onWhy={() => setOverlay('why')}
        onOptimise={() => setOverlay('optimise')}
        onSimulate={() => setOverlay('simulate')}
        onFollow={() => setOverlay('follow')}
      />

      <NetworkStage
        b={b}
        sources={boot.network.sources}
        facilities={boot.network.facilities}
        live={livePlan}
        plan={plan}
        shock={shock}
        shockSide={shockSide}
        onShockSide={setShockSide}
        onClearShock={() => setShock(null)}
        selection={selection}
        onSelect={setSelection}
      />

      <Decisions
        b={b}
        onExplore={() => navigate('/carbon/opportunities')}
        onSimulateRisk={() => setOverlay('simulate')}
      />

      <CarbonFlow b={b} onWhy={() => setOverlay('why')} />

      {overlay === 'why' && <WhyPanel b={b} onClose={() => setOverlay(null)} />}
      {overlay === 'follow' && <FollowPanel version={version} onClose={() => setOverlay(null)} />}
      {overlay === 'optimise' && (
        <OptimisePanel
          b={b}
          busy={busy !== null}
          onRun={runOptimise}
          onClose={() => setOverlay(null)}
        />
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
          allocations={plan ? plan.allocations : livePlan}
          windowDays={b.windowDays}
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 · Where we stand
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The number, its direction, and the four things you can do about it.
 *
 * Deliberately not a KPI strip. There is one figure here at display size and
 * everything else is either its context or an action — a row of five equal
 * cards is what you build when you have not decided what matters.
 */
function Hero({
  b,
  busy,
  result,
  onDismiss,
  onWhy,
  onOptimise,
  onSimulate,
  onFollow,
}: {
  b: CarbonBrief;
  busy: boolean;
  result: { deltaT: number; fromLabel: string; toLabel: string } | null;
  onDismiss: () => void;
  onWhy: () => void;
  onOptimise: () => void;
  onSimulate: () => void;
  onFollow: () => void;
}) {
  const p = b.position;
  const t = b.trend;

  return (
    <section className="cc-hero">
      <div className="cc-hero-fig">
        <div className="cc-k">Net carbon impact</div>
        <div className="cc-big">
          <span className="cc-sign">{p.netT >= 0 ? '+' : '−'}</span>
          <CountUp value={Math.abs(p.netT)} />
          <span className="cc-unit">tCO₂e</span>
        </div>
        <p className="cc-ctx">
          Current network position across the {b.windowDays}-day planning window, on the{' '}
          {b.objectiveLabel.toLowerCase()} objective.
        </p>

        {t && (
          <div className={`cc-trend ${t.improving ? 'up' : 'down'}`}>
            <span className="cc-arrow" aria-hidden>
              {t.improving ? '↑' : '↓'}
            </span>
            {pct(Math.abs(t.deltaPct), 1)} against the previous {t.weeks}-week period
          </div>
        )}

        <button className="cc-why" onClick={onWhy}>
          Why this number?
        </button>

        {result && (
          <div className="cc-result" role="status">
            <span className={`cc-res-delta ${result.deltaT >= 0 ? 'pos' : 'neg'}`}>
              {result.deltaT >= 0 ? '+' : '−'}
              {num(Math.abs(result.deltaT))} tCO₂e
            </span>
            <span className="cc-res-txt">
              measured after re-solving from {result.fromLabel} to{' '}
              {result.toLabel.toLowerCase()}
            </span>
            <button className="cc-res-x" onClick={onDismiss} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}
      </div>

      <div className="cc-hero-act">
        <button className="cc-btn primary" onClick={onOptimise} disabled={busy}>
          <span className="cc-btn-l">Optimize network</span>
          <span className="cc-btn-s">Re-solve under a different objective</span>
        </button>
        <button className="cc-btn" onClick={onSimulate} disabled={busy}>
          <span className="cc-btn-l">Simulate shock</span>
          <span className="cc-btn-s">Take something away and watch it reroute</span>
        </button>
        <button className="cc-btn" onClick={onFollow} disabled={busy}>
          <span className="cc-btn-l">Follow a tonne</span>
          <span className="cc-btn-s">One consignment, field to ledger line</span>
        </button>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 · Where it happens
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The network, given the space it deserves.
 *
 * This is the only element on the page allowed to be large, because it is the
 * only one that answers "where" — and "where" is most of a carbon manager's
 * job. After a shock it holds both plans and flips between them, which is the
 * whole point: you see the same region rerouted rather than two tables.
 */
function NetworkStage({
  b,
  sources,
  facilities,
  live,
  plan,
  shock,
  shockSide,
  onShockSide,
  onClearShock,
  selection,
  onSelect,
}: {
  b: CarbonBrief;
  sources: NonNullable<ReturnType<typeof useTwin>['boot']>['network']['sources'];
  facilities: NonNullable<ReturnType<typeof useTwin>['boot']>['network']['facilities'];
  live: Allocation[];
  plan: MapPlan;
  shock: ScenarioResult | null;
  shockSide: 'before' | 'after';
  onShockSide: (s: 'before' | 'after') => void;
  onClearShock: () => void;
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const allocations = plan ? plan.allocations : live;
  const movingT = allocations.reduce((a, x) => a + x.tonnes, 0);

  return (
    <section className="cc-net">
      <div className="cc-net-bar">
        <span className="cc-net-title">{plan ? plan.label : 'Live carbon network'}</span>
        <span className="cc-net-sub">
          {num(sources.length)} sources · {num(facilities.length)} plants ·{' '}
          {num(allocations.length)} flows · {num(movingT)} t moving
        </span>

        {shock ? (
          <div className="cc-flip" role="group" aria-label="Compare plans">
            <button
              className={shockSide === 'before' ? 'on' : ''}
              onClick={() => onShockSide('before')}
            >
              Before
            </button>
            <button
              className={shockSide === 'after' ? 'on' : ''}
              onClick={() => onShockSide('after')}
            >
              After
            </button>
            <button className="cc-flip-x" onClick={onClearShock} title="Return to the live plan">
              ×
            </button>
          </div>
        ) : (
          <Link to="/carbon/facilities" className="cc-net-link">
            Open network
          </Link>
        )}
      </div>

      <div className={`cc-canvas ${selection ? 'focused' : ''}`}>
        <NetworkMap
          sources={sources}
          facilities={facilities}
          allocations={allocations}
          selection={selection}
          onSelect={onSelect}
          showLegend={false}
          showLabels
        />
      </div>

      <div className="cc-net-foot">
        {shock ? (
          <span className="cc-net-hint">
            {shock.flowChanges.length} flows moved and {shock.affectedEntityIds.length}{' '}
            {shock.affectedEntityIds.length === 1 ? 'entity' : 'entities'} changed between these two
            plans. Both are real optimiser runs — switch above to see the same region before and
            after.
          </span>
        ) : (
          <span className="cc-net-hint">
            Select a plant, a source or a flow for its carbon detail. Arcs carry the material
            allocated in the plan currently in force — they redraw whenever the optimiser produces
            a different one.
          </span>
        )}
      </div>
    </section>
  );
}

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
  selection: NonNullable<Selection>;
  sources: NonNullable<ReturnType<typeof useTwin>['boot']>['network']['sources'];
  facilities: NonNullable<ReturnType<typeof useTwin>['boot']>['network']['facilities'];
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
 * Exactly one upside and exactly one risk.
 *
 * The Opportunities screen ranks thirteen findings and the resilience report
 * ranks eighteen plants. Neither belongs here. A control centre that shows
 * twenty options has not made a decision about what matters, and neither will
 * the reader.
 */
function Decisions({
  b,
  onExplore,
  onSimulateRisk,
}: {
  b: CarbonBrief;
  onExplore: () => void;
  onSimulateRisk: () => void;
}) {
  const a = b.action;
  const r = b.risk;
  if (!a && !r) return null;

  return (
    <section className="cc-dec">
      {a && (
        <article className="cc-card up">
          <div className="cc-card-k">What should we do next?</div>
          <h3>{a.headline}</h3>
          <div className="cc-card-figs">
            <span className="cc-card-fig pos">
              +{num(a.carbonDeltaT)} <i>tCO₂e</i>
            </span>
            {a.marginDeltaInr !== 0 && (
              <span className={`cc-card-fig ${a.marginDeltaInr >= 0 ? 'pos' : 'neg'}`}>
                {a.marginDeltaInr >= 0 ? '+' : '−'}
                {inr(Math.abs(a.marginDeltaInr))}
              </span>
            )}
          </div>
          <p>{a.why}</p>
          <p className="cc-card-note">{a.whyNotAlready}</p>
          <button className="cc-btn sm primary" onClick={onExplore}>
            Explore opportunity
          </button>
        </article>
      )}

      {r && (
        <article className="cc-card risk">
          <div className="cc-card-k">Biggest network risk</div>
          <h3>{r.facilityName}</h3>
          <div className="cc-card-figs">
            <span className="cc-card-fig neg">
              −{num(Math.abs(r.carbonDeltaT))} <i>tCO₂e</i>
            </span>
            <span className="cc-card-fig muted">
              {pct(Math.abs(r.carbonLossPct), 1)} of the network
            </span>
          </div>
          <p>{r.why}</p>
          <p className="cc-card-note">
            Resilience {r.resilienceGrade} · {r.flowsChanged} flows would move ·{' '}
            {num(Math.abs(r.strandedDeltaT))} t would strand.
          </p>
          <button className="cc-btn sm" onClick={onSimulateRisk}>
            Simulate this
          </button>
        </article>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 · How it adds up
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One flow, from material to net. Not six charts.
 *
 * Each band is proportional to its own magnitude, and the three that add and
 * the two that subtract are coloured accordingly — so the shape of the bar is
 * the argument. Removal, avoidance and substitution stay on separate bands
 * because they are different commodities and this product never sums them into
 * one flattering figure.
 */
function CarbonFlow({ b, onWhy }: { b: CarbonBrief; onWhy: () => void }) {
  const p = b.position;

  const bands = [
    { k: 'Durable removal', v: p.removalT, sign: 1, note: 'Carbon held in solid form, after the permanence adjustment.' },
    { k: 'Avoided emissions', v: p.avoidedT, sign: 1, note: 'What the counterfactual fate would have released. Not a removal.' },
    { k: 'Fossil substitution', v: p.substitutionT, sign: 1, note: 'Fossil energy and synthetic nitrogen the products displaced.' },
    { k: 'Transport', v: p.transportT, sign: -1, note: 'Diesel burned hauling material to the plants.' },
    { k: 'Processing', v: p.processT, sign: -1, note: 'Energy the conversion itself consumed.' },
  ].filter((x) => Math.abs(x.v) > 0.5);

  const max = Math.max(...bands.map((x) => Math.abs(x.v)), 1);

  return (
    <section className="cc-flow">
      <div className="cc-flow-head">
        <span className="cc-k">How the number is built</span>
        <button className="cc-why sm" onClick={onWhy}>
          Open the full decomposition
        </button>
      </div>

      <div className="cc-bands">
        {bands.map((x) => (
          <div className="cc-band" key={x.k}>
            <span className="cc-band-k">{x.k}</span>
            <span className="cc-band-track">
              <span
                className={`cc-band-fill ${x.sign > 0 ? 'add' : 'sub'}`}
                style={{ width: `${(Math.abs(x.v) / max) * 100}%` }}
              />
            </span>
            <span className={`cc-band-v ${x.sign > 0 ? 'add' : 'sub'}`}>
              {x.sign > 0 ? '+' : '−'}
              {num(Math.abs(x.v))}
            </span>
            <span className="cc-band-n">{x.note}</span>
          </div>
        ))}

        <div className="cc-band net">
          <span className="cc-band-k">Net</span>
          <span className="cc-band-track" />
          <span className="cc-band-v">
            {p.netT >= 0 ? '+' : '−'}
            {num(Math.abs(p.netT))}
          </span>
          <span className="cc-band-n">
            {num(p.divertedT)} t placed of {num(p.suppliedT)} t offered ·{' '}
            {p.perTonneT.toFixed(3)} tCO₂e per tonne
          </span>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Optimise
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
