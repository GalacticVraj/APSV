/**
 * Carbon Pathways — a decision instrument.
 *
 * The page answers one question and refuses the adjacent easier one. It does not
 * describe five waste-treatment technologies; it says: given THIS material at THIS
 * source, under the network as it stands, which feasible pathway produces the best
 * carbon outcome, and what is being given up by choosing it.
 *
 * Hierarchy, in the order a decision actually gets made:
 *
 *   Material      what am I deciding for, and how much of it
 *   Ranking       which pathway wins on carbon, and by how much
 *   Why           the component that actually separates first from second
 *   Flip          pick another and watch the network consequence change
 *   Breakdown     removal, avoidance and substitution kept apart
 *   Trade-off     where the carbon choice and the economic choice diverge
 *
 * Infeasible pathways are shown, never hidden, with the gate that excluded them —
 * "no result" and "excluded because moisture is 13% against a 55–95% window" are
 * different answers, and only one of them is useful.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, useResource, useTwin } from '../store.tsx';
import { ErrorState, Loading, Panel, SectionHead } from '../components/Primitives.tsx';
import { Link } from '../router.tsx';
import { inr, num, pct } from '../format.ts';
import type {
  MaterialCandidate,
  PathwayDecision,
  PathwayDiff,
  PathwayOption,
} from '../../../engine/src/pathwaychoice.ts';
import type { ObjectiveMode, PathwayId } from '../../../engine/src/types.ts';

const LENSES: Array<{ id: ObjectiveMode; label: string; note: string }> = [
  { id: 'carbon_first', label: 'Carbon', note: 'Rank by net tCO₂e per tonne' },
  { id: 'balanced', label: 'Balanced', note: 'Carbon and margin weighted equally' },
  { id: 'profit_first', label: 'Economic', note: 'Rank by operating margin per tonne' },
  { id: 'logistics_first', label: 'Logistics', note: 'Carbon earned per kilometre hauled' },
];

export default function CarbonPathways() {
  const { boot, state, version } = useTwin();
  const materials = useResource(() => api.materials(), [version], ['Reading material context…']);

  const [sourceId, setSourceId] = useState<string | null>(null);
  const [lens, setLens] = useState<ObjectiveMode>('carbon_first');
  const [picked, setPicked] = useState<PathwayId | null>(null);
  const [diff, setDiff] = useState<PathwayDiff | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);

  // The largest available material is the default context, so the page opens on a
  // real decision rather than an empty selector.
  const activeSource = sourceId ?? materials.data?.[0]?.id ?? null;

  const decision = useResource(
    () =>
      activeSource
        ? api.pathwayDecision(activeSource, lens)
        : Promise.resolve(null as unknown as PathwayDecision),
    [version, activeSource, lens],
    ['Generating arcs and evaluating every pathway…'],
  );

  // Changing the material or the lens invalidates any flip in progress.
  useEffect(() => {
    setPicked(null);
    setDiff(null);
    setDiffError(null);
  }, [activeSource, lens]);

  const d = decision.data;
  const leader = d?.lensBest ?? d?.carbonBest ?? null;
  const current = picked ?? leader;

  const flip = useCallback(
    async (to: PathwayId) => {
      setPicked(to);
      setDiff(null);
      setDiffError(null);
      if (!activeSource || !leader || to === leader) return;
      try {
        setDiff(await api.pathwayDiff(activeSource, lens, leader, to));
      } catch (e) {
        setDiffError(e instanceof Error ? e.message : 'Those pathways could not be compared.');
      }
    },
    [activeSource, lens, leader],
  );

  if (!boot || !state) return <Loading message="Loading…" />;
  if (materials.loading) return <Loading message={materials.message} />;
  if (materials.error) return <ErrorState message={materials.error} onRetry={materials.reload} />;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Carbon Pathways</h1>
          <div className="lede">
            For one consignment of material, every conversion route the network can actually offer
            it — ranked on carbon, with the gate that excluded the rest and the margin given up by
            choosing the carbon winner.
          </div>
        </div>
      </div>

      <MaterialBar
        materials={materials.data ?? []}
        activeSource={activeSource}
        onSelect={setSourceId}
        decision={d}
        lens={lens}
        setLens={setLens}
      />

      {decision.loading && (
        <div className="section">
          <Panel>
            <div className="loadstate">
              <div className="msg">{decision.message}</div>
            </div>
          </Panel>
        </div>
      )}
      {decision.error && (
        <div className="section">
          <ErrorState message={decision.error} onRetry={decision.reload} />
        </div>
      )}

      {d && !decision.loading && (
        <>
          <Ranking
            decision={d}
            current={current}
            leader={leader}
            onPick={flip}
          />

          {d.resolvedCount > 0 && (
            <WhyAndTradeoff decision={d} diff={diff} diffError={diffError} picked={picked} leader={leader} />
          )}

          {current && <Consequence decision={d} pathway={current} />}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Material context
// ─────────────────────────────────────────────────────────────────────────────

function MaterialBar({
  materials,
  activeSource,
  onSelect,
  decision,
  lens,
  setLens,
}: {
  materials: MaterialCandidate[];
  activeSource: string | null;
  onSelect: (id: string) => void;
  decision: PathwayDecision | null;
  lens: ObjectiveMode;
  setLens: (l: ObjectiveMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = materials.find((m) => m.id === activeSource) ?? null;
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className="section">
      <div className="matbar">
        <div className="mat-pick" ref={boxRef}>
          <div className="mat-label">Material</div>
          <button className="mat-button" onClick={() => setOpen(!open)} aria-expanded={open}>
            <span className="mat-name">{active ? active.name : 'Select material'}</span>
            <span className="mat-meta">
              {active ? `${active.streamLabel} · ${active.district}` : 'No source selected'}
            </span>
            <span className="mat-caret">{open ? '▴' : '▾'}</span>
          </button>
          {open && (
            <div className="mat-menu">
              {materials.map((m) => (
                <button
                  key={m.id}
                  className={`mat-opt ${m.id === activeSource ? 'sel' : ''}`}
                  onClick={() => {
                    onSelect(m.id);
                    setOpen(false);
                  }}
                >
                  <span className="mo-name">{m.name}</span>
                  <span className="mo-sub">
                    {m.streamLabel} · {m.district}
                  </span>
                  <span className="mo-t mono">{num(m.availableT)} t</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mat-qty">
          <div className="mat-label">Available</div>
          <div className="mat-qty-value mono">
            {decision ? num(decision.availableT) : '—'}
            <span className="mat-unit">t</span>
          </div>
        </div>

        <div className="mat-feas">
          <div className="mat-label">Feasible pathways</div>
          <div className="mat-feas-value">
            {decision ? (
              <>
                <strong>{decision.resolvedCount}</strong> of 5 usable
                {decision.feasibleCount > decision.resolvedCount && (
                  <span className="muted">
                    {' '}
                    · {decision.feasibleCount - decision.resolvedCount} gated but unreachable
                  </span>
                )}
              </>
            ) : (
              '—'
            )}
          </div>
        </div>

        <div className="mat-lens">
          <div className="mat-label">Rank by</div>
          <div className="lensrow">
            {LENSES.map((l) => (
              <button
                key={l.id}
                className={`lensbtn ${lens === l.id ? 'on' : ''}`}
                onClick={() => setLens(l.id)}
                title={l.note}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ranking
// ─────────────────────────────────────────────────────────────────────────────

function Ranking({
  decision,
  current,
  leader,
  onPick,
}: {
  decision: PathwayDecision;
  current: PathwayId | null;
  leader: PathwayId | null;
  onPick: (p: PathwayId) => void;
}) {
  const resolved = decision.options.filter((o) => o.perT);
  const blocked = decision.options.filter((o) => !o.perT);
  const maxAbs = Math.max(...resolved.map((o) => Math.abs(o.perT!.net)), 0.001);

  if (resolved.length === 0) {
    return (
      <div className="section">
        <SectionHead title="Net carbon by pathway" />
        <Panel>
          <div className="empty">
            <h4>No pathway can take this material</h4>
            <p>
              Every conversion route is either excluded by a feedstock gate or has no reachable
              plant. The reasons are listed below — nothing is being withheld, and no substitute
              figure has been invented in place of a result.
            </p>
          </div>
        </Panel>
        <BlockedList options={blocked} />
      </div>
    );
  }

  return (
    <div className="section">
      <SectionHead
        title="Net carbon by pathway"
        note="Select a pathway to see what it does to the network"
      />
      <Panel flush>
        <div className="rank">
          {resolved.map((o) => {
            const on = current === o.pathway;
            const isLeader = leader === o.pathway;
            const isEcon = decision.economicBest === o.pathway;
            const net = o.perT!.net;
            return (
              <button
                key={o.pathway}
                className={`rank-row ${on ? 'on' : ''} ${current && !on ? 'off' : ''}`}
                onClick={() => onPick(o.pathway)}
              >
                <span className="rk-name">
                  <span className="rk-title">{o.short}</span>
                  <span className="rk-tags">
                    {isLeader && <span className="rk-tag best">carbon best</span>}
                    {isEcon && <span className="rk-tag econ">economic best</span>}
                    {o.inPlanT > 0 && (
                      <span className="rk-tag plan">{num(o.inPlanT)} t in plan</span>
                    )}
                  </span>
                  <span className="rk-fac">
                    {o.facility!.name} · {num(o.route!.roadKm)} km
                  </span>
                </span>

                <span className="rk-bar">
                  <Composition option={o} scale={maxAbs} />
                </span>

                <span className="rk-net">
                  <span className={`rk-num mono ${net >= 0 ? 'pos' : 'neg'}`}>
                    {net >= 0 ? '+' : '−'}
                    {num(Math.abs(net), 2)}
                  </span>
                  <span className="rk-unit">tCO₂e/t</span>
                  <span className="rk-total mono">
                    {num(net * decision.availableT)} tCO₂e total
                  </span>
                </span>

                <span className="rk-econ">
                  <span className="rk-e-val mono">{inr(o.econ!.marginPerT)}/t</span>
                  <span className="rk-e-sub">{inr(o.econ!.marginTotal)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      {current && <Breakdown option={resolved.find((o) => o.pathway === current) ?? null} availableT={decision.availableT} />}

      {blocked.length > 0 && <BlockedList options={blocked} />}
    </div>
  );
}

/**
 * The stacked composition bar.
 *
 * Removal, avoidance and substitution are drawn as separate segments and never
 * merged — they are different commodities, and a single "benefit" block would hide
 * the one distinction this product works hardest to preserve.
 */
function Composition({ option, scale }: { option: PathwayOption; scale: number }) {
  const p = option.perT!;
  const seg = (v: number) => `${(Math.abs(v) / scale) * 50}%`;
  return (
    <span className="comp">
      <span className="comp-pos">
        {p.durable > 0 && (
          <span className="cseg removal" style={{ width: seg(p.durable) }} title={`Durable removal ${p.durable.toFixed(3)} tCO₂e/t`} />
        )}
        {p.avoided > 0 && (
          <span className="cseg avoided" style={{ width: seg(p.avoided) }} title={`Avoided disposal ${p.avoided.toFixed(3)} tCO₂e/t`} />
        )}
        {p.substitution > 0 && (
          <span className="cseg substitution" style={{ width: seg(p.substitution) }} title={`Fossil displacement ${p.substitution.toFixed(3)} tCO₂e/t`} />
        )}
      </span>
      <span className="comp-neg">
        {p.transport > 0 && (
          <span className="cseg transport" style={{ width: seg(p.transport) }} title={`Transport ${p.transport.toFixed(3)} tCO₂e/t`} />
        )}
        {p.process > 0 && (
          <span className="cseg process" style={{ width: seg(p.process) }} title={`Processing ${p.process.toFixed(3)} tCO₂e/t`} />
        )}
      </span>
    </span>
  );
}

function Breakdown({ option, availableT }: { option: PathwayOption | null; availableT: number }) {
  if (!option?.perT) return null;
  const p = option.perT;
  const rows = [
    { key: 'removal', label: 'Durable removal', v: p.durable, sign: '+' },
    { key: 'avoided', label: 'Avoided disposal', v: p.avoided, sign: '+' },
    { key: 'substitution', label: 'Fossil displacement', v: p.substitution, sign: '+' },
    { key: 'transport', label: 'Transport emissions', v: -p.transport, sign: '−' },
    { key: 'process', label: 'Processing emissions', v: -p.process, sign: '−' },
  ].filter((r) => Math.abs(r.v) > 1e-6);
  const max = Math.max(...rows.map((r) => Math.abs(r.v)), 1e-6);

  return (
    <div className="bkdown">
      <div className="bk-head">
        Carbon composition · <strong>{option.short}</strong>
        <span className="muted"> · per tonne of feedstock</span>
      </div>
      <div className="bk-rows">
        {rows.map((r) => (
          <div key={r.key} className="bk-row">
            <span className="bk-label">{r.label}</span>
            <span className="bk-track">
              <span
                className={`bk-fill ${r.key}`}
                style={{ width: `${(Math.abs(r.v) / max) * 100}%` }}
              />
            </span>
            <span className={`bk-val mono ${r.v >= 0 ? 'pos' : 'neg'}`}>
              {r.v >= 0 ? '+' : '−'}
              {num(Math.abs(r.v), 3)}
            </span>
            <span className="bk-tot mono">{num(r.v * availableT)} t</span>
          </div>
        ))}
        <div className="bk-row bk-net">
          <span className="bk-label">Net</span>
          <span className="bk-track" />
          <span className="bk-val mono">{num(p.net, 3)}</span>
          <span className="bk-tot mono">{num(p.net * availableT)} t</span>
        </div>
      </div>
      {!option.producesDurableRemoval && (
        <div className="bk-note">
          This pathway produces no durable removal — its benefit is avoidance and displacement,
          which are cheaper commodities and are not interchangeable with removal.
        </div>
      )}
    </div>
  );
}

function BlockedList({ options }: { options: PathwayOption[] }) {
  if (options.length === 0) return null;
  return (
    <div className="blocked">
      <div className="bl-head">Not available for this material</div>
      {options.map((o) => (
        <div key={o.pathway} className="bl-row">
          <span className="bl-name">{o.short}</span>
          <span className="bl-why">
            {o.feasible ? (
              <>
                <span className="bl-kind reach">No destination</span>
                {o.unavailableReason}
              </>
            ) : (
              <>
                <span className="bl-kind gate">Feedstock gate</span>
                {o.blockedBy}
              </>
            )}
          </span>
        </div>
      ))}
      <div className="bl-foot">
        Excluded by the same gates the optimiser applies. Nothing here is hidden or estimated
        around — a pathway with no result reports why rather than a substitute number.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Why, flip, trade-off
// ─────────────────────────────────────────────────────────────────────────────

function WhyAndTradeoff({
  decision,
  diff,
  diffError,
  picked,
  leader,
}: {
  decision: PathwayDecision;
  diff: PathwayDiff | null;
  diffError: string | null;
  picked: PathwayId | null;
  leader: PathwayId | null;
}) {
  const flipped = picked !== null && picked !== leader;
  const maxDriver = diff ? Math.max(...diff.drivers.map((x) => Math.abs(x.deltaT)), 1) : 1;

  return (
    <div className="section">
      <div className="grid g2 why-grid">
        <Panel title={flipped ? 'What changed' : 'Why this pathway'}>
          {!flipped && <p className="why-text">{decision.why}</p>}

          {flipped && diffError && (
            <div className="empty">
              <h4>These pathways cannot be compared</h4>
              <p>{diffError}</p>
            </div>
          )}

          {flipped && !diffError && !diff && <p className="muted">Comparing…</p>}

          {flipped && diff && (
            <>
              <p className="why-text">{diff.summary}</p>
              <div className="drivers">
                {diff.drivers.map((dr) => (
                  <div key={dr.key} className="driver">
                    <div className="dr-head">
                      <span className="dr-label">{dr.label}</span>
                      <span className={`dr-value mono ${dr.deltaT >= 0 ? 'pos' : 'neg'}`}>
                        {dr.deltaT >= 0 ? '+' : '−'}
                        {num(Math.abs(dr.deltaT))}
                      </span>
                    </div>
                    <div className="dr-track">
                      <div className="dr-mid" />
                      <div
                        className={`dr-fill ${dr.deltaT >= 0 ? 'pos' : 'neg'}`}
                        style={{
                          width: `${(Math.abs(dr.deltaT) / maxDriver) * 50}%`,
                          left: dr.deltaT >= 0 ? '50%' : undefined,
                          right: dr.deltaT < 0 ? '50%' : undefined,
                        }}
                      />
                    </div>
                    <div className="dr-detail">
                      {dr.detail} · {num(dr.fromValue, 3)} → {num(dr.toValue, 3)} tCO₂e/t
                    </div>
                  </div>
                ))}
                {diff.drivers.length === 0 && (
                  <p className="muted">
                    No carbon component differs measurably between these two pathways for this
                    material.
                  </p>
                )}
              </div>
            </>
          )}
        </Panel>

        <Panel title="Carbon best vs economic best">
          <div className="vs">
            <div className="vs-col">
              <div className="vs-label">Carbon best</div>
              <div className="vs-name">
                {decision.options.find((o) => o.pathway === decision.carbonBest)?.short ?? '—'}
              </div>
            </div>
            <div className="vs-sep" aria-hidden />
            <div className="vs-col">
              <div className="vs-label">Economic best</div>
              <div className="vs-name">
                {decision.options.find((o) => o.pathway === decision.economicBest)?.short ?? '—'}
              </div>
            </div>
          </div>

          {decision.tradeoff ? (
            <p className="vs-text">{decision.tradeoff}</p>
          ) : (
            <p className="vs-text agree">
              The carbon choice and the economic choice agree for this material, so there is no
              trade-off to weigh.
            </p>
          )}

          <div className="vs-links">
            <span className="vs-q">What would change the decision?</span>
            <p className="vs-note">
              Facility availability, haul distance, plant capacity and the quantity on offer all
              move this ranking. No threshold is asserted here because the engine cannot solve for
              one directly — simulate the change instead and re-read the result.
            </p>
            <Link to="/scenarios" className="btn sm">
              Open Scenarios
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Network consequence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The chosen pathway drawn against the real network: origin, haul and plant.
 *
 * The geometry is from actual coordinates, and the route redraws when the pathway
 * changes — the point being that the decision moves material, not just a number.
 */
function Consequence({ decision, pathway }: { decision: PathwayDecision; pathway: PathwayId }) {
  const o = decision.options.find((x) => x.pathway === pathway);
  const [focus, setFocus] = useState<'route' | 'facility' | 'carbon'>('carbon');

  // Re-key the drawing on the pathway so the arc animates on every flip.
  const arcKey = useMemo(() => `${pathway}-${o?.facility?.id ?? 'none'}`, [pathway, o]);

  if (!o?.perT || !o.facility || !o.route) return null;

  const W = 640;
  const H = 132;
  const pad = 54;
  const src = decision.source;
  const fac = o.facility;

  const minLon = Math.min(src.lon, fac.lon);
  const maxLon = Math.max(src.lon, fac.lon);
  const minLat = Math.min(src.lat, fac.lat);
  const maxLat = Math.max(src.lat, fac.lat);
  const spanLon = maxLon - minLon || 0.01;
  const spanLat = maxLat - minLat || 0.01;
  const x = (lon: number) => pad + ((lon - minLon) / spanLon) * (W - 2 * pad);
  const y = (lat: number) => H / 2 + 8 - ((lat - (minLat + maxLat) / 2) / spanLat) * (H * 0.26);

  const x1 = x(src.lon);
  const y1 = y(src.lat);
  const x2 = x(fac.lon);
  const y2 = y(fac.lat);
  const cx = (x1 + x2) / 2;
  const cy = Math.max(26, Math.min(y1, y2) - 26);

  const detail = {
    route: [
      ['Road distance', `${num(o.route.roadKm, 1)} km`],
      ['Straight line', `${num(o.route.straightKm, 1)} km`],
      ['Vehicle', o.route.vehicleId.replace(/_/g, ' ')],
      ['Payload', `${num(o.route.payloadT, 1)} t`],
      ['Trips', num(o.route.trips)],
      ['Transport emissions', `${num(o.perT.transport * decision.availableT)} tCO₂e`],
      ['Material moved', `${num(decision.availableT)} t`],
    ],
    facility: [
      ['Facility', fac.name],
      ['District', fac.district],
      ['Nameplate', `${num(fac.capacityTpd)} t/day`],
      ['Headroom this window', `${num(fac.headroomT)} t`],
      ['Conversion efficiency', pct(fac.efficiency * 100)],
      ['Allocated in current plan', `${num(o.inPlanT)} t`],
      ['Processing emissions', `${num(o.perT.process * decision.availableT)} tCO₂e`],
    ],
    carbon: [
      ['Net carbon', `${num(o.perT.net * decision.availableT)} tCO₂e`],
      ['Per tonne', `${num(o.perT.net, 3)} tCO₂e/t`],
      ['Durable removal', `${num(o.perT.durable * decision.availableT)} tCO₂e`],
      ['Avoided disposal', `${num(o.perT.avoided * decision.availableT)} tCO₂e`],
      ['Fossil displacement', `${num(o.perT.substitution * decision.availableT)} tCO₂e`],
      ['Operating margin', inr(o.econ!.marginTotal)],
      ['Pathway maturity', o.maturity],
    ],
  }[focus];

  return (
    <div className="section">
      <SectionHead title="What this does to the network" note="Select a stage for its detail" />
      <Panel flush>
        <div className="conseq">
          <svg className="cq-map" viewBox={`0 0 ${W} ${H}`} width="100%" role="img">
            <path key={arcKey} d={`M${x1},${y1} Q${cx},${cy} ${x2},${y2}`} className="cq-arc" />
            <circle cx={x1} cy={y1} r={5} className="cq-src" />
            <circle cx={x2} cy={y2} r={6} className="cq-fac" />
            <text x={x1} y={y1 + 18} className="cq-lab" textAnchor="middle">
              {src.district}
            </text>
            {/* The plant is named rather than located: source and facility often
                share a district, and two dots both reading "Sangrur" says nothing. */}
            <text x={x2} y={y2 + 19} className="cq-lab" textAnchor="middle">
              {fac.name}
            </text>
            <text x={cx} y={cy - 7} className="cq-dist" textAnchor="middle">
              {num(o.route.roadKm, 1)} km · {num(o.route.trips)} trips
            </text>
          </svg>

          <div className="cq-chain">
            {[
              { k: 'source' as const, label: 'Source', value: src.name, focus: null },
              { k: 'route' as const, label: 'Route', value: `${num(o.route.roadKm)} km`, focus: 'route' as const },
              { k: 'facility' as const, label: 'Facility', value: fac.name, focus: 'facility' as const },
              { k: 'pathway' as const, label: 'Pathway', value: o.short, focus: null },
              {
                k: 'carbon' as const,
                label: 'Carbon outcome',
                value: `${num(o.perT.net * decision.availableT)} tCO₂e`,
                focus: 'carbon' as const,
              },
            ].map((s, i, arr) => (
              <button
                key={s.k}
                className={`cq-node ${s.focus && focus === s.focus ? 'on' : ''} ${
                  s.focus ? 'clickable' : ''
                }`}
                onClick={() => s.focus && setFocus(s.focus)}
                disabled={!s.focus}
              >
                <span className="cq-n-label">{s.label}</span>
                <span className="cq-n-value">{s.value}</span>
                {i < arr.length - 1 && <span className="cq-n-arrow" aria-hidden />}
              </button>
            ))}
          </div>

          <div className="cq-detail">
            <div className="cq-d-head">
              {focus === 'route' ? 'Route' : focus === 'facility' ? 'Facility' : 'Carbon outcome'}
            </div>
            <ul className="dd-list">
              {detail.map(([k, v]) => (
                <li key={k}>
                  <span>{k}</span>
                  <span className="mono">{v}</span>
                </li>
              ))}
            </ul>
            {focus === 'carbon' && (
              <Link to="/carbon/ledger" className="btn sm cq-trace">
                Trace in the Carbon Ledger
              </Link>
            )}
          </div>
        </div>
      </Panel>

      <div className="cq-status">
        <span className="q-tag">Modelled estimate</span>
        Evaluated against the network as it stands, from the optimiser's own arc set. Permanence
        uses this material's own feedstock, as the optimiser does when valuing an arc — the Carbon
        Ledger instead uses the network's dominant biochar feedstock when decomposing a finished
        total. Not measured, not verified, and not a carbon credit.
      </div>
    </div>
  );
}
