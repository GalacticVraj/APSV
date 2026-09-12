/**
 * Number formatting.
 *
 * One place, because inconsistent number formatting is the fastest way to make a
 * data product look amateur. Indian digit grouping throughout, tabular figures in
 * the CSS, lakh/crore for large rupee values because that is how the audience for
 * this product reads money.
 */

export function num(v: number, dp = 0): string {
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

/** Compact tonnes: 1,240 t / 34.1 kt */
export function tonnes(v: number, dp = 0): string {
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 100000) return `${num(v / 1000, 1)} kt`;
  return num(v, dp);
}

export function inr(v: number, opts: { sign?: boolean } = {}): string {
  if (!Number.isFinite(v)) return '—';
  const sign = v < 0 ? '−' : opts.sign && v > 0 ? '+' : '';
  const a = Math.abs(v);
  if (a >= 1e7) return `${sign}₹${num(a / 1e7, 2)} Cr`;
  if (a >= 1e5) return `${sign}₹${num(a / 1e5, 2)} L`;
  if (a >= 1000) return `${sign}₹${num(a)}`;
  return `${sign}₹${num(a, a < 10 ? 2 : 0)}`;
}

/** Rupees with no unit abbreviation — for per-tonne figures. */
export function inrExact(v: number, dp = 0): string {
  if (!Number.isFinite(v)) return '—';
  const sign = v < 0 ? '−' : '';
  return `${sign}₹${num(Math.abs(v), dp)}`;
}

export function pct(v: number, dp = 1): string {
  if (!Number.isFinite(v)) return '—';
  return `${num(v, dp)}%`;
}

export function signedPct(v: number, dp = 1): string {
  if (!Number.isFinite(v)) return '—';
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${num(Math.abs(v), dp)}%`;
}

export function signed(v: number, dp = 0): string {
  if (!Number.isFinite(v)) return '—';
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${num(Math.abs(v), dp)}`;
}

export function km(v: number, dp = 0): string {
  return `${num(v, dp)} km`;
}

export function co2(v: number, dp = 0): string {
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 100000) return `${num(v / 1000, 1)} ktCO₂e`;
  return `${num(v, dp)}`;
}

export function dateShort(iso: string): string {
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00Z' : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

export function dateFull(iso: string): string {
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00Z' : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function timeShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Good/bad colour class for a delta, respecting whether higher is better. */
export function deltaClass(delta: number, higherIsBetter: boolean): string {
  if (Math.abs(delta) < 1e-9) return 'muted';
  return (delta > 0) === higherIsBetter ? 'pos' : 'neg';
}
