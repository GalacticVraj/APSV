import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * AnimatedNumber — counts up from 0 to `value` on mount / value change.
 * Renders as a plain string inside a span; caller controls font styling.
 */
function useCountUp(target: number, duration = 600): number {
  const [current, setCurrent] = useState(0);
  const frame = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    fromRef.current = current;
    startRef.current = null;
    if (frame.current) cancelAnimationFrame(frame.current);

    function tick(ts: number) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(fromRef.current + (target - fromRef.current) * eased);
      if (progress < 1) frame.current = requestAnimationFrame(tick);
      else setCurrent(target);
    }
    frame.current = requestAnimationFrame(tick);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [target]);

  return current;
}

/**
 * KPI card for the sticky top strip.
 */
export function KPIStripCard({
  label,
  value,
  rawValue,
  caption,
  tone = 'neutral',
  trendPct,
}: {
  label: string;
  value: string;           // formatted display string
  rawValue?: number;       // numeric value for count-up animation
  caption: string;
  tone?: 'neutral' | 'pos' | 'neg' | 'warn';
  trendPct?: number;
}) {
  const toneClass = tone === 'neutral' ? '' : tone;
  const trendClass = trendPct === undefined ? 'flat' : trendPct > 0 ? 'up' : trendPct < 0 ? 'dn' : 'flat';
  const trendArrow = trendPct === undefined ? '' : trendPct > 0 ? '↑' : trendPct < 0 ? '↓' : '−';

  return (
    <div className="econ-kpi-card econ-animate-in">
      <div className="k">{label}</div>
      <div className={`v ${toneClass}`}>{value}</div>
      {trendPct !== undefined && (
        <div className={`trend ${trendClass}`}>
          {trendArrow} {Math.abs(trendPct).toFixed(1)}%
        </div>
      )}
      <div className="caption">{caption}</div>
    </div>
  );
}

/**
 * Metric card for inside views — larger, with optional sparkline slot.
 */
export function MetricCard({
  label,
  value,
  caption,
  tone = 'neutral',
  info,
  trendPct,
  children,
}: {
  label: string;
  value: string;
  caption: string;
  tone?: 'neutral' | 'pos' | 'neg' | 'warn';
  info?: string;
  trendPct?: number;
  children?: ReactNode;
}) {
  const toneClass = tone === 'neutral' ? '' : tone;
  const trendClass = !trendPct ? 'flat' : trendPct > 0 ? 'up' : 'dn';
  const trendArrow = !trendPct ? '' : trendPct > 0 ? '↑' : '↓';

  return (
    <div className="econ-metric-card econ-animate-in">
      <div className="k">
        {label}
        {info && (
          <span className="econ-info-wrap" style={{ marginLeft: 4 }} tabIndex={0} aria-label={info}>
            <span className="econ-info-icon" aria-hidden="true">i</span>
            <span className="econ-tooltip" role="tooltip">{info}</span>
          </span>
        )}
      </div>
      <div className={`v ${toneClass}`}>{value}</div>
      {trendPct !== undefined && (
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: trendPct > 0 ? 'var(--green-700)' : 'var(--neg)', margin: '2px 0' }}>
          {trendArrow} {Math.abs(trendPct).toFixed(1)}%
        </div>
      )}
      <div className="caption">{caption}</div>
      {children && <div className="sparkline">{children}</div>}
    </div>
  );
}
