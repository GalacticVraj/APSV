/**
 * One download button, in the same place on every carbon view.
 *
 * The alternative was a button per table, which puts the control somewhere
 * different on every screen and leaves the reader hunting. So the strip above
 * the page owns the button, and each view registers what it would export.
 *
 * Registration rather than a lookup table matters: the export closes over the
 * rows the view actually rendered, including whatever the reader has filtered
 * or selected. A central table of "what does /carbon/ledger export" would
 * re-derive the data and could disagree with the screen.
 *
 * A view with nothing meaningful to export simply does not register, and the
 * button is not drawn. An empty download is worse than no download.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface CarbonExportSpec {
  /** what the reader is getting, e.g. "Ledger lines (12)" */
  label: string;
  run: () => void;
}

const Ctx = createContext<{
  spec: CarbonExportSpec | null;
  set: (s: CarbonExportSpec | null) => void;
} | null>(null);

export function CarbonExportProvider({ children }: { children: ReactNode }) {
  const [spec, set] = useState<CarbonExportSpec | null>(null);
  return <Ctx.Provider value={{ spec, set }}>{children}</Ctx.Provider>;
}

/**
 * Called by a carbon view to say what it can hand over.
 *
 * `deps` behaves like useEffect's: pass whatever the export reads, so the
 * closure is replaced when the data behind it changes. The registration is
 * cleared on unmount, so navigating to a view that exports nothing removes the
 * button rather than leaving the previous screen's export armed.
 */
export function useCarbonExport(spec: CarbonExportSpec | null, deps: unknown[]): void {
  const ctx = useContext(Ctx);
  useEffect(() => {
    if (!ctx) return;
    ctx.set(spec);
    return () => ctx.set(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** The button itself. Renders nothing until a view registers something. */
export function CarbonExportButton() {
  const ctx = useContext(Ctx);
  const spec = ctx?.spec;
  if (!spec) return null;
  return (
    <button className="dl" onClick={spec.run} title={`Download ${spec.label} as CSV`}>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M8 2v8m0 0L5 7m3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2.5 11v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2" strokeLinecap="round" />
      </svg>
      CSV
    </button>
  );
}
