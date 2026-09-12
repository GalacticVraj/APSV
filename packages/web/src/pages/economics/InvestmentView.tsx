import { useState } from 'react';
import { MetricCard } from './KPICard.tsx';
import { InfoIcon } from './InfoIcon.tsx';
import { inr, num } from '../../format.ts';
import type { ShadowPrice } from '../../../../engine/src/types.ts';
import { downloadCSV, triggerPrint, saveReportRecord, reportFilename } from './ReportHelpers.ts';

function csvRow(cells: (string | number)[]): string {
  return cells.map((c) => String(c)).join(',') + '\n';
}

function buildShadowCSV(prices: ShadowPrice[]): string {
  let out = csvRow(['Facility_ID', 'Facility_Name', 'Marginal_Value', 'Unit', 'Extra_Margin_INR_per_t', 'Extra_Carbon_tCO2e_per_t', 'Binding']);
  prices.forEach((p) => {
    out += csvRow([p.facilityId, p.facilityName, p.valuePerExtraTonne, p.unit, p.marginPerExtraTonne, p.carbonPerExtraTonne, p.binding ? 'Yes' : 'No']);
  });
  return out;
}

export function InvestmentView({
  optimization,
  explainMode,
}: {
  optimization: { result: { shadowPrices: ShadowPrice[] } };
  explainMode: boolean;
}) {

  const prices: ShadowPrice[] = optimization.result.shadowPrices ?? [];
  const binding = prices.filter((p) => p.binding).sort((a, b) => b.marginPerExtraTonne - a.marginPerExtraTonne);
  const nonBinding = prices.filter((p) => !p.binding).sort((a, b) => b.marginPerExtraTonne - a.marginPerExtraTonne);

  const best = binding[0];
  const totalUnlockableMargin = binding.reduce((s, p) => s + p.marginPerExtraTonne, 0);
  const maxBar = Math.max(...binding.map((p) => p.marginPerExtraTonne), 1);

  return (
    <>
      {explainMode && (
        <div className="econ-explain-banner">
          <strong>⇡ Investment Opportunities</strong> — The optimiser mathematically identifies which facility bottlenecks constrain the most value.
          The "margin per extra tonne" figure tells you exactly how much additional profit you would earn daily
          by expanding that facility's capacity by just one tonne. This is the most reliable signal for where to invest capital next.
        </div>
      )}

      {/* Metric cards */}
      <div className="econ-metrics">
        <MetricCard
          label="Top Investment Target"
          value={best?.facilityName ?? 'None'}
          caption={best ? `${inr(best.marginPerExtraTonne)}/t unlockable margin — highest ROI expansion target` : 'No binding capacity constraints found under the current plan'}
          tone={best ? 'pos' : 'neutral'}
          info="Shadow price = the marginal value of one additional tonne of daily processing capacity at this facility, derived from the LP relaxation of the network optimisation."
        />
        <MetricCard
          label="Binding Bottlenecks"
          value={String(binding.length)}
          caption={`${binding.length} facilities operating at maximum capacity — each one is constraining network throughput`}
          tone={binding.length > 0 ? 'warn' : 'pos'}
        />
        <MetricCard
          label="Total Unlockable Margin"
          value={inr(totalUnlockableMargin)}
          caption="Sum of margin uplift per tonne across all binding bottlenecks — the scale of opportunity"
          tone="pos"
          info="This is an additive sum of marginal values, not a guarantee — actual gains depend on capital cost and supply availability."
        />
      </div>

      {/* Binding bottlenecks bar chart */}
      {binding.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h2>
              Capacity Expansion ROI
              <InfoIcon tip="Shadow prices from the linear programming relaxation of the network optimisation. A shadow price of ₹X per tonne means: if you could process one extra tonne per day at this facility, the network's total margin would increase by ₹X." />
            </h2>
            <span className="note">Binding constraints only · ranked by margin per extra tonne</span>
          </div>
          <div className="panel">
            <div className="panel-body">
              {binding.map((p) => {
                const barPct = (p.marginPerExtraTonne / maxBar) * 100;
                return (
                  <div key={p.facilityId} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <div style={{ width: 170, fontSize: 12.5, fontWeight: 600, flexShrink: 0, textAlign: 'right', lineHeight: 1.2 }}>{p.facilityName}</div>
                    <div style={{ flex: 1, background: 'var(--surface-sunken)', height: 22, position: 'relative', borderRadius: 2 }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${barPct}%`, background: 'var(--green-500)', borderRadius: 2, transition: 'width 0.5s ease' }} />
                    </div>
                    <div style={{ width: 90, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 700, color: 'var(--green-700)' }}>
                      {inr(p.marginPerExtraTonne)}<span style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 400 }}>/t</span>
                    </div>
                    <div style={{ width: 80, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)' }}>
                      {num(p.carbonPerExtraTonne, 3)} tCO₂e
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: 12, paddingLeft: 182, marginTop: 4, fontSize: 10, color: 'var(--ink-4)' }}>
                <div style={{ flex: 1 }}>Relative margin uplift</div>
                <div style={{ width: 90, textAlign: 'right' }}>Margin / extra tonne</div>
                <div style={{ width: 80, textAlign: 'right' }}>Carbon / extra tonne</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full table */}
      <div className="section" style={{ marginBottom: 40 }}>
        <div className="section-head">
          <h2>All Facilities — Capacity Analysis</h2>
          <button className="econ-btn" style={{ marginLeft: 'auto' }} onClick={() => {
            const csv = buildShadowCSV(prices);
            downloadCSV(csv, reportFilename('investment', 'csv', 'all'));
          }}>
            ↓ Export CSV
          </button>
        </div>
        <div className="panel" style={{ overflow: 'hidden' }}>
          <div className="panel-body flush">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--rule)', background: 'var(--surface)' }}>
                  {['Facility', 'Constraint', 'Margin / Extra Tonne', 'Carbon / Extra Tonne', 'Marginal Value'].map((h, i) => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: i > 0 ? 'right' : 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...binding, ...nonBinding].map((p) => (
                  <tr key={p.facilityId} style={{ borderBottom: '1px solid var(--rule)', background: p.binding ? 'transparent' : 'var(--surface-sunken)' }}>
                    <td style={{ padding: '9px 12px', fontWeight: p.binding ? 700 : 400 }}>{p.facilityName}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                      {p.binding
                        ? <span className="econ-tag flagged">Binding</span>
                        : <span className="econ-tag pending">Slack</span>}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: p.binding ? 'var(--green-700)' : 'var(--ink-3)' }}>
                      {inr(p.marginPerExtraTonne)}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {num(p.carbonPerExtraTonne, 3)} tCO₂e
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {p.valuePerExtraTonne.toFixed(2)} {p.unit}
                    </td>
                  </tr>
                ))}
                {prices.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>
                      No shadow prices available. The network may have no binding capacity constraints.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
