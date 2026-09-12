/**
 * A 60-line router.
 *
 * The app has twelve static routes and no dynamic segments, so a routing library
 * would be more configuration than code. This uses the History API, keeps the
 * current path in state, and exposes a Link that does not reload the page.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

interface RouterCtx {
  /** pathname only — route lookup must never see a query string */
  path: string;
  /** the current query string, for screens that accept a deep link */
  search: string;
  navigate: (to: string) => void;
}

const Ctx = createContext<RouterCtx>({ path: '/', search: '', navigate: () => {} });

export function useRouter(): RouterCtx {
  return useContext(Ctx);
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(() => window.location.pathname || '/');
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    const onPop = () => {
      setPath(window.location.pathname || '/');
      setSearch(window.location.search);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: string) => {
    if (to === window.location.pathname + window.location.search) return;
    window.history.pushState({}, '', to);
    // Split before storing: ROUTES is keyed by pathname, so a query string reaching
    // it would fall through to the not-found screen.
    const [nextPath, nextSearch] = to.split('?');
    setPath(nextPath || '/');
    setSearch(nextSearch ? `?${nextSearch}` : '');
    // Return the reader to the top of the new page, as a full navigation would.
    document.querySelector('.main')?.scrollTo({ top: 0 });
  }, []);

  return <Ctx.Provider value={{ path, search, navigate }}>{children}</Ctx.Provider>;
}

export function Link({
  to,
  children,
  className,
  onClick,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const { path, navigate } = useRouter();
  const active = path === to.split('?')[0];
  return (
    <a
      href={to}
      className={`${className ?? ''} ${active ? 'active' : ''}`.trim()}
      aria-current={active ? 'page' : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onClick?.();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
