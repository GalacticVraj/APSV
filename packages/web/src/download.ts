/**
 * Taking the numbers away with you.
 *
 * Every carbon screen could be read but none of it could leave, except the
 * brief, which could only be printed. A carbon manager whose figures cannot be
 * opened in a spreadsheet will retype them, and retyped figures are wrong
 * figures.
 *
 * Two rules here:
 *
 *   - Export what is on screen, not a re-derivation of it. The CSV is built
 *     from the same rows the table renders, so the file and the screen can
 *     never disagree.
 *   - Carry the basis with the data. Every export gets a header block naming
 *     the window, the objective, the twin version and the fact that this is a
 *     modelled estimate. A bare column of tonnes detached from its assumptions
 *     is exactly how a modelled number gets quoted as a measured one.
 */

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

/** RFC 4180: quote when the field contains a comma, quote or newline. */
function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CsvContext {
  /** what this file is, e.g. "Carbon ledger" */
  title: string;
  windowDays?: number;
  asOf?: string;
  objective?: string;
  twinVersion?: number | string;
  /** anything else worth carrying — permanence basis, selected facility, etc. */
  notes?: string[];
}

/**
 * Builds the file. The preamble is comment lines prefixed with `#`, which
 * Excel, Sheets and pandas all either show as a first column or skip, and which
 * a human reading the raw file understands immediately.
 */
export function buildCsv<T>(rows: T[], columns: Array<CsvColumn<T>>, ctx: CsvContext): string {
  const head: string[] = [
    `# ${ctx.title}`,
    `# Generated ${new Date().toISOString()}`,
  ];
  if (ctx.asOf) head.push(`# Network as of ${ctx.asOf}`);
  if (ctx.windowDays) head.push(`# Planning window ${ctx.windowDays} days`);
  if (ctx.objective) head.push(`# Objective ${ctx.objective}`);
  if (ctx.twinVersion !== undefined) head.push(`# Twin version ${ctx.twinVersion}`);
  for (const n of ctx.notes ?? []) head.push(`# ${n}`);
  head.push(
    '# MODELLED ESTIMATE. Forward-looking plan, not measured emissions.',
    '# Not verified, not certified, and not a carbon credit.',
    '# Synthetic demo data. Emission factors cited on the System & Data screen.',
    '',
  );

  const lines = [
    head.join('\n') + columns.map((c) => cell(c.header)).join(','),
    ...rows.map((r) => columns.map((c) => cell(c.value(r))).join(',')),
  ];
  return lines.join('\n');
}

/** Slug suitable for a filename: lowercase, hyphenated, dated. */
export function csvFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `terraflux-${slug}-${stamp}.csv`;
}

/**
 * Hands the file to the browser.
 *
 * The BOM is not decoration: without it Excel on Windows reads UTF-8 as the
 * system codepage and every tCO₂e subscript and ₹ sign in the file turns to
 * mojibake.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next frame — revoking synchronously races the download in
  // Safari and the file arrives empty.
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}

/** The whole job in one call, which is how every caller wants it. */
export function exportCsv<T>(
  rows: T[],
  columns: Array<CsvColumn<T>>,
  ctx: CsvContext,
): void {
  downloadCsv(csvFilename(ctx.title), buildCsv(rows, columns, ctx));
}
