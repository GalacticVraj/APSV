/**
 * System & Data — assumptions, factors, models and honest provenance.
 *
 * The assumptions on this page are the *same objects* the maths reads. Changing a
 * slider here changes the model, not a display setting, and the whole network
 * re-solves. That is the point: a model whose assumptions cannot be interrogated
 * and moved is a black box wearing a lab coat.
 */

import { useEffect, useState } from 'react';
import { useTwin } from '../store.tsx';
import {
  DataTable,
  Loading,
  Notice,
  Panel,
  SectionHead,
  Stat,
  StatStrip,
  Tag,
  DecisionBanner,
} from '../components/Primitives.tsx';
import { inr, num, pct } from '../format.ts';
import type { Assumptions } from '../../../engine/src/types.ts';

export default function System() {
  const { boot, state, optimization, setAssumptions, reset, busy } = useTwin();
  const [draft, setDraft] = useState<Partial<Assumptions>>({});

  useEffect(() => {
    if (state) setDraft(state.assumptions);
  }, [state?.version]);

  if (!boot || !state || !optimization) return <Loading message="Loading…" />;

  const meta = boot.reference.assumptionMeta;
  const dirty = Object.keys(meta).some(
    (k) =>
      draft[k as keyof Assumptions] !== undefined &&
      draft[k as keyof Assumptions] !== state.assumptions[k as keyof Assumptions],
  );

  const editable: Array<keyof Assumptions> = [
    'windowDays',
    'soilTempC',
    'cdrPriceInrPerT',
    'vcmPriceInrPerT',
    'dieselPriceInrPerL',
    'circuityFactor',
    'maxHaulKm',
    'gridEfTPerMwh',
    'mcDraws',
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>System &amp; Data</h1>
          <div className="lede">
            Model assumptions, emission factors and provenance. Everything here is read directly by
            the engine — this page cannot drift out of date relative to the maths.
          </div>
        </div>
        <div className="head-actions">
          <Tag tone="green">Engine online</Tag>
          <Tag>seed {state.assumptions.seed}</Tag>
        </div>
      </div>

      <div className="section">
        <DecisionBanner
          badge="Live Model Parameters & Provenance"
          happening={
            <>
              Operating on <strong>{state.assumptions.windowDays}-day planning horizon</strong> at {state.assumptions.soilTempC}°C ambient Indian soil temperature.
            </>
          }
          why="Modifying sliders below directly updates domain parameters and re-solves the mathematical model."
          action="Adjust CDR prices, diesel costs, or haul limits to perform real-time sensitivity analysis."
        />

        <Notice>
          <strong>All demo data is synthetic.</strong> {boot.product.dataNotice}
        </Notice>
      </div>

      <div className="section">
        <SectionHead title="Runtime" />
        <StatStrip>
          <Stat label="Sources" value={num(state.sources.length)} />
          <Stat label="Facilities" value={num(state.facilities.length)} />
          <Stat label="Feasible arcs" value={num(optimization.result.telemetry.arcsFeasible)} />
          <Stat label="Last solve" value={num(optimization.result.telemetry.solveMs)} unit="ms" />
          <Stat
            label="Optimality"
            value={optimization.result.telemetry.provenOptimal ? 'Proven' : 'Bounded'}
            sub={`gap ${optimization.result.telemetry.gapPct.toFixed(3)}%`}
          />
          <Stat label="State version" value={num(state.version)} sub={`${state.appliedScenarios.length} scenarios applied`} />
        </StatStrip>
      </div>

      {/* Assumptions */}
      <div className="section">
        <SectionHead
          title="Model assumptions"
          note="Changing any of these re-solves the entire network"
        />
        <div className="grid g-2-1">
          <Panel title="Editable parameters">
            <div className="grid g2" style={{ gap: '0 20px' }}>
              {editable.map((k) => {
                const m = meta[k];
                if (!m) return null;
                const v = Number(draft[k] ?? state.assumptions[k]);
                return (
                  <div className="field" key={k}>
                    <label htmlFor={`a-${k}`}>
                      {m.label}
                      <span className="val">
                        {num(v, m.step < 1 ? 2 : 0)} {m.unit}
                      </span>
                    </label>
                    <input
                      id={`a-${k}`}
                      type="range"
                      min={m.min}
                      max={m.max}
                      step={m.step}
                      value={v}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [k]: Number(e.target.value) }))
                      }
                    />
                    <div className="hint">{m.note}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button
                className="btn primary"
                disabled={!dirty || !!busy}
                onClick={() => {
                  const patch: Partial<Assumptions> = {};
                  for (const k of editable) {
                    if (draft[k] !== undefined && draft[k] !== state.assumptions[k]) {
                      (patch as Record<string, number>)[k] = Number(draft[k]);
                    }
                  }
                  void setAssumptions(patch);
                }}
              >
                {busy ? 'Recomputing…' : dirty ? 'Apply and re-solve' : 'No changes'}
              </button>
              <button
                className="btn"
                disabled={!dirty}
                onClick={() => setDraft(state.assumptions)}
              >
                Discard
              </button>
              <button className="btn danger" onClick={() => reset()} disabled={!!busy}>
                Reset network
              </button>
            </div>
          </Panel>

          <Panel title="Try this">
            <p style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 10px' }}>
              <strong>Soil temperature.</strong> Drop it from 26 °C to 14.9 °C and watch durable
              removal rise on the Carbon screen. That difference is the Q10 correction — and the
              size of the error that importing a European permanence default would introduce.
            </p>
            <p style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 10px' }}>
              <strong>Durable CDR price.</strong> Push it up and the optimiser starts moving straw
              away from pellet co-firing toward pyrolysis, even under Carbon First — because the
              margin term in the tie-break begins to dominate.
            </p>
            <p style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>
              <strong>Maximum haul.</strong> Shorten it and stranded tonnage rises sharply. The
              network is geography-limited well before it is demand-limited.
            </p>
          </Panel>
        </div>
      </div>

      {/* Factors */}
      <div className="section">
        <SectionHead title="Emission factors" note="Each carries its published uncertainty, used by the Monte Carlo" />
        <Panel flush>
          <DataTable
            rows={boot.reference.emissionFactors}
            rowKey={(f) => f.key}
            columns={[
              { key: 'label', header: 'Factor', render: (f) => <span className="name">{f.label}</span> },
              { key: 'value', header: 'Value', num: true, render: (f) => num(f.value, f.value < 10 ? 3 : 1) },
              { key: 'unit', header: 'Unit', render: (f) => <span className="muted">{f.unit}</span> },
              { key: 'unc', header: '1σ', num: true, render: (f) => (f.uncertaintyPct > 0 ? `±${f.uncertaintyPct}%` : '—') },
              {
                key: 'source',
                header: 'Source',
                render: (f) => (
                  <span className="muted" style={{ fontSize: 11.5 }}>
                    {f.source}
                    {f.note ? ` — ${f.note}` : ''}
                  </span>
                ),
              },
            ]}
          />
        </Panel>
      </div>

      {/* Counterfactuals */}
      <div className="section">
        <SectionHead
          title="Counterfactual fates"
          note="An avoided-emission claim means nothing without one"
        />
        <Panel flush>
          <DataTable
            rows={Object.values(boot.reference.counterfactuals) as any[]}
            rowKey={(c) => c.id}
            columns={[
              { key: 'label', header: 'Fate', render: (c) => <span className="name">{c.label}</span> },
              {
                key: 'v',
                header: 'tCO₂e / t dry',
                num: true,
                render: (c) => num(c.tco2ePerTDry, 3),
              },
              { key: 'unc', header: '1σ', num: true, render: (c) => `±${c.uncertaintyPct}%` },
              {
                key: 'pm',
                header: 'PM₂.₅ kg/t dry',
                num: true,
                render: (c) => (c.pm25KgPerTDry > 0 ? num(c.pm25KgPerTDry, 1) : '—'),
              },
              {
                key: 'basis',
                header: 'Basis',
                render: (c) => (
                  <span className="muted" style={{ fontSize: 11.5 }}>
                    {c.basis}
                  </span>
                ),
              },
            ]}
          />
          <div style={{ padding: '9px 12px', fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.55 }}>
            PM₂.₅ is shown because it is the reason stubble burning is a public-health emergency,
            but it is a health co-benefit and is never converted into CO₂e anywhere in this product.
          </div>
        </Panel>
      </div>

      {/* Models */}
      <div className="section">
        <SectionHead title="Models" />
        <div className="grid g2">
          <Panel title="Optimiser">
            <dl className="kv">
              <dt>Problem class</dt>
              <dd>Capacitated facility location</dd>
              <dt>Relaxation</dt>
              <dd>Min-cost flow (exact)</dd>
              <dt>Shortest path</dt>
              <dd>Johnson potentials + Dijkstra</dd>
              <dt>Integer handling</dt>
              <dd>Branch &amp; bound</dd>
              <dt>Objective</dt>
              <dd>Weighted scalarisation</dd>
              <dt>Determinism</dt>
              <dd>Integer costs, seeded</dd>
            </dl>
            <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 9, lineHeight: 1.5 }}>
              Facility on/off is binary and throughput is semi-continuous — a plant runs above its
              minimum viable feed or not at all. Branching over that decision with an exact inner
              relaxation is what produces a real optimality bound.
            </p>
          </Panel>

          <Panel title="Forecasting">
            <dl className="kv">
              <dt>Model</dt>
              <dd>Ridge regression</dd>
              <dt>Features</dt>
              <dd>3 harmonics + trend + 2 lags</dd>
              <dt>Solver</dt>
              <dd>Cholesky, closed form</dd>
              <dt>Regularisation</dt>
              <dd>λ = 0.35</dd>
              <dt>Training window</dt>
              <dd>104 weeks</dd>
              <dt>Validation</dt>
              <dd>Walk-forward, 12 folds</dd>
            </dl>
            <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 9, lineHeight: 1.5 }}>
              Accuracy is measured rather than asserted. Coefficients are inspectable, which matters
              when someone asks why the forecast says what it says — a gradient-boosted model would
              forecast marginally better and explain itself considerably worse.
            </p>
          </Panel>

          <Panel title="Carbon">
            <dl className="kv">
              <dt>Permanence</dt>
              <dd>Two-pool first-order decay</dd>
              <dt>Temperature correction</dt>
              <dd>Q10 (Woolf 2021)</dd>
              <dt>Reference dataset</dt>
              <dd>Azzi 2024, 14.9 °C</dd>
              <dt>Local soil temperature</dt>
              <dd>{state.assumptions.soilTempC} °C</dd>
              <dt>Uncertainty</dt>
              <dd>Monte Carlo, {num(state.assumptions.mcDraws)} draws</dd>
              <dt>Distribution</dt>
              <dd>Lognormal per factor</dd>
            </dl>
          </Panel>

          <Panel title="Routing">
            <dl className="kv">
              <dt>Construction</dt>
              <dd>Clarke–Wright savings</dd>
              <dt>Improvement</dt>
              <dd>Or-opt relocation</dd>
              <dt>Capacity</dt>
              <dd>Mass and volume, both binding</dd>
              <dt>Tours</dt>
              <dd>Closed, return to facility</dd>
              <dt>Distance</dt>
              <dd>Haversine × circuity {state.assumptions.circuityFactor}</dd>
              <dt>Empty return burn</dt>
              <dd>78% of laden</dd>
            </dl>
          </Panel>
        </div>
      </div>

      <div className="section">
        <SectionHead title="Honest limitations" />
        <Panel>
          <ul style={{ margin: 0, paddingLeft: 17, fontSize: 12.5, lineHeight: 1.7 }}>
            <li>
              Road distances are great-circle distances scaled by a circuity factor, not routed over
              a road network. Real routing would change individual haul distances by a few percent
              and would not change which facility wins an arc.
            </li>
            <li>
              Supply history is synthetic, generated from a documented crop calendar with an AR(1)
              weather shock. The forecast model is real and its accuracy is honestly measured, but
              it is measured against generated data.
            </li>
            <li>
              Facility capacities, costs and locations are plausible but invented. No claim is made
              about any real operator.
            </li>
            <li>
              The carbon ledger is an operating-period account. It excludes embodied carbon of the
              plant, which is correct for allocation decisions and incorrect for a full life-cycle
              assessment.
            </li>
            <li>
              Biochar permanence is modelled, not measured. The model form and the Q10 relation are
              taken from peer-reviewed work, but a real carbon credit would require analysis of the
              actual char.
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
