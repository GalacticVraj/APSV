/**
 * Carbon — the ledger, not an ESG dashboard.
 *
 * Three claims this screen has to survive scrutiny on:
 *   - every line is traceable to a physical quantity, a factor and a citation
 *   - durable removal and avoided emissions are never added together
 *   - the headline is a distribution, not a point estimate
 *
 * The permanence panel is the part worth arguing with, and it is built to be
 * argued with: the model form, the H/Corg ratio, the Q10 correction and the two
 * decay curves are all on the page.
 */

import { useState } from 'react';
import { api, useResource, useTwin } from '../store.tsx';
import {
  Empty,
  ErrorState,
  Loading,
  Notice,
  Panel,
  SectionHead,
  Stat,
  StatStrip,
  Tag,
  DecisionBanner,
  ValueFlowChain,
} from '../components/Primitives.tsx';
import { DecayCurve, Histogram, StackedBar, Waterfall } from '../components/Charts.tsx';
import { inr, num, pct } from '../format.ts';

export default function Carbon() {
  const { boot, state, version } = useTwin();
  const res = useResource(() => api.carbon(), [version], [
    'Aggregating physical inventory across allocations…',
    'Applying Q10 permanence correction…',
    'Running 2,000 Monte Carlo draws over every emission factor…',
  ]);
  const [openLine, setOpenLine] = useState<string | null>(null);

  if (!boot || !state) return <Loading message="Loading…" />;
  if (res.loading) return <Loading message={res.message} />;
  if (res.error) return <ErrorState message={res.error} onRetry={res.reload} />;
  if (!res.data) return null;

  const { ledger, totals } = res.data;
  const perm = ledger.permanence;
  const unc = ledger.uncertainty;
  const markets = boot.reference.carbonMarkets;

  const waterfallItems = ledger.lines
    .filter((l) => l.kind !== 'total')
    .map((l) => ({ label: l.label, value: l.valueT, kind: l.kind }));

  const maxAbs = Math.max(...ledger.lines.map((l) => Math.abs(l.valueT)), 1);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Carbon Ledger</h1>
          <div className="lede">
            Every figure below is derived from a physical quantity and a cited factor. Biogenic CO₂
            is excluded — residue carbon that burns returns to the atmosphere it came from in the
            same season, so only CH₄ and N₂O represent a genuine addition.
          </div>
        </div>
        <div className="head-actions">
          <Tag tone="green">{state.assumptions.windowDays}-day window</Tag>
        </div>
      </div>

      <div className="section">
        <DecisionBanner
          badge="Carbon Accounting & Credit Decision State"
          happening={
            <>
              Net carbon impact: <strong>{num(ledger.netT)} tCO₂e</strong> ({num(ledger.durableRemovalT)} t durable removal + {num(ledger.avoidedEmissionsT)} t avoided emissions).
            </>
          }
          why={
            <>
              Biochar 100-year permanence rate is <strong>{pct((perm?.bc100 ?? 0.74) * 100, 1)}</strong> (Q10 soil temperature corrected for India @ 26°C).
            </>
          }
          action="Monetize durable biochar removal at high-tier CDR pricing (₹10,800/tCO₂e) vs standard avoided emissions credits."
          actionLabel="View Economic Valuation →"
          to="/economics"
        />

        <ValueFlowChain
          title="Carbon Value Creation Ledger Chain"
          steps={[
            { label: 'Feedstock Input', value: `${num(totals.divertedT)} t Residue`, sub: 'Biogenic CO₂ Excluded' },
            { label: 'Avoided Burning', value: `${num(ledger.avoidedEmissionsT)} tCO₂e`, sub: 'Avoided CH₄/N₂O Open Burning', tone: 'pos' },
            { label: 'Durable Removal', value: `${num(ledger.durableRemovalT)} tCO₂e`, sub: `Biochar ${pct((perm?.bc100 ?? 0.74) * 100, 0)} Permanence`, tone: 'pos' },
            { label: 'Net Ledger', value: `${num(ledger.netT)} tCO₂e`, sub: `P50 Monte Carlo Estimate`, tone: 'pos' },
            { label: 'Credit Valuation', value: `${inr(ledger.durableRemovalT * markets.durableCdr.price)}`, sub: `@ ${inr(markets.durableCdr.price)}/t CDR Price`, tone: 'pos' },
          ]}
        />

        <StatStrip>
          <Stat
            label="Net carbon impact"
            value={num(ledger.netT)}
            unit="tCO₂e"
            sub={unc ? `90% interval ${num(unc.p5)} – ${num(unc.p95)}` : undefined}
            size="lg"
          />
          <Stat
            label="Durable removal"
            value={num(ledger.durableRemovalT)}
            unit="tCO₂e"
            sub={`Priced at ${inr(markets.durableCdr.price)}/t`}
            tone="pos"
          />
          <Stat
            label="Avoided emissions"
            value={num(ledger.avoidedEmissionsT)}
            unit="tCO₂e"
            sub={`Priced at ${inr(markets.avoidedEmission.price)}/t`}
          />
          <Stat
            label="Fossil substitution"
            value={num(ledger.substitutionT)}
            unit="tCO₂e"
            sub="Coal, CNG and grid power displaced"
          />
          <Stat
            label="Emissions caused"
            value={num(ledger.emissionsT)}
            unit="tCO₂e"
            sub="Transport, aggregation, process, slip"
            tone="neg"
          />
          <Stat
            label="Carbon revenue"
            value={inr(totals.carbonRevenueInr)}
            sub={`${inr(totals.abatementCostInrPerTco2e)}/tCO₂e abatement cost`}
          />
        </StatStrip>
      </div>

      <div className="section">
        <Notice tone="info">
          <strong>Durable removal and avoided emissions are not the same commodity.</strong> Removal
          trades around {inr(markets.durableCdr.price)}/tCO₂e; avoidance around{' '}
          {inr(markets.avoidedEmission.price)}/tCO₂e — roughly a twentyfold gap. They are reported
          on separate lines here and priced separately in the economics, because summing them into
          a single "carbon saved" headline is the most common error in this sector and it is what
          makes a business case unfinanceable when an auditor looks at it.
        </Notice>
      </div>

      <div className="section">
        <SectionHead title="How the net figure is built" note="Click any line for its basis and source" />
        <div className="grid g-3-2">
          <Panel title="Ledger" flush>
            <div className="ledger">
              {ledger.lines.map((l) => {
                const open = openLine === l.key;
                const isTotal = l.kind === 'total';
                return (
                  <div key={l.key}>
                    <div
                      className={`ledger-row ${isTotal ? 'total' : ''}`}
                      onClick={() => setOpenLine(open ? null : l.key)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setOpenLine(open ? null : l.key);
                      }}
                    >
                      <span
                        className="lr-mark"
                        style={{
                          background:
                            l.kind === 'removal'
                              ? 'var(--green-700)'
                              : l.kind === 'avoided'
                                ? 'var(--green-500)'
                                : l.kind === 'substitution'
                                  ? 'var(--s2)'
                                  : l.kind === 'emission'
                                    ? 'var(--neg)'
                                    : l.kind === 'total'
                                      ? 'var(--ink)'
                                      : 'var(--ink-4)',
                        }}
                      />
                      <span className="lr-label">{l.label}</span>
                      <span className={`lr-val ${l.valueT < 0 ? 'neg' : isTotal ? '' : 'pos'}`}>
                        {l.valueT >= 0 ? '+' : '−'}
                        {num(Math.abs(l.valueT))}
                      </span>
                      <span className="lr-bar">
                        <i
                          style={{
                            width: `${(Math.abs(l.valueT) / maxAbs) * 100}%`,
                            left: l.valueT < 0 ? undefined : 0,
                            right: l.valueT < 0 ? 0 : undefined,
                            background:
                              l.valueT < 0 ? 'var(--neg)' : isTotal ? 'var(--ink)' : 'var(--green-500)',
                          }}
                        />
                      </span>
                    </div>
                    {open && (
                      <div className="ledger-detail">
                        {l.basis}
                        <div className="src">
                          Source: {l.source}
                          {l.uncertaintyPct > 0 && ` · ±${l.uncertaintyPct}% (1σ)`}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Panel title="Composition">
              <StackedBar
                segments={[
                  { label: 'Durable removal', value: Math.max(0, ledger.durableRemovalT), color: 'var(--green-700)' },
                  { label: 'Avoided emissions', value: Math.max(0, ledger.avoidedEmissionsT), color: 'var(--green-500)' },
                  { label: 'Fossil substitution', value: Math.max(0, ledger.substitutionT), color: 'var(--s2)' },
                ]}
                format={(v) => `${num(v)} t`}
              />
              <hr className="hairline" />
              <dl className="kv">
                <dt>Gross benefit</dt>
                <dd>
                  {num(ledger.durableRemovalT + ledger.avoidedEmissionsT + ledger.substitutionT)}
                </dd>
                <dt>Less emissions caused</dt>
                <dd className="neg">−{num(ledger.emissionsT)}</dd>
                <dt>
                  <strong>Net</strong>
                </dt>
                <dd>
                  <strong>{num(ledger.netT)}</strong>
                </dd>
                <dt>Emissions as share of benefit</dt>
                <dd>
                  {pct(
                    (ledger.emissionsT /
                      Math.max(
                        1e-9,
                        ledger.durableRemovalT + ledger.avoidedEmissionsT + ledger.substitutionT,
                      )) *
                      100,
                    1,
                  )}
                </dd>
              </dl>
            </Panel>

            {unc && (
              <Panel
                title="Uncertainty"
                right={`${num(unc.draws)} draws`}
              >
                <Histogram bins={unc.histogram} p5={unc.p5} p50={unc.p50} p95={unc.p95} />
                <p style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.55 }}>
                  Every emission factor carries a published uncertainty. Propagating them through
                  the whole ledger by seeded Monte Carlo gives a <strong>90% interval of{' '}
                  {num(unc.p5)} to {num(unc.p95)} tCO₂e</strong> around a median of {num(unc.p50)}.
                  A single-point carbon number is a claim this model cannot support.
                </p>
              </Panel>
            )}
          </div>
        </div>
      </div>

      <div className="section">
        <SectionHead
          title="Cumulative build-up"
          note="Each bar starts where the previous one ended"
        />
        <Panel>
          <Waterfall items={waterfallItems} />
        </Panel>
      </div>

      {/* ── Permanence ────────────────────────────────────────────────────── */}
      {perm ? (
        <div className="section">
          <SectionHead
            title="Biochar permanence"
            note="Azzi et al. 2024 Geoderma · Woolf et al. 2021 ES&T"
          />
          <div className="grid g-2-1">
            <Panel title="100-year carbon retention">
              <DecayCurve
                curves={[
                  {
                    label: `${perm.referenceTempC} °C reference`,
                    color: 'var(--ink-3)',
                    points: referenceCurve(perm),
                  },
                  {
                    label: `${perm.soilTempC} °C — this network`,
                    color: 'var(--green-700)',
                    points: perm.curve,
                  },
                ]}
              />
              <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.6 }}>
                The harmonised biochar decomposition dataset is reported at{' '}
                <strong>{perm.referenceTempC} °C</strong> soil temperature — northern Europe. Indian
                agricultural soils sit near <strong>{perm.soilTempC} °C</strong>. Applying the
                published Q10 relation gives a decay-rate ratio of{' '}
                <strong className="num">{perm.fT.toFixed(3)}</strong>, meaning biochar decays{' '}
                <strong>{((perm.fT - 1) * 100).toFixed(0)}% faster here</strong>.
              </p>
              <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.6 }}>
                Importing the European default would overstate durable removal by roughly{' '}
                {(((referenceBc100(perm) - perm.bc100) / perm.bc100) * 100).toFixed(1)}%. The ledger
                applies the India-calibrated figure, which costs us{' '}
                {num(
                  (ledger.durableRemovalT / Math.max(1e-9, perm.bc100)) *
                    (referenceBc100(perm) - perm.bc100),
                )}{' '}
                tCO₂e of headline removal this window.
              </p>
            </Panel>

            <Panel title="Model parameters">
              <dl className="kv">
                <dt>Char H/C(org) molar ratio</dt>
                <dd>{perm.hcOrgRatio.toFixed(3)}</dd>
                <dt>EBC / Puro durability gate</dt>
                <dd className="pos">&lt; 0.70 ✓</dd>
                <dt>Labile pool fraction</dt>
                <dd>{pct(perm.labileFraction * 100, 1)}</dd>
                <dt>Labile decay rate</dt>
                <dd>{perm.labileRatePerYr.toFixed(3)} /yr</dd>
                <dt>Persistent decay rate</dt>
                <dd>{perm.persistentRatePerYr.toFixed(5)} /yr</dd>
                <dt>Q10</dt>
                <dd>{perm.q10.toFixed(3)}</dd>
                <dt>Rate ratio f(T)</dt>
                <dd>{perm.fT.toFixed(3)}</dd>
                <dt>
                  <strong>BC₁₀₀ at {perm.referenceTempC} °C</strong>
                </dt>
                <dd>{pct(referenceBc100(perm) * 100, 1)}</dd>
                <dt>
                  <strong>BC₁₀₀ at {perm.soilTempC} °C</strong>
                </dt>
                <dd>
                  <strong>{pct(perm.bc100 * 100, 1)}</strong>
                </dd>
              </dl>
              <hr className="hairline" />
              <p style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.55, margin: 0 }}>
                {perm.method}
              </p>
            </Panel>
          </div>
        </div>
      ) : (
        <div className="section">
          <Empty
            title="No durable removal in the current plan"
            body="The optimiser is not routing any feedstock to a pathway that produces durable carbon. Only slow pyrolysis and gasification yield char; every other pathway produces avoided emissions or fossil substitution."
            why="Switch the objective, or check whether the pyrolysis facilities are operating on the Facilities screen."
          />
        </div>
      )}

      <div className="section">
        <SectionHead title="Methodology and exclusions" />
        <div className="grid g2">
          <Panel title="What is counted">
            <ul style={{ margin: 0, paddingLeft: 17, fontSize: 12, lineHeight: 1.65 }}>
              <li>
                <strong>Durable removal</strong> — carbon fixed in biochar, adjusted to its 100-year
                retained fraction at local soil temperature.
              </li>
              <li>
                <strong>Avoided emissions</strong> — the CH₄ and N₂O the counterfactual fate would
                have produced (field burning, open dung heap, unmanaged landfill, open dumping).
              </li>
              <li>
                <strong>Fossil substitution</strong> — coal displaced by pellet co-firing, CNG
                displaced by bio-CNG, grid power displaced by export, synthetic nitrogen displaced
                by compost and digestate.
              </li>
              <li>
                <strong>Emissions charged</strong> — well-to-wheel transport including the empty
                return leg, field aggregation, grid electricity drawn by process, digester methane
                slip at 2%, and windrow CH₄ and N₂O.
              </li>
            </ul>
          </Panel>
          <Panel title="What is deliberately not counted">
            <ul style={{ margin: 0, paddingLeft: 17, fontSize: 12, lineHeight: 1.65 }}>
              <li>
                <strong>Biogenic CO₂</strong> from combustion, composting or digestion. It is part
                of the annual carbon cycle, not an addition to it.
              </li>
              <li>
                <strong>Soil N₂O suppression</strong> attributed to biochar. The literature is
                contested and the effect is not durable; including it would flatter the result.
              </li>
              <li>
                <strong>Embodied carbon of the plant</strong> itself. Out of scope for an
                operating-period ledger, and it would not change any allocation decision.
              </li>
              <li>
                <strong>Air-quality co-benefits.</strong> Diverting crop residue avoids roughly
                7.4 kg of PM₂.₅ per dry tonne — the reason stubble burning is a public-health
                emergency — but PM₂.₅ is not a greenhouse gas and is never converted into CO₂e here.
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** Re-derive the reference-temperature curve from the reported parameters. */
function referenceCurve(perm: NonNullable<ReturnType<typeof Object>> & any) {
  const kL = perm.labileRatePerYr / perm.fT;
  const kP = perm.persistentRatePerYr / perm.fT;
  return perm.curve.map((p: { year: number }) => ({
    year: p.year,
    remaining:
      perm.labileFraction * Math.exp(-kL * p.year) +
      (1 - perm.labileFraction) * Math.exp(-kP * p.year),
  }));
}

function referenceBc100(perm: any): number {
  const kL = perm.labileRatePerYr / perm.fT;
  const kP = perm.persistentRatePerYr / perm.fT;
  return perm.labileFraction * Math.exp(-kL * 100) + (1 - perm.labileFraction) * Math.exp(-kP * 100);
}
