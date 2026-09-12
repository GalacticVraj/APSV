/**
 * The inspection drawer.
 *
 * Shared between the Control Center and the Facilities dashboard, because both
 * make the same promise: looking at one thing in detail must never cost you the
 * screen you were reading. A redirect throws away the context the reader built
 * up; a drawer keeps it behind the panel, one Escape away.
 */

import { useEffect, type ReactNode } from 'react';

export function Drawer({
  title,
  onClose,
  wide,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  // Escape closes, because a drawer that traps the reader is worse than a page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="dr-scrim" onClick={onClose} aria-hidden />
      <aside className={`drawer ${wide ? 'wide' : ''}`} role="dialog" aria-label={title}>
        <header className="dr-head">
          <h2>{title}</h2>
          <button className="dr-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="dr-body">{children}</div>
      </aside>
    </>
  );
}
