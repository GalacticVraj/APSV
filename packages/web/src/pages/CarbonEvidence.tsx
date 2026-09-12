/**
 * Carbon Evidence (MRV) — defend the basis.
 *
 * Carbon Home understands the impact. The Ledger traces it. This page asks the
 * question a sceptic asks third: on what basis is any of it asserted.
 *
 * It is deliberately plainer than the rest of Carbon. No hero figure, no chart
 * that could be mistaken for a claim, no badge. Type, rules and status words —
 * because the subject is precision, and a page about evidence that looks like a
 * marketing dashboard has already lost the argument.
 *
 * Two things it must never do, and both are enforced in the engine rather than by
 * discipline here: report a measurement this dataset does not contain, and invent
 * a trust score. What it can do honestly is classify each *input* — published
 * citation, stated modelling assumption, or model-derived quantity — and let the
 * reader walk a number backwards to the allocations that produced it.
 *
 * Every screen in Carbon joins on the ledger line key, so a number opened here is
 * the same number the Ledger, Pathways and Facilities show. One number, one
 * calculation, one trace.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, useResource, useTwin } from '../store.tsx';
import { exportCsv } from '../download.ts';
import { useCarbonExport } from '../components/CarbonExport.tsx';
import { ErrorState, Loading, Panel, SectionHead } from '../components/Primitives.tsx';
import { Link, useRouter } from '../router.tsx';
import { dateFull, num, pct, timeShort } from '../format.ts';
import type {
  EvidenceHealth,
  EvidenceInput,
  EvidenceRecord,
  LineContributor,
  ModelBasis,
} from '../../../engine/src/evidence.ts';

const BASIS_LABEL: Record<string, string> = {
  referenced: 'Published factor',
  assumption: 'Model assumption',
  derived: 'Model-derived quantity',
};

/** Plural forms for the count chips, which read as prose rather than as labels. */
const BASIS_PLURAL: Record<string, string> = {
  referenced: 'published factors',
  assumption: 'model assumptions',
  derived: 'model-derived quantities',
};

export default function CarbonEvidence() {
  const { boot, state, version } = useTwin();
  const { navigate, search } = useRouter();
  const ev = useResource(() => api.evidence(), [version], [
    'Building a ledger per allocation to count contributors…',
  ]);

  // A ledger line can be handed in from any other Carbon screen.
  const linked = useMemo(() => new URLSearchParams(search).get('line'), [search]);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    if (linked) setOpenKey(linked);
  }, [linked]);

  const follow = useCallback(
    (sourceId: string, facilityId: string) => {
      navigate(
        `/carbon/ledger?source=${encodeURIComponent(sourceId)}&facility=${encodeURIComponent(facilityId)}`,
      );
    },
    [navigate],
  );

  // Before the early returns — hooks cannot run conditionally. This is the one
  // export a reviewer actually asks for: every figure with its calculation, its
  // citation and its uncertainty, in one file.
  const evRecords = ev.data?.records;
  useCarbonExport(
    evRecords && state
      ? {
          label: `evidence register (${evRecords.length})`,
          run: () =>
            exportCsv(
              evRecords,
              [
                { header: 'Key', value: (r) => r.key },
                { header: 'Figure', value: (r) => r.label },
                { header: 'Value', value: (r) => r.valueT.toFixed(3) },
                { header: 'Unit', value: (r) => r.unit },
                { header: 'Kind', value: (r) => r.kind },
                { header: 'Status', value: (r) => r.status },
                { header: 'Calculation', value: (r) => r.calculation },
                { header: 'Source', value: (r) => r.source },
                { header: 'Uncertainty %', value: (r) => r.uncertaintyPct },
                { header: 'Inputs', value: (r) => r.inputs.length },
                { header: 'Contributing allocations', value: (r) => r.contributorCount },
              ],
              {
                title: 'Carbon evidence register',
                asOf: state.asOf,
                windowDays: state.assumptions.windowDays,
                objective: state.objective,
                twinVersion: version,
                notes: [
                  'Status "modelled" means derived, not measured. Nothing here is verified or certified.',
                ],
              },
            ),
        }
      : null,
    [evRecords, state, version],
  );

  if (!boot || !state) return <Loading message="Loading…" />;
  if (ev.loading) return <Loading message={ev.message} />;
  if (ev.error) return <ErrorState message={ev.error} onRetry={ev.reload} />;
  if (!ev.data) return null;

  const { records, health, basis } = ev.data;
  const open = openKey ? records.find((r) => r.key === openKey) ?? null : null;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Carbon Evidence</h1>
          <div className="lede">
            Every carbon figure in this system is a model output. This page says what each one was
            built from, which allocations produced it, and where the factors came from — so the
            basis can be inspected rather than taken on trust.
          </div>
        </div>
      </div>

      <Health health={health} />

      <ModelBasisPanel basis={basis} events={state.events ?? []} />

      <div className="section">
        <SectionHead
          title="Evidence register"
          note="Every line of the current network ledger · select one to inspect its basis"
        />
        <div className={`ev-split ${open ? 'with-panel' : ''}`}>
          <Register records={records} openKey={openKey} onOpen={setOpenKey} />
          {open && (
            <RecordDetail
              record={open}
              version={version}
              onClose={() => setOpenKey(null)}
              onFollow={follow}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deliberately not a score.
 *
 * Nothing defensible can be compressed into "87% trustworthy", so this counts what
 * is countable and says the rest in a sentence. The zero counts are the point: a
 * page about evidence has to be willing to print zeros.
 */
function Health({ health }: { health: EvidenceHealth }) {
  const statuses: Array<{ k: keyof EvidenceHealth['byStatus']; label: string; note: string }> = [
    { k: 'measured', label: 'Measured', note: 'Observed in the field' },
    { k: 'estimated', label: 'Estimated', note: 'Inferred from partial information' },
    { k: 'modelled', label: 'Modelled', note: 'Produced by the carbon model' },
    { k: 'missing', label: 'Missing', note: 'Required input unavailable' },
  ];

  return (
    <div className="section">
      <div className="evhealth">
        <div className="evh-counts">
          {statuses.map((s) => {
            const n = health.byStatus[s.k];
            return (
              <div key={s.k} className={`evh-item ${n > 0 ? 'has' : 'zero'} k-${s.k}`}>
                <span className="evh-n">{n}</span>
                <span className="evh-label">{s.label}</span>
                <span className="evh-note">{s.note}</span>
              </div>
            );
          })}
        </div>

        <div className="evh-text">
          <p>{health.statement}</p>
          <div className="evh-inputs">
            {(['referenced', 'assumption', 'derived'] as const).map((b) => (
              <span key={b} className={`evh-chip b-${b}`}>
                <span className="mono">{health.inputsByBasis[b]}</span>{' '}
                {health.inputsByBasis[b] === 1 ? BASIS_LABEL[b].toLowerCase() : BASIS_PLURAL[b]}
              </span>
            ))}
          </div>
          <p className="evh-gap">{health.gapStatement}</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Model basis and timeline
// ─────────────────────────────────────────────────────────────────────────────

function ModelBasisPanel({
  basis,
  events,
}: {
  basis: ModelBasis;
  events: Array<{ id: string; ts: string; kind: string; title: string; detail: string }>;
}) {
  const rows: Array<[string, string]> = [
    ['Planning window', `${basis.windowDays} days to ${dateFull(basis.asOf)}`],
    ['Objective', basis.objective.replace(/_/g, ' ')],
    ['Twin version', `v${basis.version}`],
    ['Sources', `${num(basis.sourceCount)} in the network`],
    ['Facility estate', `${basis.facilitiesOnline} of ${basis.facilitiesTotal} online`],
    ['Supply offered', `${num(basis.suppliedT)} t`],
    ['Placed', `${num(basis.divertedT)} t · ${num(basis.strandedT)} t stranded`],
    ['Soil temperature', `${num(basis.assumptions.soilTempC, 1)} °C for permanence`],
    ['Grid factor', `${num(basis.assumptions.gridEfTPerMwh, 3)} tCO₂e/MWh`],
    ['Monte Carlo draws', num(basis.assumptions.mcDraws)],
    ['Seed', num(basis.assumptions.seed)],
  ];

  return (
    <div className="section">
      <SectionHead title="Model basis" note="The conditions these numbers were produced under" />
      <div className="grid g2 evbasis">
        <Panel>
          <dl className="evb-list">
            {rows.map(([k, v]) => (
              <div key={k} className="evb-row">
                <dt>{k}</dt>
                <dd className="mono">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="evb-statements">
            <p>
              <strong>Supply</strong> {basis.supplyBasis}
            </p>
            <p>
              <strong>Estate</strong> {basis.estateBasis}
            </p>
            <p className="evb-result">
              <strong>Result</strong> {basis.resultBasis}
            </p>
          </div>
        </Panel>

        <Panel title="Audit timeline">
          {events.length === 0 ? (
            <p className="muted">
              No timestamped events recorded for this twin yet. Nothing is being withheld — the log
              is genuinely empty.
            </p>
          ) : (
            <ol className="evtime">
              {events.slice(0, 12).map((e) => (
                <li key={e.id} className={`evt-item k-${e.kind}`}>
                  <span className="evt-ts mono">{timeShort(e.ts)}</span>
                  <span className="evt-body">
                    <span className="evt-title">{e.title}</span>
                    <span className="evt-detail">{e.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <div className="evt-note">
            Events carry the timestamps the twin actually recorded. No history is reconstructed for
            periods the twin did not run.
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Register
// ─────────────────────────────────────────────────────────────────────────────

function Register({
  records,
  openKey,
  onOpen,
}: {
  records: EvidenceRecord[];
  openKey: string | null;
  onOpen: (k: string | null) => void;
}) {
  if (records.length === 0) {
    return (
      <Panel>
        <div className="empty">
          <h4>No carbon records in this plan</h4>
          <p>
            The optimiser placed no material, so the ledger produced no lines. There is nothing to
            evidence rather than evidence that is missing.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel flush>
      <div className="evreg">
        <div className="evr-head">
          <span>Carbon record</span>
          <span className="r">Value</span>
          <span>Status</span>
          <span className="r">Inputs</span>
          <span className="r">Arcs</span>
        </div>
        {records.map((r) => (
          <button
            key={r.key}
            className={`evr-row ${openKey === r.key ? 'on' : ''}`}
            onClick={() => onOpen(openKey === r.key ? null : r.key)}
          >
            <span className="evr-main">
              <span className="evr-label">{r.label}</span>
              <span className="evr-kind">{r.kind}</span>
            </span>
            <span className={`evr-val mono ${r.valueT >= 0 ? 'pos' : 'neg'}`}>
              {r.valueT >= 0 ? '+' : '−'}
              {num(Math.abs(r.valueT))}
              <span className="evr-unit">{r.unit}</span>
            </span>
            <span className="evr-status">
              <span className={`st st-${r.status}`}>{r.status}</span>
            </span>
            <span className="evr-inputs mono">
              {r.hasProvenance ? r.inputs.length : <span className="warnc">none</span>}
            </span>
            <span className="evr-arcs mono">{r.contributorCount}</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail
// ─────────────────────────────────────────────────────────────────────────────

function RecordDetail({
  record,
  version,
  onClose,
  onFollow,
}: {
  record: EvidenceRecord;
  version: number;
  onClose: () => void;
  onFollow: (sourceId: string, facilityId: string) => void;
}) {
  const [tracing, setTracing] = useState(false);
  const contributors = useResource(
    () =>
      tracing
        ? api.lineContributors(record.key)
        : Promise.resolve({ line: record.key, contributors: [], note: null }),
    [version, record.key, tracing],
    ['Rebuilding a ledger per allocation…'],
  );

  // Opening a different record closes the trace: it belongs to the old line.
  useEffect(() => {
    setTracing(false);
  }, [record.key]);

  return (
    <aside className="evdetail">
      <header className="evd-head">
        <div>
          <div className="evd-kind">{record.kind}</div>
          <h3>{record.label}</h3>
        </div>
        <button className="evd-close" onClick={onClose} aria-label="Close evidence">
          ×
        </button>
      </header>

      <div className="evd-value">
        <span className={`evd-num mono ${record.valueT >= 0 ? 'pos' : 'neg'}`}>
          {record.valueT >= 0 ? '+' : '−'}
          {num(Math.abs(record.valueT))}
        </span>
        <span className="evd-unit">{record.unit}</span>
        <span className={`st st-${record.status} evd-st`}>{record.status}</span>
      </div>

      <section className="evd-block">
        <h4>Calculation</h4>
        <p className="evd-calc mono">{record.calculation}</p>
        <p className="evd-hint">
          This is the calculation the engine itself states for this line — the same string the
          Carbon Ledger shows under “Why this number?”. It is not a restatement written for this
          page.
        </p>
      </section>

      <section className="evd-block">
        <h4>Inputs</h4>
        {!record.hasProvenance ? (
          <div className="evd-missing">
            <strong>No inputs recorded for this line.</strong>
            <p>
              The calculation basis above is still authoritative; what is absent is the itemised
              breakdown. That gap is shown rather than filled.
            </p>
          </div>
        ) : (
          <ul className="evd-inputs">
            {record.inputs.map((i: EvidenceInput) => (
              <li key={i.input} className={`evd-in b-${i.basis}`}>
                <span className="ei-top">
                  <span className="ei-name">{i.input}</span>
                  <span className="ei-val mono">
                    {num(i.value, i.value !== 0 && Math.abs(i.value) < 100 ? 3 : 0)}{' '}
                    <span className="ei-unit">{i.unit}</span>
                  </span>
                </span>
                {i.factor && <span className="ei-factor">{i.factor}</span>}
                <span className="ei-foot">
                  <span className={`ei-basis b-${i.basis}`}>{BASIS_LABEL[i.basis]}</span>
                  {i.factorSource ? (
                    <span className="ei-src">{i.factorSource}</span>
                  ) : (
                    <span className="ei-src muted">
                      Produced by the network model; no external reference applies.
                    </span>
                  )}
                  {i.uncertaintyPct !== null && i.uncertaintyPct > 0 && (
                    <span className="ei-unc mono">±{i.uncertaintyPct}%</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="evd-block">
        <h4>Source</h4>
        <p className="evd-source">{record.source}</p>
        <p className="evd-hint">
          Published uncertainty on this line is ±{record.uncertaintyPct}% at one sigma, propagated
          into the network band by Monte Carlo over every factor at once.
        </p>
      </section>

      <section className="evd-block evd-trace">
        <h4>Trace to source</h4>
        {!tracing && (
          <>
            <p className="evd-hint">
              {record.contributorCount === 0
                ? 'No allocation in the current plan contributes to this line.'
                : `${record.contributorCount} allocation${record.contributorCount > 1 ? 's' : ''} in the current plan produce this figure.`}
            </p>
            {record.contributorCount > 0 && (
              <button className="btn sm primary" onClick={() => setTracing(true)}>
                Trace to source
              </button>
            )}
          </>
        )}

        {tracing && contributors.loading && <p className="muted">{contributors.message}</p>}
        {tracing && contributors.error && <p className="neg">{contributors.error}</p>}
        {tracing && contributors.data && (
          <>
            <div className="evd-contrib">
              {contributors.data.contributors.map((c: LineContributor) => (
                <button
                  key={`${c.sourceId}-${c.facilityId}`}
                  className="evc-row"
                  onClick={() => onFollow(c.sourceId, c.facilityId)}
                  title="Follow this contribution forward in the Carbon Ledger"
                >
                  <span className="evc-main">
                    <span className="evc-src">{c.sourceName}</span>
                    <span className="evc-sub">
                      {c.streamLabel} → {c.facilityName} · {c.pathwayShort} · {num(c.distanceKm)} km
                    </span>
                  </span>
                  <span className="evc-bar">
                    <span
                      className="evc-fill"
                      style={{ width: `${Math.min(100, Math.abs(c.sharePct))}%` }}
                    />
                  </span>
                  <span className="evc-nums">
                    <span className={`mono ${c.valueT >= 0 ? 'pos' : 'neg'}`}>
                      {num(c.valueT)}
                    </span>
                    <span className="evc-share mono">{pct(Math.abs(c.sharePct), 1)}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="evd-hint">
              Each row is that allocation run through the network's own ledger function and read at
              this line key, so the contributions sum to the figure above rather than approximating
              it. Select one to follow it forward through haulage and conversion in the Ledger.
            </p>
          </>
        )}
      </section>

      <div className="evd-links">
        <Link to="/carbon/ledger" className="btn sm">
          Open in Ledger
        </Link>
        <Link to="/carbon/facilities" className="btn sm">
          By facility
        </Link>
      </div>

      <div className="evd-status">
        <span className="q-tag">Modelled estimate</span>
        Not measured, not verified, and not a carbon credit.
      </div>
    </aside>
  );
}
