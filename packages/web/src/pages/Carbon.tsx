/**
 * Carbon Home — a control tower, not an analytics report.
 *
 * The screen is built around one number and the arithmetic that produces it.
 * Everything else on the page exists to answer a follow-up question the manager
 * will actually ask next:
 *
 *   How much?      the hero figure, on the plan currently in force
 *   Better/worse?  a period comparison against real re-solves of past supply
 *   From where?    the decomposition, which is the ledger grouped into six terms
 *   What now?      the attention strip and the change narrative
 *
 * Two rules the page keeps:
 *
 *   1. Nothing here is computed in the client beyond grouping and formatting.
 *      Every tonne and every tCO2e comes from the engine. If a figure cannot be
 *      traced to a ledger line or an allocation, it does not appear.
 *
 *   2. Removal, avoidance and substitution stay on separate rows. They are
 *      different commodities and the product never sums them into one
 *      "carbon saved" headline, however much a headline would like that.
 */

import { useMemo, useState } from 'react';
import { api, useResource, useTwin } from '../store.tsx';
import { ErrorState, Loading, Panel, SectionHead, Tag } from '../components/Primitives.tsx';
import { Link } from '../router.tsx';
import { num, pct, signed, tonnes } from '../format.ts';
import type { CarbonHistory, CarbonHistoryPoint } from '../../../engine/src/history.ts';
import type {
  Allocation,
  CarbonLedger,
  LedgerLine,
  PathwayId,
  StreamId,
} from '../../../engine/src/types.ts';

// ─────────────────────────────────────────────────────────────────────────────
// The six terms
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The decomposition is the ledger, regrouped. Each term names the ledger line
 * keys it owns, so the grouping is a lookup rather than a second calculation and
 * the terms are guaranteed to sum to the ledger's own net figure.
 */
interface Term {
  key: string;
  label: string;
  /** which ledger line kinds roll up here */
  kinds: LedgerLine['kind'][];
  /** overrides `kinds` when a kind splits across terms */
  lineKeys?: (k: string) => boolean;
  sign: 'plus' | 'minus';
  blurb: string;
  /** how this term draws its contributing allocations */
  contributors: 'durable' | 'avoided' | 'substitution' | 'transport' | 'process' | 'durable';
}

const TERMS: Term[] = [
  {
    key: 'removal',
    // Deliberately not "durable removal": this term is the gross figure, and the
    // hero panel shows durable removal net of the permanence adjustment below.
    // Two rows carrying one label but two numbers is how a screen loses trust.
    label: 'Carbon fixed in biochar',
    kinds: ['removal'],
    sign: 'plus',
    blurb: 'Gross carbon locked into char by pyrolysis, before the permanence adjustment.',
    contributors: 'durable',
  },
  {
    key: 'avoided',
    label: 'Avoided disposal',
    kinds: ['avoided'],
    sign: 'plus',
    blurb:
      'Methane and nitrous oxide the counterfactual fate would have released. Biogenic CO₂ is excluded.',
    contributors: 'avoided',
  },
  {
    key: 'substitution',
    label: 'Fossil displacement',
    kinds: ['substitution'],
    sign: 'plus',
    blurb: 'Coal, fossil CNG, grid electricity and synthetic nitrogen displaced by the products.',
    contributors: 'substitution',
  },
  {
    key: 'transport',
    label: 'Transport emissions',
    kinds: ['emission'],
    lineKeys: (k) => k === 'em_transport' || k === 'em_aggregation',
    sign: 'minus',
    blurb: 'Well-to-wheel diesel for haulage and field aggregation, including empty return legs.',
    contributors: 'transport',
  },
  {
    key: 'process',
    label: 'Processing emissions',
    kinds: ['emission'],
    lineKeys: (k) => k !== 'em_transport' && k !== 'em_aggregation',
    sign: 'minus',
    blurb: 'Grid electricity drawn by plant, digester methane slip and windrow composting losses.',
    contributors: 'process',
  },
  {
    key: 'adjustment',
    label: 'Permanence adjustment',
    kinds: ['adjustment'],
    sign: 'minus',
    blurb:
      'The share of biochar carbon that will not still be in the soil at 100 years, at Indian soil temperature.',
    contributors: 'durable',
  },
];

interface ResolvedTerm extends Term {
  valueT: number;
  lines: LedgerLine[];
  /** worst published uncertainty among the lines that make it up */
  uncertaintyPct: number;
}

function resolveTerms(ledger: CarbonLedger): ResolvedTerm[] {
  return TERMS.map((t) => {
    const lines = ledger.lines.filter(
      (l) => t.kinds.includes(l.kind) && (!t.lineKeys || t.lineKeys(l.key)),
    );
    const valueT = lines.reduce((a, l) => a + l.valueT, 0);
    const uncertaintyPct = lines.reduce((a, l) => Math.max(a, l.uncertaintyPct), 0);
    return { ...t, lines, valueT, uncertaintyPct };
  }).filter((t) => t.lines.length > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function Carbon() {
  const { boot, state, version } = useTwin();
  const carbon = useResource(() => api.carbon(), [version], [
    'Aggregating physical inventory across allocations…',
    'Applying the Q10 permanence correction…',
    'Running Monte Carlo over every emission factor…',
  ]);
  const opt = useResource(() => api.optimization(), [version], ['Reading the current plan…']);
  const history = useResource(() => api.carbonHistory(), [version], [
    'Re-solving the network on each of the last twenty weeks…',
  ]);
  const opps = useResource(() => api.bottlenecks(), [version], ['Scoring opportunities…']);

  const [openTerm, setOpenTerm] = useState<string | null>(null);

  if (!boot || !state) return <Loading message="Loading…" />;
  if (carbon.loading) return <Loading message={carbon.message} />;
  if (carbon.error) return <ErrorState message={carbon.error} onRetry={carbon.reload} />;
  if (!carbon.data) return null;

  const { ledger, totals } = carbon.data;
  const terms = resolveTerms(ledger);
  const allocations = opt.data?.result.allocations ?? [];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Carbon Home</h1>
          <div className="lede">
            The net atmospheric effect of the plan currently in force, and the arithmetic behind
            it. Every term below opens into the physical quantities, factors and citations it was
            built from.
          </div>
        </div>
        <div className="head-actions">
          <Tag tone="green">{state.assumptions.windowDays}-day window</Tag>
        </div>
      </div>

      <Hero ledger={ledger} history={history.data} loading={history.loading} />

      <Decomposition
        terms={terms}
        ledger={ledger}
        allocations={allocations}
        openTerm={openTerm}
        setOpenTerm={setOpenTerm}
        boot={boot}
        state={state}
      />

      <CarbonFlow ledger={ledger} totals={totals} terms={terms} />

      <Attention
        ledger={ledger}
        totals={totals}
        terms={terms}
        allocations={allocations}
        boot={boot}
        opportunity={opps.data?.opportunities?.[0] ?? null}
      />

      <Trend history={history.data} loading={history.loading} error={history.error} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────

function Hero({
  ledger,
  history,
  loading,
}: {
  ledger: CarbonLedger;
  history: CarbonHistory | null;
  loading: boolean;
}) {
  const unc = ledger.uncertainty;
  const p = history?.period;

  return (
    <div className="section carbon-hero">
      <div className="hero-figure">
        <div className="hero-label">Net carbon impact</div>
        <div className="hero-value">
          {ledger.netT >= 0 ? '+' : '−'}
          {num(Math.abs(ledger.netT))}
          <span className="hero-unit">tCO₂e</span>
        </div>
        <div className="hero-sub">
          over the current planning window
          {unc && (
            <>
              {' · '}
              <span className="mono">
                {num(unc.p5)}–{num(unc.p95)}
              </span>{' '}
              across {num(unc.draws)} Monte Carlo draws (P5–P95)
            </>
          )}
        </div>

        {loading && <div className="hero-trend muted">Computing the period comparison…</div>}
        {p && (
          <div className={`hero-trend ${p.improving ? 'pos' : 'neg'}`}>
            <span className="arrow">{p.improving ? '↑' : '↓'}</span>
            {pct(Math.abs(p.deltaPct))} vs previous {p.weeks}-week period
            <span className="muted">
              {' '}
              ({signed(p.deltaT)} tCO₂e, {num(p.previousT)} → {num(p.currentT)})
            </span>
          </div>
        )}
      </div>

      <div className="hero-side">
        <div className="hero-split">
          <div className="hs-row">
            <span className="hs-label">Durable removal (after permanence)</span>
            <span className="hs-value mono">{num(ledger.durableRemovalT)}</span>
          </div>
          <div className="hs-row">
            <span className="hs-label">Avoided emissions</span>
            <span className="hs-value mono">{num(ledger.avoidedEmissionsT)}</span>
          </div>
          <div className="hs-row">
            <span className="hs-label">Fossil displacement</span>
            <span className="hs-value mono">{num(ledger.substitutionT)}</span>
          </div>
          <div className="hs-note">
            Kept apart on purpose. Removal and avoidance are different commodities with roughly a
            twentyfold price gap, and this product never adds them into one figure.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Decomposition
// ─────────────────────────────────────────────────────────────────────────────

function Decomposition({
  terms,
  ledger,
  allocations,
  openTerm,
  setOpenTerm,
  boot,
  state,
}: {
  terms: ResolvedTerm[];
  ledger: CarbonLedger;
  allocations: Allocation[];
  openTerm: string | null;
  setOpenTerm: (k: string | null) => void;
  boot: NonNullable<ReturnType<typeof useTwin>['boot']>;
  state: NonNullable<ReturnType<typeof useTwin>['state']>;
}) {
  const maxAbs = Math.max(...terms.map((t) => Math.abs(t.valueT)), 1);

  return (
    <div className="section">
      <SectionHead
        title="How the number is built"
        note="Select any term to see the material, facilities, factors and citations behind it"
      />
      <Panel flush>
        <div className="decomp">
          {terms.map((t, i) => {
            const open = openTerm === t.key;
            const prevSign = i > 0 ? terms[i - 1].sign : null;
            return (
              <div key={t.key} className={`decomp-group ${open ? 'open' : ''}`}>
                {prevSign === 'plus' && t.sign === 'minus' && <div className="decomp-rule" />}
                <button
                  className="decomp-row"
                  onClick={() => setOpenTerm(open ? null : t.key)}
                  aria-expanded={open}
                >
                  <span className="d-op">{t.sign === 'plus' ? '+' : '−'}</span>
                  <span className="d-label">
                    {t.label}
                    <span className="d-blurb">{t.blurb}</span>
                  </span>
                  <span className="d-bar">
                    <span
                      className={`d-fill ${t.sign === 'plus' ? 'pos' : 'neg'}`}
                      style={{ width: `${(Math.abs(t.valueT) / maxAbs) * 100}%` }}
                    />
                  </span>
                  <span className={`d-value mono ${t.sign === 'plus' ? 'pos' : 'neg'}`}>
                    {num(Math.abs(t.valueT))}
                  </span>
                  <span className="d-unc mono" title="Published uncertainty on the largest factor">
                    ±{t.uncertaintyPct}%
                  </span>
                  <span className="d-chev">{open ? '−' : '+'}</span>
                </button>
                {open && (
                  <TermDetail
                    term={t}
                    allocations={allocations}
                    boot={boot}
                    state={state}
                    ledger={ledger}
                  />
                )}
              </div>
            );
          })}

          <div className="decomp-total">
            <span className="d-op">=</span>
            <span className="d-label">Net carbon impact</span>
            <span className="d-bar" />
            <span className="d-value mono">{num(ledger.netT)}</span>
            <span className="d-unc mono">tCO₂e</span>
            <span className="d-chev" />
          </div>
        </div>
      </Panel>
    </div>
  );
}

/**
 * The drill-down.
 *
 * Contributing allocations are selected by the same rule the engine used to build
 * the term, so this panel cannot show material that did not produce the number
 * above it.
 */
function TermDetail({
  term,
  allocations,
  boot,
  state,
  ledger,
}: {
  term: ResolvedTerm;
  allocations: Allocation[];
  boot: NonNullable<ReturnType<typeof useTwin>['boot']>;
  state: NonNullable<ReturnType<typeof useTwin>['state']>;
  ledger: CarbonLedger;
}) {
  const pathways = boot.reference.pathways;
  const streams = boot.reference.streams;

  const contributing = useMemo(() => {
    switch (term.contributors) {
      case 'durable':
        return allocations.filter((a) => pathways[a.pathway]?.producesDurableRemoval);
      case 'substitution':
        return allocations.filter((a) => !pathways[a.pathway]?.producesDurableRemoval);
      case 'process':
      case 'avoided':
      case 'transport':
      default:
        return allocations;
    }
  }, [allocations, term.contributors, pathways]);

  const byStream = rollup(contributing, (a) => a.stream);
  const byPathway = rollup(contributing, (a) => a.pathway);
  const byFacility = rollup(contributing, (a) => a.facilityId);
  const facName = new Map(state.facilities.map((f) => [f.id, f.name]));

  const totalTonnes = contributing.reduce((a, x) => a + x.tonnes, 0);
  const totalTkm = contributing.reduce((a, x) => a + x.tkm, 0);
  const trips = contributing.reduce((a, x) => a + x.trips, 0);

  return (
    <div className="decomp-detail">
      <div className="dd-grid">
        <div className="dd-col">
          <h5>Contributing material</h5>
          {byStream.length === 0 ? (
            <p className="muted">No material contributes to this term in the current plan.</p>
          ) : (
            <ul className="dd-list">
              {byStream.slice(0, 6).map(([k, t]) => (
                <li key={k}>
                  <span>{streams[k as StreamId]?.label ?? k}</span>
                  <span className="mono">{tonnes(t)} t</span>
                </li>
              ))}
            </ul>
          )}
          <h5>Pathways</h5>
          <ul className="dd-list">
            {byPathway.slice(0, 6).map(([k, t]) => (
              <li key={k}>
                <span>{pathways[k as PathwayId]?.short ?? k}</span>
                <span className="mono">{tonnes(t)} t</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="dd-col">
          <h5>Facilities</h5>
          <ul className="dd-list">
            {byFacility.slice(0, 7).map(([k, t]) => (
              <li key={k}>
                <span>{facName.get(k) ?? k}</span>
                <span className="mono">{tonnes(t)} t</span>
              </li>
            ))}
          </ul>
          {term.contributors === 'transport' && (
            <>
              <h5>Transport</h5>
              <ul className="dd-list">
                <li>
                  <span>Tonne-kilometres</span>
                  <span className="mono">{num(totalTkm / 1000)}k</span>
                </li>
                <li>
                  <span>Vehicle trips</span>
                  <span className="mono">{num(trips)}</span>
                </li>
                <li>
                  <span>Mean haul</span>
                  <span className="mono">
                    {totalTonnes > 0 ? num(totalTkm / totalTonnes, 1) : '—'} km
                  </span>
                </li>
              </ul>
            </>
          )}
        </div>

        <div className="dd-col dd-wide">
          <h5>Factors, basis and source</h5>
          <table className="dd-table">
            <tbody>
              {term.lines.map((l) => (
                <tr key={l.key}>
                  <td className="dd-line">
                    {l.label}
                    <span className="dd-basis">{l.basis}</span>
                    <span className="dd-source">{l.source}</span>
                  </td>
                  <td className="mono dd-num">{num(l.valueT)}</td>
                  <td className="mono dd-num muted">±{l.uncertaintyPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="dd-quality">
            <span className="q-tag">Modelled estimate</span>
            Computed from the plan's physical inventory and published factors. Not measured, not
            verified, and not a carbon credit.
            {ledger.permanence && term.key === 'adjustment' && (
              <>
                {' '}
                Permanence uses {ledger.permanence.method}, at{' '}
                {ledger.permanence.soilTempC} °C soil temperature.
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function rollup<T extends string>(allocations: Allocation[], key: (a: Allocation) => T) {
  const m = new Map<T, number>();
  for (const a of allocations) m.set(key(a), (m.get(key(a)) ?? 0) + a.tonnes);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Carbon flow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The journey, drawn proportionally.
 *
 * Mass stages are scaled against supplied tonnes; carbon stages against the gross
 * benefit. Those are different units, so the diagram says where the unit changes
 * rather than pretending one ribbon runs the whole way through.
 */
function CarbonFlow({
  ledger,
  totals,
  terms,
}: {
  ledger: CarbonLedger;
  totals: { suppliedT: number; divertedT: number; strandedT: number };
  terms: ResolvedTerm[];
}) {
  const gross = terms.filter((t) => t.sign === 'plus').reduce((a, t) => a + t.valueT, 0);
  const losses = terms.filter((t) => t.sign === 'minus').reduce((a, t) => a + Math.abs(t.valueT), 0);
  const termT = (key: string) => Math.abs(terms.find((t) => t.key === key)?.valueT ?? 0);

  const massMax = Math.max(totals.suppliedT, 1);
  const carbonMax = Math.max(gross, 1);
  const H = 132;

  const massH = (v: number) => Math.max(2, (v / massMax) * H);
  const carbonH = (v: number) => Math.max(2, (v / carbonMax) * H);

  const stages = [
    { label: 'Waste', value: totals.suppliedT, unit: 't', h: massH(totals.suppliedT), kind: 'mass' },
    {
      label: 'Collection',
      value: totals.divertedT,
      unit: 't',
      h: massH(totals.divertedT),
      kind: 'mass',
      lost: totals.strandedT,
      lostLabel: 'stranded',
    },
    // Mass is unchanged through haulage and the plant gate, so these two stages
    // carry their carbon charge instead — otherwise they are three identical bars
    // in a row telling the reader nothing.
    {
      label: 'Transport',
      value: totals.divertedT,
      unit: 't',
      h: massH(totals.divertedT),
      kind: 'mass',
      charge: termT('transport'),
    },
    {
      label: 'Processing',
      value: totals.divertedT,
      unit: 't',
      h: massH(totals.divertedT),
      kind: 'mass',
      charge: termT('process'),
    },
    { label: 'Carbon outcome', value: gross, unit: 'tCO₂e', h: carbonH(gross), kind: 'carbon' },
    {
      label: 'Net impact',
      value: ledger.netT,
      unit: 'tCO₂e',
      h: carbonH(ledger.netT),
      kind: 'carbon',
      lost: losses,
      lostLabel: 'emissions & adjustment',
    },
  ];

  return (
    <div className="section">
      <SectionHead
        title="Carbon flow"
        note="Band height is proportional within each unit; the dashed rule marks where tonnes become tCO₂e"
      />
      <Panel>
        <div className="flow">
          {stages.map((s, i) => (
            <div key={s.label} className={`flow-stage ${s.kind}`}>
              <div className="flow-band-wrap" style={{ height: H }}>
                {i === 4 && <div className="flow-unitbreak" aria-hidden />}
                <div
                  className={`flow-band ${s.kind}`}
                  style={{ height: s.h }}
                  title={`${num(s.value)} ${s.unit}`}
                />
                {s.lost !== undefined && s.lost > 0 && (
                  <div
                    className="flow-loss"
                    style={{ height: s.kind === 'mass' ? massH(s.lost) : carbonH(s.lost) }}
                    title={`${num(s.lost)} ${s.unit} ${s.lostLabel}`}
                  />
                )}
              </div>
              <div className="flow-meta">
                <div className="flow-label">{s.label}</div>
                <div className="flow-value mono">
                  {num(s.value)}
                  <span className="flow-unit"> {s.unit}</span>
                </div>
                {s.lost !== undefined && s.lost > 0 && (
                  <div className="flow-lost mono">
                    −{num(s.lost)} {s.lostLabel}
                  </div>
                )}
                {s.charge !== undefined && s.charge > 0 && (
                  <div className="flow-charge mono">−{num(s.charge)} tCO₂e charged</div>
                )}
              </div>
              {i < stages.length - 1 && <div className="flow-arrow" aria-hidden />}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Attention strip
// ─────────────────────────────────────────────────────────────────────────────

function Attention({
  ledger,
  totals,
  terms,
  allocations,
  boot,
  opportunity,
}: {
  ledger: CarbonLedger;
  totals: { divertedT: number };
  terms: ResolvedTerm[];
  allocations: Allocation[];
  boot: NonNullable<ReturnType<typeof useTwin>['boot']>;
  opportunity: { name: string; tonnes: number; bestPathway: PathwayId; note: string } | null;
}) {
  const pathways = boot.reference.pathways;

  const positive = terms.filter((t) => t.sign === 'plus').sort((a, b) => b.valueT - a.valueT)[0];
  const loss = terms
    .filter((t) => t.sign === 'minus')
    .sort((a, b) => Math.abs(b.valueT) - Math.abs(a.valueT))[0];

  const byPathwayCarbon = new Map<PathwayId, number>();
  for (const a of allocations) {
    byPathwayCarbon.set(a.pathway, (byPathwayCarbon.get(a.pathway) ?? 0) + a.netCarbonT);
  }
  const topPathway = [...byPathwayCarbon.entries()].sort((a, b) => b[1] - a[1])[0];
  const intensity = totals.divertedT > 0 ? ledger.netT / totals.divertedT : 0;

  const items = [
    {
      label: 'Carbon per tonne',
      value: `${num(intensity, 3)} tCO₂e`,
      detail: `Net impact across ${tonnes(totals.divertedT)} t diverted`,
    },
    positive && {
      label: 'Largest contributor',
      value: positive.label,
      detail: `${num(positive.valueT)} tCO₂e, ${pct((positive.valueT / Math.max(1, terms.filter((t) => t.sign === 'plus').reduce((a, t) => a + t.valueT, 0))) * 100, 0)} of gross benefit`,
    },
    loss && {
      label: 'Largest carbon loss',
      value: loss.label,
      detail: `${num(Math.abs(loss.valueT))} tCO₂e charged against the network`,
    },
    topPathway && {
      label: 'Leading pathway',
      value: pathways[topPathway[0]]?.short ?? topPathway[0],
      detail: `${num(topPathway[1])} tCO₂e net from this route`,
    },
    opportunity && {
      label: 'Biggest opportunity',
      value: opportunity.name,
      detail: `${tonnes(opportunity.tonnes)} t unplaced · best fit ${pathways[opportunity.bestPathway]?.short ?? opportunity.bestPathway}`,
    },
  ].filter(Boolean) as Array<{ label: string; value: string; detail: string }>;

  return (
    <div className="section">
      <SectionHead title="What needs attention" />
      <div className="attn">
        {items.map((it) => (
          <div key={it.label} className="attn-item">
            <div className="attn-label">{it.label}</div>
            <div className="attn-value">{it.value}</div>
            <div className="attn-detail">{it.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Trend and change narrative
// ─────────────────────────────────────────────────────────────────────────────

function Trend({
  history,
  loading,
  error,
}: {
  history: CarbonHistory | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="section">
        <SectionHead title="Over time" />
        <Panel>
          <div className="loadstate">
            <div className="msg">Re-solving the network on each of the last twenty weeks…</div>
          </div>
        </Panel>
      </div>
    );
  }
  if (error || !history) {
    return (
      <div className="section">
        <SectionHead title="Over time" />
        <Panel>
          <p className="muted">The trend could not be computed. {error}</p>
        </Panel>
      </div>
    );
  }

  const scored = history.drivers.filter((d) => d.key !== 'throughput' && Math.abs(d.deltaT) >= 0.5);
  const shift = history.drivers.find((d) => d.key === 'throughput');
  const maxDriver = Math.max(...scored.map((d) => Math.abs(d.deltaT)), 1);

  return (
    <div className="section">
      <SectionHead title="Over time" note={history.basis} />
      <div className="grid g2 trend-grid">
        <Panel title="Net carbon per window">
          <TrendChart points={history.points} weeks={history.period.weeks} />
        </Panel>

        <Panel title="What changed">
          <p className="trend-narrative">{history.narrative}</p>
          {scored.length > 0 && (
            <div className="drivers">
              {scored.map((d) => (
                <div key={d.key} className="driver">
                  <div className="dr-head">
                    <span className="dr-label">{d.label}</span>
                    <span className={`dr-value mono ${d.deltaT >= 0 ? 'pos' : 'neg'}`}>
                      {signed(d.deltaT)}
                    </span>
                  </div>
                  <div className="dr-track">
                    <div className="dr-mid" />
                    <div
                      className={`dr-fill ${d.deltaT >= 0 ? 'pos' : 'neg'}`}
                      style={{
                        width: `${(Math.abs(d.deltaT) / maxDriver) * 50}%`,
                        left: d.deltaT >= 0 ? '50%' : undefined,
                        right: d.deltaT < 0 ? '50%' : undefined,
                      }}
                    />
                  </div>
                  <div className="dr-detail">{d.detail}</div>
                </div>
              ))}
              {shift && <div className="dr-shift">{shift.detail}.</div>}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/** Net carbon over the trailing weeks, with the compared periods shaded. */
function TrendChart({ points, weeks }: { points: CarbonHistoryPoint[]; weeks: number }) {
  const W = 620;
  const H = 200;
  const padL = 46;
  const padR = 10;
  const padT = 12;
  const padB = 26;

  if (points.length < 2) return <p className="muted">Not enough history to draw a trend.</p>;

  const values = points.map((p) => p.netT);
  const lo = Math.min(0, ...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;

  const x = (i: number) => padL + (i / (points.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - lo) / span) * (H - padT - padB);

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.netT).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${y(lo).toFixed(1)} L${x(0).toFixed(1)},${y(lo).toFixed(1)} Z`;

  const curStart = points.length - weeks;
  const prevStart = points.length - 2 * weeks;

  const ticks = [lo, lo + span / 2, hi];

  return (
    <svg className="trendchart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="tc-grid" />
          <text x={padL - 8} y={y(t) + 3} className="tc-tick" textAnchor="end">
            {num(t)}
          </text>
        </g>
      ))}

      {prevStart >= 0 && (
        <rect
          x={x(prevStart)}
          y={padT}
          width={x(curStart) - x(prevStart)}
          height={H - padT - padB}
          className="tc-prev"
        />
      )}
      {curStart >= 0 && (
        <rect
          x={x(curStart)}
          y={padT}
          width={x(points.length - 1) - x(curStart)}
          height={H - padT - padB}
          className="tc-cur"
        />
      )}

      <path d={area} className="tc-area" />
      <path d={line} className="tc-line" />

      {points.map((p, i) => (
        <circle key={p.date} cx={x(i)} cy={y(p.netT)} r={2} className="tc-dot">
          <title>
            {p.date}: {num(p.netT)} tCO₂e · {tonnes(p.divertedT)} t diverted
          </title>
        </circle>
      ))}

      <text x={x(0)} y={H - 8} className="tc-tick" textAnchor="start">
        {points[0].date}
      </text>
      <text x={W - padR} y={H - 8} className="tc-tick" textAnchor="end">
        {points[points.length - 1].date}
      </text>
      {curStart >= 0 && (
        <text x={(x(curStart) + x(points.length - 1)) / 2} y={padT + 12} className="tc-band" textAnchor="middle">
          current
        </text>
      )}
      {prevStart >= 0 && (
        <text x={(x(prevStart) + x(curStart)) / 2} y={padT + 12} className="tc-band" textAnchor="middle">
          previous
        </text>
      )}
    </svg>
  );
}
