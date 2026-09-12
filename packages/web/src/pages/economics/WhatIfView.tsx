import { useState } from 'react';
import { MetricCard } from './KPICard.tsx';
import { InfoIcon } from './InfoIcon.tsx';
import { inr, num } from '../../format.ts';
import type { Assumptions, NetworkTotals } from '../../../../engine/src/types.ts';
import { triggerPrint, saveReportRecord } from './ReportHelpers.ts';

type AssumptionKey = keyof Assumptions;

interface SliderDef {
  key: AssumptionKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  description: string;
  tip: string;
}

const SLIDERS: SliderDef[] = [
  {
    key: 'dieselPriceInrPerL',
    label: 'Diesel Price',
    unit: '₹/L',
    min: 60, max: 160, step: 1,
    description: 'Affects logistics cost. Higher diesel = more expensive to move waste further.',
    tip: 'Transport cost is a linear function of distance × diesel price × fuel efficiency. Raising this tightens the economic haul radius.',
  },
  {
    key: 'cdrPriceInrPerT',
    label: 'Durable CDR Credit Price',
    unit: '₹/tCO₂e',
    min: 3000, max: 30000, step: 500,
    description: 'The price paid for verified durable carbon removal — mainly benefits pyrolysis biochar.',
    tip: 'Durable Carbon Dioxide Removal (CDR) credits are higher-value than avoided emissions because they represent permanent sequestration.',
  },
  {
    key: 'vcmPriceInrPerT',
    label: 'Avoided Emissions Credit (VCM)',
    unit: '₹/tCO₂e',
    min: 200, max: 5000, step: 100,
    description: 'Price for avoided-emission credits. Benefits composting and anaerobic digestion most.',
    tip: 'Voluntary Carbon Market (VCM) credits for avoided emissions trade at a discount to durable removal because they are not permanent.',
  },
  {
    key: 'maxHaulKm',
    label: 'Max Economic Haul Distance',
    unit: 'km',
    min: 20, max: 500, step: 10,
    description: 'Hard cutoff for logistics. Waste sources beyond this distance from any facility are stranded.',
    tip: 'Beyond the max haul distance, transport cost exceeds any realistic revenue, making the arc economically infeasible regardless of other factors.',
  },
  {
    key: 'windowDays',
    label: 'Planning Window',
    unit: 'days',
    min: 7, max: 90, step: 7,
    description: 'How many days ahead the optimizer plans for. Longer windows smooth out supply variability.',
    tip: 'A longer window captures seasonal supply patterns but may introduce more uncertainty in demand and price assumptions.',
  },
];

export function WhatIfView({
  state,
  setAssumptions,
  T,
  explainMode,
}: {
  state: { assumptions: Assumptions };
  setAssumptions: (patch: Partial<Assumptions>) => Promise<any>;
  T: NetworkTotals;
  explainMode: boolean;
}) {
  const [local, setLocal] = useState<Assumptions>({ ...state.assumptions });
  const [simulating, setSimulating] = useState(false);

  const hasChanges = JSON.stringify(local) !== JSON.stringify(state.assumptions);

  const handleRun = async () => {
    setSimulating(true);
    try {
      await setAssumptions(local);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <>
      {explainMode && (
        <div className="econ-explain-banner">
          <strong>⍰ What-If Simulator</strong> — Change market assumptions and see how they affect the portfolio's profitability in real time.
          This is useful for stress-testing: "What if diesel rises 30%?" or "What happens when carbon credits become more valuable?"
          Click <em>Run Simulation</em> to apply your changes and refresh all figures across the module.
        </div>
      )}

      {/* Live KPI cards — always reflect current server state */}
      <div className="econ-metrics">
        <MetricCard
          label="Current Operating Margin"
          value={inr(T.marginInr)}
          caption="Live result under the current assumptions — updates when you run a simulation"
          tone={T.marginInr >= 0 ? 'pos' : 'neg'}
          info="This reflects the actual server-computed result, not a preview. Run the simulation to apply your changes."
        />
        <MetricCard
          label="Carbon Revenue"
          value={inr(T.carbonRevenueInr)}
          caption="Revenue from carbon credits only — highly sensitive to CDR and VCM price assumptions"
          tone="pos"
        />
        <MetricCard
          label="Abatement Cost"
          value={`${inr(T.abatementCostInrPerTco2e)}/tCO₂e`}
          caption={T.abatementCostInrPerTco2e < 0 ? 'Negative = abatement pays for itself at current prices' : 'Cost to remove 1 tonne of CO₂ under current assumptions'}
          tone={T.abatementCostInrPerTco2e < 0 ? 'pos' : 'warn'}
        />
      </div>

      {/* Two-column layout */}
      <div className="econ-whatif-grid" style={{ marginTop: 14, marginBottom: 40 }}>
        {/* Sliders */}
        <div className="panel">
          <div className="panel-head">
            <h3>Market Assumptions</h3>
            {hasChanges && (
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--warn)', fontWeight: 600 }}>
                ● Unsaved changes
              </span>
            )}
          </div>
          <div className="panel-body">
            {SLIDERS.map((s) => {
              const val = local[s.key] as number;
              return (
                <div key={s.key} className="econ-assumption-row">
                  <div className="econ-assumption-header">
                    <span className="label">
                      {s.label}
                      <InfoIcon tip={s.tip} />
                    </span>
                    <span>
                      <span className="val">{val.toLocaleString('en-IN')}</span>
                      <span className="unit"> {s.unit}</span>
                    </span>
                  </div>
                  <div className="econ-assumption-desc">{s.description}</div>
                  <input
                    type="range"
                    min={s.min} max={s.max} step={s.step}
                    value={val}
                    onChange={(e) => setLocal({ ...local, [s.key]: parseFloat(e.target.value) })}
                    aria-label={s.label}
                  />
                  <div className="econ-range-labels">
                    <span>{s.min} {s.unit}</span>
                    <span>{s.max} {s.unit}</span>
                  </div>
                </div>
              );
            })}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                className="econ-btn"
                onClick={() => setLocal({ ...state.assumptions })}
                disabled={!hasChanges}
              >
                Reset
              </button>
              <button
                className="econ-btn green"
                onClick={handleRun}
                disabled={!hasChanges || simulating}
              >
                {simulating ? '⟳ Simulating…' : '▶ Run Simulation'}
              </button>
            </div>
          </div>
        </div>

        {/* Explanation panel */}
        <div className="panel">
          <div className="panel-head"><h3>How to use this</h3></div>
          <div className="panel-body" style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65 }}>
            <p>
              <strong>Diesel Price</strong> directly affects transport economics.
              Every km costs more when diesel rises, which tightens the viable haul radius and may strand distant waste sources.
            </p>
            <p>
              <strong>CDR & VCM prices</strong> change the revenue side.
              Biochar benefits most from CDR; composting and AD benefit from VCM.
              Higher carbon prices can turn currently marginal pathways profitable.
            </p>
            <p>
              <strong>Max haul distance</strong> is a hard constraint — waste sources beyond this radius will not be matched to any facility, regardless of other economics.
            </p>
            <p style={{ marginBottom: 0, color: 'var(--ink-3)', fontSize: 12 }}>
              After clicking <em>Run Simulation</em>, the engine re-optimises the entire network and refreshes all views with updated figures.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
