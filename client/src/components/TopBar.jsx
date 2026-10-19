import { createContext, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useRouter } from '../lib/router.js';
import { Icon } from './ui.jsx';
import { Popover } from './Header.jsx';

const ShellContext = createContext({ toolsEl: null });

/** Renders page-specific controls (e.g. the translator's Engines menu) into the top bar. */
export function PageTools({ children }) {
  const { toolsEl } = useContext(ShellContext);
  return toolsEl ? createPortal(children, toolsEl) : null;
}

export function ShellProvider({ children }) {
  const [toolsEl, setToolsEl] = useState(null);
  return <ShellContext.Provider value={{ toolsEl, setToolsEl }}>{children}</ShellContext.Provider>;
}

const navClass = (current) =>
  `inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-2.5 text-[14px] font-semibold transition-colors ${current ? 'bg-hand/15 text-ink' : 'text-muted hover:bg-surface2 hover:text-ink'}`;

/** Site header: brand, page navigation, page tools, theme and account. */
export function TopBar({ settings, auth, theme, onToggleTheme }) {
  const { setToolsEl } = useContext(ShellContext);
  const { navigate } = useRouter();
  const { user, isAdmin } = auth;
  const nav = [
    { to: '/', label: 'Translate', icon: 'hand' },
    ...(settings.learningEnabled || isAdmin ? [{ to: '/learn', label: 'Learn', icon: 'book' }, { to: '/progress', label: 'Progress', icon: 'chart' }] : []),
    ...(user && (settings.feedbackEnabled || isAdmin) ? [{ to: '/feedback', label: 'Feedback', icon: 'chat' }] : []),
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', icon: 'shield' }] : []),
  ];
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Link to="/" className="flex items-center gap-3 rounded-xl">
        <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-hand text-on-accent">
          <svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M9 21c0-6 2-10 7-10s7 4 7 10" /><circle cx="16" cy="8" r="0.5" /></svg>
        </span>
        <span>
          <h1 className="font-display text-[22px] font-semibold leading-none tracking-tight">{settings.siteTitle}</h1>
          <span className="hidden text-[13px] text-muted sm:block">{settings.tagline}</span>
        </span>
      </Link>

      <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
        {nav.map((n) => <Link key={n.to} to={n.to} className={navClass}><Icon name={n.icon} size={16} />{n.label}</Link>)}
      </nav>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div ref={setToolsEl} className="flex flex-wrap items-center gap-2" />
        <button type="button" className="btn !min-h-[38px] !px-2.5" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        {user ? (
          <Popover label="Account" trigger={<><span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-hand text-[12px] font-bold text-on-accent">{user.name.slice(0, 1).toUpperCase()}</span><span className="max-w-[12ch] truncate">{user.name}</span></>}>
            <p className="font-semibold">{user.name}</p>
            <p className="text-[13px] text-muted">{user.email}{isAdmin ? ' · Administrator' : ''}</p>
            <div className="mt-3 grid gap-1.5">
              <Link to="/account" className="btn justify-start !min-h-[38px] text-[14px]"><Icon name="user" size={16} /> Account settings</Link>
              <button type="button" className="btn justify-start !min-h-[38px] text-[14px]" onClick={() => auth.logout.mutate(undefined, { onSettled: () => navigate('/') })}>
                <Icon name="logout" size={16} /> Sign out
              </button>
            </div>
          </Popover>
        ) : (
          <Link to="/login" className="btn btn-primary !min-h-[38px] !px-3 text-[14px]"><Icon name="user" size={16} /> Sign in</Link>
        )}
      </div>
    </header>
  );
}
