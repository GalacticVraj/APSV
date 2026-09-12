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
  path: string;
  navigate: (to: string) => void;
}

const Ctx = createContext<RouterCtx>({ path: '/', navigate: () => {} });

export function useRouter(): RouterCtx {
  return useContext(Ctx);
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(() => window.location.pathname || '/');

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname || '/');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: string) => {
    // Separate the path from any query string for route matching, but push
    // the full URL (including ?search) into browser history so pages can read
    // window.location.search to get parameters like ?id=...
    const toPathname = to.split('?')[0] ?? to;
    if (toPathname === window.location.pathname && to === window.location.pathname + window.location.search) return;
    window.history.pushState({}, '', to);
    setPath(toPathname);
    // Return the reader to the top of the new page, as a full navigation would.
    document.querySelector('.main')?.scrollTo({ top: 0 });
  }, []);


  return <Ctx.Provider value={{ path, navigate }}>{children}</Ctx.Provider>;
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
  const active = path === to;
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
