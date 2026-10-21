import { useState } from 'react';
import { useRouter, Link } from '../lib/router.js';
import { useAuth } from '../hooks/useAuth.js';

const nextPath = () => {
  const n = new URLSearchParams(window.location.search).get('next');
  return n && n.startsWith('/') && !n.startsWith('//') ? n : null;
};

/**
 * One sign-in page for learners and administrators. The account's role decides where
 * they land: administrators go to the dashboard, learners to their lessons.
 */
export default function LoginPage({ mode = 'login', settings }) {
  const { navigate } = useRouter();
  const auth = useAuth();
  const registering = mode === 'register';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [show, setShow] = useState(false);
  const m = registering ? auth.register : auth.login;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    m.mutate(registering ? form : { email: form.email, password: form.password }, {
      onSuccess: ({ user }) => navigate(nextPath() || (user.role === 'admin' ? '/admin' : '/learn'), { replace: true }),
    });
  };

  if (auth.user) {
    return (
      <>
        <LoginScene />
        <div className="glass rise-in mx-auto mt-[14vh] max-w-md rounded-[28px] p-8 text-center shadow-lift">
          <h2 className="font-display text-[24px] font-bold tracking-tight">You’re signed in as {auth.user.name}</h2>
          <div className="mt-5 flex justify-center gap-2">
            <Link to={auth.isAdmin ? '/admin' : '/learn'} className="btn btn-primary">{auth.isAdmin ? 'Open the dashboard' : 'Go to lessons'}</Link>
            <button type="button" className="btn" onClick={() => auth.logout.mutate()}>Sign out</button>
          </div>
        </div>
      </>
    );
  }

  const tab = (on) => `rounded-full py-2 text-center text-[14.5px] font-semibold transition-all ${on ? 'bg-accent text-on-accent shadow-glow' : 'text-muted hover:text-ink'}`;

  return (
    <>
      <LoginScene />
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-[460px] flex-col items-center justify-center py-8">
        <h1 className="login-wordmark rise-in relative right-[0.045em] select-none whitespace-nowrap text-center">{settings.siteTitle || 'SignSense'}</h1>
        {/* The left padding equals the letter-spacing, so the tracked line sits truly centered. */}
        <p className="login-ink rise-in mb-10 mt-6 pl-[0.22em] text-center text-[13px] font-semibold uppercase tracking-[0.22em] opacity-80" style={{ animationDelay: '80ms' }}>
          {settings.tagline}
        </p>

        <section className="glass rise-in w-full rounded-[28px] p-6 shadow-lift sm:p-8" style={{ animationDelay: '160ms' }} aria-labelledby="auth-title">
          <div role="tablist" aria-label="Account" className="mb-6 grid grid-cols-2 rounded-full border border-line/70 bg-surface2/70 p-1">
            <Link to={`/login${window.location.search}`} role="tab" aria-selected={!registering} className={tab(!registering)}>Sign in</Link>
            <Link to={`/register${window.location.search}`} role="tab" aria-selected={registering} className={tab(registering)}>Create account</Link>
          </div>
          <h2 id="auth-title" className="font-display text-[26px] font-bold tracking-tight">{registering ? 'Create your learner account' : 'Welcome back'}</h2>
          <p className="mb-5 mt-1 text-[14.5px] text-muted">{registering ? 'Free. Your progress is saved as you learn.' : 'Learners and administrators sign in here.'}</p>

          {registering && !settings.registrationOpen ? (
            <p className="rounded-xl bg-surface2 p-3 text-[14.5px] text-muted">New accounts aren’t being accepted right now. Ask an administrator to create one for you.</p>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              {registering && (
                <label className="block">
                  <span className="field-label">Name</span>
                  <input required autoComplete="name" value={form.name} onChange={set('name')} maxLength={60} className="input mt-1.5" />
                </label>
              )}
              <label className="block">
                <span className="field-label">Email</span>
                <input required type="email" autoComplete="email" value={form.email} onChange={set('email')} className="input mt-1.5" />
              </label>
              <label className="block">
                <span className="field-label">Password{registering ? ' (at least 8 characters)' : ''}</span>
                <span className="relative mt-1.5 block">
                  <input required type={show ? 'text' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} value={form.password} onChange={set('password')} minLength={registering ? 8 : undefined} className="input pr-16" />
                  <button type="button" onClick={() => setShow(!show)} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[13px] font-semibold text-muted hover:text-accent" aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
                </span>
              </label>
              {m.error && <p role="alert" className="rounded-lg border border-live/40 bg-live/10 px-3 py-2 text-[14px]">{m.error.message}</p>}
              <button type="submit" className="btn btn-primary !min-h-[50px] w-full !rounded-full text-[16px] font-semibold" disabled={m.isPending}>{m.isPending ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}</button>
            </form>
          )}
        </section>

        <Link to="/" className="login-ink rise-in mt-8 rounded-full px-3 py-1.5 text-[14px] font-semibold opacity-80 transition-opacity hover:opacity-100" style={{ animationDelay: '240ms' }}>
          ← Back to the translator
        </Link>
      </div>
    </>
  );
}

/** The animated backdrop: a lilac sphere and a glowing orange one drifting against each other. */
function LoginScene() {
  return (
    <div className="login-scene" aria-hidden>
      <div className="sky" />
      <div className="orb orb-sun" />
      <div className="lens" />
      <div className="orb orb-moon" />
      <div className="grain" />
    </div>
  );
}
