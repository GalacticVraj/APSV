/**
 * UI primitives.
 *
 * Everything is ruled rather than carded, and every "empty" or "error" state is
 * required to explain *why* it is empty. A blank panel is a bug report the user
 * has to file themselves.
 */

import {
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { deltaClass, num, signedPct } from '../format.ts';

export function Panel({
  title,
  right,
  children,
  flush,
  className,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={`panel ${className ?? ''}`}>
      {title && (
        <header className="panel-head">
          <h3>{title}</h3>
          {right && <div className="right">{right}</div>}
        </header>
      )}
      <div className={`panel-body ${flush ? 'flush' : ''}`}>{children}</div>
    </section>
  );
}

export function SectionHead({
  title,
  note,
  children,
}: {
  title: string;
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {children}
      {note && <div className="note">{note}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  sub,
  delta,
  higherIsBetter = true,
  size,
  tone,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  delta?: number;
  higherIsBetter?: boolean;
  size?: 'sm' | 'lg';
  tone?: 'pos' | 'neg' | 'muted' | 'warnc';
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${size ?? ''} ${tone ?? ''}`}>
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      {delta !== undefined && Number.isFinite(delta) && (
        <div className={`stat-delta ${deltaClass(delta, higherIsBetter)}`}>
          {signedPct(delta)} vs baseline
        </div>
      )}
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function StatStrip({ children }: { children: ReactNode }) {
  return <div className="statstrip">{children}</div>;
}

export function Tag({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: 'green' | 'red' | 'amber' | 'blue' | 'solid';
}) {
  return <span className={`tag ${tone ?? ''}`}>{children}</span>;
}

export function StatusDot({ status }: { status: string }) {
  const cls =
    status === 'online'
      ? 'online'
      : status === 'offline'
        ? 'offline'
        : status === 'derated'
          ? 'derated'
          : 'idle';
  return <span className={`dot ${cls}`} title={status} />;
}

/**
 * Loading state that says what is being computed. These are real server-side
 * operations taking real time; naming them is more useful and more interesting
 * than a spinner.
 */
export function Loading({ message }: { message: string }) {
  return (
    <div className="loadstate">
      <div className="msg">{message}</div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty">
      <h4>This view could not be computed</h4>
      <p>{message}</p>
      {onRetry && (
        <p style={{ marginTop: 10 }}>
          <button className="btn sm" onClick={onRetry}>
            Try again
          </button>
        </p>
      )}
    </div>
  );
}

export function Empty({
  title,
  body,
  why,
}: {
  title: string;
  body: string;
  why?: ReactNode;
}) {
  return (
    <div className="empty">
      <h4>{title}</h4>
      <p>{body}</p>
      {why && <div className="why">{why}</div>}
    </div>
  );
}

export function MiniBar({
  value,
  max,
  tone,
}: {
  value: number;
  max: number;
  tone?: 'neg' | 'amber';
}) {
  const w = max > 0 ? Math.max(0, Math.min(100, (Math.abs(value) / max) * 100)) : 0;
  return (
    <span className="minibar">
      <i className={tone ?? ''} style={{ width: `${w}%` }} />
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sortable data table
// ─────────────────────────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: string;
  /** right-aligned monospace column */
  num?: boolean;
  width?: number | string;
  render: (row: T) => ReactNode;
  /** value used for sorting; omit to make the column unsortable */
  sort?: (row: T) => number | string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  selectedKey,
  initialSort,
  initialDesc = true,
  footer,
  maxHeight,
  emptyTitle = 'Nothing to show',
  emptyBody = 'No rows match the current network state.',
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  initialSort?: string;
  initialDesc?: boolean;
  footer?: ReactNode;
  maxHeight?: number | string;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const [sortKey, setSortKey] = useState<string | null>(initialSort ?? null);
  const [desc, setDesc] = useState(initialDesc);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sort) return rows;
    const out = rows.slice().sort((a, b) => {
      const av = col.sort!(a);
      const bv = col.sort!(b);
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv));
    });
    return desc ? out.reverse() : out;
  }, [rows, columns, sortKey, desc]);

  if (rows.length === 0) return <Empty title={emptyTitle} body={emptyBody} />;

  return (
    <div className="table-wrap" style={maxHeight ? { maxHeight } : undefined}>
      <table className="dt">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`${c.num ? 'num' : ''} ${c.sort ? 'sortable' : ''}`}
                style={c.width ? { width: c.width } : undefined}
                onClick={() => {
                  if (!c.sort) return;
                  if (sortKey === c.key) setDesc((d) => !d);
                  else {
                    setSortKey(c.key);
                    setDesc(true);
                  }
                }}
              >
                {c.header}
                {sortKey === c.key && <span className="sortarrow">{desc ? '▾' : '▴'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const k = rowKey(r);
            return (
              <tr
                key={k}
                className={`${onRowClick ? 'clickable' : ''} ${selectedKey === k ? 'sel' : ''}`}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={c.num ? 'num' : ''}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        {footer && (
          <tfoot>
            <tr>{footer}</tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated number
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';

/**
 * Counts to a new value when it genuinely changes.
 * Used only where a value changing is the *point* — after a re-optimisation or a
 * scenario — never as decoration on a static figure.
 */
export function CountUp({
  value,
  dp = 0,
  format,
  duration = 420,
}: {
  value: number;
  dp?: number;
  format?: (v: number) => string;
  duration?: number;
}) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (Math.abs(to - from) < 1e-9) {
      setShown(to);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      fromRef.current = to;
      setShown(to);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const e = 1 - (1 - t) ** 3;
      setShown(from + (to - from) * e);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <>{format ? format(shown) : num(shown, dp)}</>;
}

export function Hairline() {
  return <hr className="hairline" />;
}

export function Notice({ children, tone }: { children: ReactNode; tone?: 'info' }) {
  return <div className={`notice ${tone ?? ''}`}>{children}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Decision Banner — answers What is happening -> Why it matters -> What to do
// ─────────────────────────────────────────────────────────────────────────────

import { Link } from '../router.tsx';

export interface DecisionBannerProps {
  happening: ReactNode;
  why: ReactNode;
  action: ReactNode;
  actionLabel?: string;
  to?: string;
  onAction?: () => void;
  badge?: string;
}

export function DecisionBanner({
  happening,
  why,
  action,
  actionLabel,
  to,
  onAction,
  badge,
}: DecisionBannerProps) {
  return (
    <div className="decision-banner">
      {badge && <div className="db-badge">{badge}</div>}
      <div className="db-grid">
        <div className="db-col db-happening">
          <div className="db-k">What is happening</div>
          <div className="db-v">{happening}</div>
        </div>
        <div className="db-col db-why">
          <div className="db-k">Why it matters</div>
          <div className="db-v">{why}</div>
        </div>
        <div className="db-col db-action">
          <div className="db-k">What to do</div>
          <div className="db-v">{action}</div>
          {(to || onAction) && (
            <div className="db-act-btn">
              {to ? (
                <Link to={to} className="btn sm primary">
                  {actionLabel ?? 'Take Action →'}
                </Link>
              ) : (
                <button className="btn sm primary" onClick={onAction}>
                  {actionLabel ?? 'Execute'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Visual Storytelling Flow Chain — Flow -> Comparison -> Decision -> Impact
// ─────────────────────────────────────────────────────────────────────────────

export interface FlowStep {
  label: string;
  value: string;
  sub?: string;
  tone?: 'pos' | 'neg' | 'warn' | 'muted';
}

export function ValueFlowChain({
  title,
  steps,
}: {
  title?: string;
  steps: FlowStep[];
}) {
  return (
    <div className="flow-chain-wrap">
      {title && <div className="flow-chain-title">{title}</div>}
      <div className="flow-chain">
        {steps.map((s, i) => (
          <div key={i} className="flow-step-container">
            <div className="flow-step">
              <div className="fs-label">{s.label}</div>
              <div className={`fs-value ${s.tone ?? ''}`}>{s.value}</div>
              {s.sub && <div className="fs-sub">{s.sub}</div>}
            </div>
            {i < steps.length - 1 && (
              <div className="flow-arrow" aria-hidden="true">
                →
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

