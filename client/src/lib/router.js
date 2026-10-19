import { createContext, createElement, useCallback, useContext, useEffect, useState } from 'react';

/**
 * A minimal client-side router (history API) — the app has a handful of pages, so a
 * dependency isn't needed. Paths look like "/learn/12"; `match` turns a pattern with
 * ":params" into an object or null.
 */
const RouterContext = createContext({ path: '/', navigate: () => {} });

export function RouterProvider({ children }) {
  const [path, setPath] = useState(() => (typeof window !== 'undefined' ? window.location.pathname : '/'));
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = useCallback((to, { replace = false } = {}) => {
    if (to === window.location.pathname) return;
    window.history[replace ? 'replaceState' : 'pushState']({}, '', to);
    setPath(new URL(to, window.location.origin).pathname);
    window.scrollTo?.(0, 0);
  }, []);
  return createElement(RouterContext.Provider, { value: { path, navigate } }, children);
}

export const useRouter = () => useContext(RouterContext);

export function match(pattern, path) {
  const p = pattern.split('/').filter(Boolean), s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}

/** An <a> that navigates without a page load (and still works with modifier-click / new tab). */
export function Link({ to, children, className, ...rest }) {
  const { navigate, path } = useRouter();
  const onClick = (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  const current = to === '/' ? path === '/' : path === to || path.startsWith(`${to}/`);
  return createElement('a', { href: to, onClick, className: typeof className === 'function' ? className(current) : className, 'aria-current': current ? 'page' : undefined, ...rest }, children);
}
