import { lazy, Suspense } from 'react';
import { RouterProvider, useRouter, match, Link } from './lib/router.js';
import { TopBar, ShellProvider } from './components/TopBar.jsx';
import { TranslatorPage } from './pages/TranslatorPage.jsx';
import { useAuth, useSiteSettings } from './hooks/useAuth.js';
import { useTheme } from './hooks/useTheme.js';

// Pages other than the translator load on demand, so the translator stays fast to open.
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const LearnPage = lazy(() => import('./pages/LearnPage.jsx'));
const LessonPage = lazy(() => import('./pages/LessonPage.jsx'));
const TestPage = lazy(() => import('./pages/TestPage.jsx'));
const ProgressPage = lazy(() => import('./pages/ProgressPage.jsx'));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage.jsx'));
const AccountPage = lazy(() => import('./pages/AccountPage.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));

/** Ask for sign-in (or admin rights) before showing a page. */
function Guard({ auth, admin = false, children, what }) {
  const { path } = useRouter();
  if (auth.loading) return <p className="py-16 text-center text-muted" role="status">Loading…</p>;
  if (!auth.user) {
    return (
      <div className="panel mx-auto mt-10 max-w-md p-6 text-center">
        <h2 className="font-display text-[22px] font-semibold">Sign in to {what}</h2>
        <p className="mt-2 text-[15px] text-muted">Your progress, tests and feedback are saved to your account.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link to={`/login?next=${encodeURIComponent(path)}`} className="btn btn-primary">Sign in</Link>
          <Link to={`/register?next=${encodeURIComponent(path)}`} className="btn">Create an account</Link>
        </div>
      </div>
    );
  }
  if (admin && !auth.isAdmin) {
    return <div className="panel mx-auto mt-10 max-w-md p-6 text-center"><h2 className="font-display text-[22px] font-semibold">Administrators only</h2><p className="mt-2 text-muted">Your account doesn’t have access to this page.</p></div>;
  }
  return children;
}

function Routes({ auth, settings }) {
  const { path } = useRouter();
  let m;
  if (path === '/') return <TranslatorPage />;
  if (path === '/login' || path === '/register') return <LoginPage mode={path.slice(1)} settings={settings} />;
  const off = !settings.learningEnabled && !auth.isAdmin;
  if (off && /^\/(learn|review|progress)/.test(path)) {
    return <div className="panel mx-auto mt-10 max-w-md p-6 text-center"><h2 className="font-display text-[22px] font-semibold">Learning is paused</h2><p className="mt-2 text-muted">The administrators have switched the learning module off for now.</p></div>;
  }
  if (path === '/learn') return <Guard auth={auth} what="start learning"><LearnPage /></Guard>;
  if ((m = match('/learn/:id/test', path))) return <Guard auth={auth} what="take tests"><TestPage lessonId={Number(m.id)} /></Guard>;
  if ((m = match('/learn/:id', path))) return <Guard auth={auth} what="start learning"><LessonPage lessonId={Number(m.id)} /></Guard>;
  if (path === '/review') return <Guard auth={auth} what="review signs"><TestPage review /></Guard>;
  if (path === '/progress') return <Guard auth={auth} what="see your progress"><ProgressPage /></Guard>;
  if (path === '/feedback') return <Guard auth={auth} what="send feedback"><FeedbackPage settings={settings} /></Guard>;
  if (path === '/account') return <Guard auth={auth} what="manage your account"><AccountPage /></Guard>;
  if (path === '/admin' || (m = match('/admin/:tab', path))) return <Guard auth={auth} admin what="open the dashboard"><AdminPage tab={m?.tab || 'overview'} /></Guard>;
  return <div className="panel mx-auto mt-10 max-w-md p-6 text-center"><h2 className="font-display text-[22px] font-semibold">Page not found</h2><Link to="/" className="btn btn-primary mt-4">Go to the translator</Link></div>;
}

function Shell() {
  const { path } = useRouter();
  const auth = useAuth();
  const settings = useSiteSettings();
  const { theme, toggle } = useTheme();
  const workspace = path === '/';
  return (
    <div className={`${workspace ? 'app-shell max-w-[1920px]' : 'max-w-[1240px]'} mx-auto px-3 pb-6 pt-3 sm:px-4`}>
      <a href="#main" className="skip-link">Skip to content</a>
      <TopBar settings={settings} auth={auth} theme={theme} onToggleTheme={toggle} />
      {settings.announcement && (
        <p role="note" className="mt-2 rounded-xl border border-hand/30 bg-hand/10 px-3 py-2 text-[14px]">{settings.announcement}</p>
      )}
      <main id="main" className={workspace ? 'workspace-main mt-3' : 'mt-5'}>
        <Suspense fallback={<p className="py-16 text-center text-muted" role="status">Loading…</p>}>
          <Routes auth={auth} settings={settings} />
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <ShellProvider>
        <Shell />
      </ShellProvider>
    </RouterProvider>
  );
}
