/**
 * Carbon Infrastructure — the facilities command screen.
 *
 * The page this replaced answered "what are all our facilities?" with a title,
 * three summary boxes and an eighteen-row table. That is a report. This answers
 * a different question — "where is carbon value being created across the
 * network, and what should I pay attention to?" — and it is built to be read
 * from across a room.
 *
 * Composition is deliberately asymmetric. A grid of equal cards is what you
 * build when you have not decided what matters; here the map takes most of the
 * screen because "where" is most of the question, and everything else is a
 * supporting signal sized to its importance:
 *
 *   ┌────────────────────────┬──────────────────┐
 *   │                        │ CARBON POSITION  │
 *   │      LIVE NETWORK      ├──────────────────┤
 *   │                        │ WHAT MATTERS     │
 *   ├──────────────┬─────────┴──────────────────┤
 *   │ CAPACITY     │ MATERIAL → PATHWAY → CARBON│
 *   └──────────────┴────────────────────────────┘
 *
 * The full ranking still exists, below the fold, where a table belongs.
 *
 * On numbers. Every carbon figure on this screen comes from
 * `/api/facilities/carbon`, which values each plant under the whole-network
 * permanence basis — that is what makes the shares sum to the network net.
 * Nothing here re-derives carbon from allocations, because an allocation-level
 * sum sits on a different basis and disagrees by about 1.7%. Material, capacity
 * and distance are physical and safe to aggregate; carbon is not.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from '../router.tsx';
import { api, useResource, useTwin } from '../store.tsx';
import { exportCsv } from '../download.ts';
import { useCarbonExport } from '../components/CarbonExport.tsx';
import { ErrorState, Loading } from '../components/Primitives.tsx';
import { Drawer } from '../components/Drawer.tsx';
import { NetworkMap, type Selection } from '../components/NetworkMap.tsx';
import { inr, km, num, pct } from '../format.ts';
import type { FacilityCarbon, FacilityRankRow } from '../../../engine/src/facility.ts';
import type { CarbonBrief } from '../../../engine/src/brief.ts';
import '../styles/carbon-facilities.css';

type Mode = 'inspect' | 'compare';

export default function CarbonFacilities() {
  const { boot, state, optimization, version } = useTwin();
  const { navigate } = useRouter();

  const rank = useResource(() => api.facilityCarbon(), [version], [
    'Valuing every plant under the network permanence basis…',
  ]);
  const brief = useResource(() => api.brief(), [version], ['Reading opportunities and risk…']);

  const [mode, setMode] = useState<Mode>('inspect');
  const [openId, setOpenId] = useState<string | null>(null);
  const [pair, setPair] = useState<[string | null, string | null]>([null, null]);
  const [showAll, setShowAll] = useState(false);

  const rows = rank.data;

  useCarbonExport(
    rows && state
      ? {
          label: `plant ranking (${rows.length})`,
          run: () =>
            exportCsv(
              rows,
              [
                { header: 'Facility', value: (r) => r.name },
                { header: 'District', value: (r) => r.district },
                { header: 'Pathway', value: (r) => r.pathwayShort },
                { header: 'Status', value: (r) => r.status },
                { header: 'Received t', value: (r) => r.receivedT.toFixed(1) },
                { header: 'Capacity t', value: (r) => r.capacityT.toFixed(1) },
                { header: 'Utilisation %', value: (r) => r.utilisationPct.toFixed(1) },
                { header: 'Net tCO2e', value: (r) => r.netT.toFixed(2) },
                { header: 'tCO2e per t', value: (r) => r.perTonneT.toFixed(4) },
                { header: 'Gross benefit tCO2e', value: (r) => r.grossBenefitT.toFixed(2) },
                { header: 'Transport tCO2e', value: (r) => r.transportT.toFixed(2) },
                { header: 'Process tCO2e', value: (r) => r.processT.toFixed(2) },
                { header: 'Share of net %', value: (r) => r.sharePct.toFixed(2) },
                { header: 'Sources', value: (r) => r.sourceCount },
                { header: 'Mean haul km', value: (r) => r.meanHaulKm.toFixed(1) },
              ],
              {
                title: 'Carbon by plant',
                asOf: state.asOf,
                windowDays: state.assumptions.windowDays,
                objective: state.objective,
                twinVersion: version,
                notes: [
                  'Each plant is valued under the whole-network permanence basis, so shares sum to the network net.',
                ],
              },
            ),
        }
      : null,
    [rows, state, version],
  );

  /** Selecting on the map means different things in the two modes. */
  const onSelect = useCallback(
    (s: Selection) => {
      if (!s || s.kind !== 'facility') return;
      if (mode === 'inspect') {
        setOpenId(s.id);
        return;
      }
      setPair(([a, b]) => {
        if (a === s.id) return [b, null];
        if (b === s.id) return [a, null];
        if (!a) return [s.id, b];
        if (!b) return [a, s.id];
        return [b, s.id];
      });
    },
    [mode],
  );

  if (!boot || !state) return <Loading message="Loading…" />;
  if (rank.loading) return <Loading message={rank.message} />;
  if (rank.error) return <ErrorState message={rank.error} onRetry={rank.reload} />;
  if (!rows) return null;

  const working = rows.filter((r) => r.receivedT > 0);
  const netT = rows.reduce((a, r) => a + r.netT, 0);
  const b = brief.data ?? null;

  /** Map selection: the inspected plant, or the compare pair. */
  const mapSelection: Selection =
    mode === 'compare'
      ? pair[0]
        ? { kind: 'facility', id: pair[0] }
        : null
      : openId
        ? { kind: 'facility', id: openId }
        : null;

  return (
    <div className="cf">
      <header className="cf-top">
        <div>
          <h1>Carbon infrastructure</h1>
          <p>Where material is processed, and where carbon value is created.</p>
        </div>

        <div className="cf-acts">
          <button
            className={`cf-btn ${mode === 'compare' ? 'on' : ''}`}
            onClick={() => {
              setMode(mode === 'compare' ? 'inspect' : 'compare');
              setPair([null, null]);
              setOpenId(null);
            }}
          >
            {mode === 'compare' ? 'Comparing — pick two' : 'Compare'}
          </button>
          <button
            className="cf-btn"
            onClick={() => navigate('/carbon/ledger')}
            title="Follow one consignment from the field to the ledger line"
          >
            Follow flow
          </button>
          <button className="cf-btn" onClick={() => navigate('/carbon?do=simulate')}>
            Simulate
          </button>
        </div>
      </header>

      <div className="cf-grid">
        <section className="cf-map">
          <div className="cf-map-bar">
            <span className="cf-lbl">Live network</span>
            <span className="cf-sub">
              {num(boot.network.sources.length)} sources · {num(working.length)} of{' '}
              {num(rows.length)} plants operating ·{' '}
              {num(optimization?.result.allocations.length ?? 0)} flows
            </span>
            {mode === 'compare' && (
              <span className="cf-pill">
                {pair.filter(Boolean).length} of 2 selected
                {pair.some(Boolean) && (
                  <button onClick={() => setPair([null, null])} aria-label="Clear selection">
                    ×
                  </button>
                )}
              </span>
            )}
          </div>
          <div className={`cf-canvas ${mapSelection ? 'focused' : ''}`}>
            <NetworkMap
              sources={boot.network.sources}
              facilities={boot.network.facilities}
              allocations={optimization?.result.allocations ?? []}
              selection={mapSelection}
              onSelect={onSelect}
              showLegend={false}
              showLabels
            />
          </div>
          <div className="cf-map-foot">
            {mode === 'compare'
              ? 'Pick two plants on the map or in the ranking beside it. Arcs carry material allocated in the plan currently in force.'
              : 'Select a plant for its carbon profile. The screen stays where it is.'}
          </div>
        </section>

        <Position rows={rows} netT={netT} openId={openId} onPick={(id) => onSelect({ kind: 'facility', id })} />

        <WhatMatters b={b} onExplore={() => navigate('/carbon/opportunities')} onSimulate={() => navigate('/carbon?do=simulate')} />

        <Capacity rows={rows} onPick={(id) => onSelect({ kind: 'facility', id })} />

        <MaterialChain rows={rows} openId={openId} />
      </div>

      <Ranking rows={rows} showAll={showAll} onToggle={() => setShowAll((v) => !v)} onPick={setOpenId} />

      {openId && mode === 'inspect' && (
        <FacilityPanel
          id={openId}
          version={version}
          onClose={() => setOpenId(null)}
          onTrace={(sourceId) =>
            navigate(
              `/carbon/ledger?source=${encodeURIComponent(sourceId)}&facility=${encodeURIComponent(openId)}`,
            )
          }
        />
      )}

      {mode === 'compare' && pair[0] && pair[1] && (
        <ComparePanel
          a={pair[0]}
          b={pair[1]}
          version={version}
          onClose={() => setPair([null, null])}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Carbon position
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The network net, then who made it — as proportional bars, not a table.
 *
 * Only the plants that actually contribute are drawn. Eighteen rows where four
 * of them are zero is four rows of nothing competing with the ones that matter.
 */
function Position({
  rows,
  netT,
  openId,
  onPick,
}: {
  rows: FacilityRankRow[];
  netT: number;
  openId: string | null;
  onPick: (id: string) => void;
}) {
  const top = useMemo(
    () => rows.filter((r) => r.netT > 0).sort((a, b) => b.netT - a.netT).slice(0, 7),
    [rows],
  );
  const max = Math.max(...top.map((r) => r.netT), 1);

  return (
    <section className="cf-pos">
      <div className="cf-lbl">Carbon position</div>
      <div className="cf-net">
        +{num(netT)}
        <span>tCO₂e</span>
      </div>
      <div className="cf-net-note">
        Every plant valued under the whole-network permanence basis, so these shares sum to the
        network figure.
      </div>

      <ul className="cf-rank">
        {top.map((r) => (
          <li key={r.id}>
            <button
              className={`cf-rank-row ${openId === r.id ? 'on' : ''}`}
              onClick={() => onPick(r.id)}
            >
              <span className="cf-rank-n">{r.name}</span>
              <span className="cf-rank-track">
                <span className="cf-rank-fill" style={{ width: `${(r.netT / max) * 100}%` }} />
              </span>
              <span className="cf-rank-v">{num(r.netT)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// What matters
// ─────────────────────────────────────────────────────────────────────────────

/** Exactly one upside and exactly one risk. Both from the brief, both measured. */
function WhatMatters({
  b,
  onExplore,
  onSimulate,
}: {
  b: CarbonBrief | null;
  onExplore: () => void;
  onSimulate: () => void;
}) {
  if (!b) return <section className="cf-matters" aria-hidden />;

  return (
    <section className="cf-matters">
      <div className="cf-lbl">What matters</div>

      {b.action && (
        <div className="cf-sig up">
          <div className="cf-sig-v">+{num(b.action.carbonDeltaT)}<i>tCO₂e</i></div>
          <div className="cf-sig-t">{b.action.headline}</div>
          <div className="cf-sig-s">
            {b.action.marginDeltaInr >= 0 ? '+' : '−'}
            {inr(Math.abs(b.action.marginDeltaInr))} margin
          </div>
          <button className="cf-mini" onClick={onExplore}>
            Explore
          </button>
        </div>
      )}

      {b.risk && (
        <div className="cf-sig risk">
          <div className="cf-sig-v">−{num(Math.abs(b.risk.carbonDeltaT))}<i>tCO₂e</i></div>
          <div className="cf-sig-t">{b.risk.facilityName} offline</div>
          <div className="cf-sig-s">
            {pct(Math.abs(b.risk.carbonLossPct), 1)} of the network · resilience{' '}
            {b.risk.resilienceGrade}
          </div>
          <button className="cf-mini" onClick={onSimulate}>
            Simulate
          </button>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Capacity
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Where there is room, and where there is none.
 *
 * Two facts, not eighteen utilisation bars: the largest unused capacity, and
 * how much of the fleet is pinned at its ceiling. Both are physical quantities,
 * safe to aggregate without touching a carbon basis.
 */
function Capacity({ rows, onPick }: { rows: FacilityRankRow[]; onPick: (id: string) => void }) {
  const idle = useMemo(
    () =>
      rows
        .map((r) => ({ r, free: Math.max(0, r.capacityT - r.receivedT) }))
        .sort((a, b) => b.free - a.free)[0],
    [rows],
  );
  const bound = rows.filter((r) => r.utilisationPct >= 99.5).length;
  const totalFree = rows.reduce((a, r) => a + Math.max(0, r.capacityT - r.receivedT), 0);

  if (!idle) return null;

  return (
    <section className="cf-cap">
      <div className="cf-lbl">Network capacity</div>
      <div className="cf-cap-v">
        {num(totalFree)}
        <span>t unused</span>
      </div>

      <button className="cf-cap-row" onClick={() => onPick(idle.r.id)}>
        <span className="cf-cap-n">{idle.r.name}</span>
        <span className="cf-cap-track">
          <span
            className="cf-cap-fill"
            style={{ width: `${Math.min(100, idle.r.utilisationPct)}%` }}
          />
        </span>
        <span className="cf-cap-x">{num(idle.free)} t free</span>
      </button>

      <p className="cf-cap-note">
        Largest single block of unused capacity. {bound} of {rows.length} plants are at their
        ceiling and cannot take another tonne.
      </p>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Material chain
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Material → plant → pathway → carbon, for the network or for one plant.
 *
 * When nothing is selected this is the whole fleet grouped by pathway. Select a
 * plant and the chain becomes that plant's own, which is the moment the screen
 * stops being a dashboard and starts being an instrument.
 */
function MaterialChain({ rows, openId }: { rows: FacilityRankRow[]; openId: string | null }) {
  const chain = useMemo(() => {
    const scope = openId ? rows.filter((r) => r.id === openId) : rows.filter((r) => r.receivedT > 0);
    const byPath = new Map<string, { t: number; c: number }>();
    for (const r of scope) {
      const e = byPath.get(r.pathwayShort) ?? { t: 0, c: 0 };
      e.t += r.receivedT;
      e.c += r.netT;
      byPath.set(r.pathwayShort, e);
    }
    const out = [...byPath.entries()].map(([k, v]) => ({ k, ...v })).sort((a, b) => b.c - a.c);
    return {
      out,
      t: scope.reduce((a, r) => a + r.receivedT, 0),
      c: scope.reduce((a, r) => a + r.netT, 0),
      name: openId ? (scope[0]?.name ?? null) : null,
    };
  }, [rows, openId]);

  const max = Math.max(...chain.out.map((x) => x.c), 1);

  return (
    <section className="cf-chain">
      <div className="cf-lbl">
        Material → pathway → carbon
        {chain.name && <span className="cf-scope">{chain.name}</span>}
      </div>

      <div className="cf-chain-head">
        <span>
          <b>{num(chain.t)}</b> t processed
        </span>
        <span className="cf-chain-arrow" aria-hidden>
          →
        </span>
        <span>
          <b>{chain.out.length}</b> pathway{chain.out.length === 1 ? '' : 's'}
        </span>
        <span className="cf-chain-arrow" aria-hidden>
          →
        </span>
        <span className="pos">
          <b>+{num(chain.c)}</b> tCO₂e
        </span>
      </div>

      <ul className="cf-chain-rows">
        {chain.out.map((x) => (
          <li key={x.k}>
            <span className="cf-chain-k">{x.k}</span>
            <span className="cf-chain-t">{num(x.t)} t</span>
            <span className="cf-chain-track">
              <span className="cf-chain-fill" style={{ width: `${(x.c / max) * 100}%` }} />
            </span>
            <span className="cf-chain-v">+{num(x.c)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ranking, below the fold where a table belongs
// ─────────────────────────────────────────────────────────────────────────────

function Ranking({
  rows,
  showAll,
  onToggle,
  onPick,
}: {
  rows: FacilityRankRow[];
  showAll: boolean;
  onToggle: () => void;
  onPick: (id: string) => void;
}) {
  const sorted = useMemo(() => [...rows].sort((a, b) => b.netT - a.netT), [rows]);
  const shown = showAll ? sorted : sorted.slice(0, 6);

  return (
    <section className="cf-table">
      <div className="cf-table-head">
        <span className="cf-lbl">Every plant</span>
        <button className="cf-mini" onClick={onToggle}>
          {showAll ? 'Show top 6' : `View all ${rows.length}`}
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Plant</th>
            <th>Pathway</th>
            <th className="n">Received</th>
            <th className="n">Utilisation</th>
            <th className="n">tCO₂e/t</th>
            <th className="n">Net tCO₂e</th>
            <th className="n">Share</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={r.id} onClick={() => onPick(r.id)} tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onPick(r.id)}>
              <td>
                <span className="cf-t-rank">{i + 1}</span>
                {r.name}
                <span className="cf-t-dist">{r.district}</span>
              </td>
              <td>{r.pathwayShort}</td>
              <td className="n">{r.receivedT > 0 ? `${num(r.receivedT)} t` : '—'}</td>
              <td className="n">{r.receivedT > 0 ? pct(r.utilisationPct, 0) : 'idle'}</td>
              <td className="n">{r.receivedT > 0 ? r.perTonneT.toFixed(3) : '—'}</td>
              <td className="n strong">{r.netT > 0 ? num(r.netT) : '—'}</td>
              <td className="n">{r.sharePct > 0 ? pct(r.sharePct, 1) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inspection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One plant, opened without losing the screen.
 *
 * The decomposition is the engine's own: gross benefit, minus transport, minus
 * processing, plus whatever permanence adjustment applies, equals net. The
 * written conclusion is the engine's too — `why` is composed by the facility
 * module, not phrased here.
 */
function FacilityPanel({
  id,
  version,
  onClose,
  onTrace,
}: {
  id: string;
  version: number;
  onClose: () => void;
  onTrace: (sourceId: string) => void;
}) {
  const prof = useResource(() => api.facilityProfile(id), [version, id], [
    'Building this plant’s carbon profile…',
  ]);
  const p: FacilityCarbon | null = prof.data ?? null;

  return (
    <Drawer title={p?.name ?? 'Plant'} onClose={onClose} wide>
      {prof.loading && <Loading message={prof.message} />}
      {prof.error && <ErrorState message={prof.error} onRetry={prof.reload} />}
      {p && (
        <>
          <p className="dr-sub">
            {p.operator} · {p.district}, {p.state} · {p.pathwayLabel}
          </p>

          <div className="cfp-figs">
            <div>
              <b>+{num(p.netT)}</b>
              <i>tCO₂e net</i>
            </div>
            <div>
              <b>{p.perTonneT.toFixed(3)}</b>
              <i>tCO₂e per tonne</i>
            </div>
            <div>
              <b>{num(p.receivedT)}</b>
              <i>t received</i>
            </div>
            <div>
              <b>{pct(p.utilisationPct, 0)}</b>
              <i>of capacity</i>
            </div>
          </div>

          <div className="cf-lbl">How this plant's number is built</div>
          <Decomp p={p} />

          {p.streams.length > 0 && (
            <>
              <div className="cf-lbl">What it takes in</div>
              <ul className="cfp-streams">
                {p.streams.map((s) => (
                  <li key={s.stream}>
                    <span>{s.label}</span>
                    <b>{num(s.tonnes)} t</b>
                  </li>
                ))}
              </ul>
            </>
          )}

          {p.why && <p className="cfp-why">{p.why}</p>}

          {p.arcs.length > 0 && (
            <>
              <div className="cf-lbl">Where its material comes from</div>
              <ul className="cfp-arcs">
                {p.arcs.slice(0, 6).map((a) => (
                  <li key={a.sourceId}>
                    <button onClick={() => onTrace(a.sourceId)}>
                      <span className="cfp-arc-n">{a.sourceName}</span>
                      <span className="cfp-arc-m">
                        {num(a.tonnes)} t · {km(a.distanceKm)}
                      </span>
                      <span className="cfp-arc-c">{num(a.netCarbonT)} tCO₂e</span>
                      <span className="cfp-arc-go" aria-hidden>
                        Trace →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Drawer>
  );
}

/** Gross, less the two charges, to net — proportional, in one row of bars. */
function Decomp({ p }: { p: FacilityCarbon }) {
  const parts = [
    { k: 'Gross carbon benefit', v: p.grossBenefitT, sign: 1 },
    { k: 'Transport', v: p.transportT, sign: -1 },
    { k: 'Processing', v: p.processT, sign: -1 },
  ];
  if (Math.abs(p.adjustmentT) > 0.5) {
    parts.push({ k: 'Permanence adjustment', v: Math.abs(p.adjustmentT), sign: p.adjustmentT >= 0 ? 1 : -1 });
  }
  const max = Math.max(...parts.map((x) => Math.abs(x.v)), 1);

  return (
    <div className="cfp-decomp">
      {parts.map((x) => (
        <div key={x.k}>
          <span className="cfp-d-k">{x.k}</span>
          <span className="cfp-d-track">
            <span
              className={`cfp-d-fill ${x.sign > 0 ? 'add' : 'sub'}`}
              style={{ width: `${(Math.abs(x.v) / max) * 100}%` }}
            />
          </span>
          <span className={`cfp-d-v ${x.sign > 0 ? 'add' : 'sub'}`}>
            {x.sign > 0 ? '+' : '−'}
            {num(Math.abs(x.v))}
          </span>
        </div>
      ))}
      <div className="cfp-d-net">
        <span className="cfp-d-k">Net</span>
        <span className="cfp-d-track" />
        <span className="cfp-d-v">+{num(p.netT)}</span>
      </div>
    </div>
  );
}

/**
 * Small values need their decimals.
 *
 * num() formats whole tonnes, which is right for 7,239 and destroys 1.207 — it
 * renders both that and 1.229 as "1", so the row that actually decides the
 * comparison reads as a tie.
 */
function cmpValue(v: number | string): string {
  if (typeof v !== 'number') return String(v);
  return Math.abs(v) < 10 ? v.toFixed(3) : num(v);
}

/**
 * Two plants, and one sentence saying which is better at what.
 *
 * The verdict is the engine's `summary` — a comparison the facility module
 * composes. Phrasing it here would be a second opinion on the same data.
 */
function ComparePanel({
  a,
  b,
  version,
  onClose,
}: {
  a: string;
  b: string;
  version: number;
  onClose: () => void;
}) {
  const cmp = useResource(() => api.facilityCompare(a, b), [version, a, b], [
    'Setting the two plants against each other…',
  ]);
  const c = cmp.data ?? null;

  return (
    <Drawer title="Compare plants" onClose={onClose} wide>
      {cmp.loading && <Loading message={cmp.message} />}
      {cmp.error && <ErrorState message={cmp.error} onRetry={cmp.reload} />}
      {c && (
        <>
          <div className="cfc-heads">
            <span>{c.a.name}</span>
            <span className="cfc-vs">vs</span>
            <span>{c.b.name}</span>
          </div>

          <table className="cfc-table">
            <tbody>
              {c.rows.map((r) => {
                const aWins = r.higherIsBetter ? r.a > r.b : r.a < r.b;
                return (
                  <tr key={r.key}>
                    <td className={`n ${aWins ? 'win' : ''}`}>{cmpValue(r.a)}</td>
                    <th>
                      {r.label}
                      <i>{r.unit}</i>
                    </th>
                    <td className={`n ${!aWins ? 'win' : ''}`}>{cmpValue(r.b)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {c.sharedSources.length > 0 && (
            <p className="dr-note">
              {c.sharedSources.length} source
              {c.sharedSources.length === 1 ? '' : 's'} supply both plants, so they are competing
              for the same material.
            </p>
          )}

          <p className="cfc-verdict">{c.summary}</p>
        </>
      )}
    </Drawer>
  );
}
