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
      <div className="panel mx-auto max-w-md p-6 text-center">
        <h2 className="font-display text-[22px] font-semibold">You’re signed in as {auth.user.name}</h2>
        <div className="mt-4 flex justify-center gap-2">
          <Link to={auth.isAdmin ? '/admin' : '/learn'} className="btn btn-primary">{auth.isAdmin ? 'Open the dashboard' : 'Go to lessons'}</Link>
          <button type="button" className="btn" onClick={() => auth.logout.mutate()}>Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-[960px] gap-6 md:grid-cols-[1fr_420px] md:items-center">
      <section className="hidden md:block">
        <h2 className="font-display text-[34px] font-semibold leading-tight tracking-tight">Learn American Sign Language, one sign at a time.</h2>
        <ul className="mt-5 space-y-3 text-[16px] text-muted">
          <li className="flex gap-2"><span aria-hidden className="text-hand">●</span> Short lessons built from everyday words, signed by the on-screen signer at any speed.</li>
          <li className="flex gap-2"><span aria-hidden className="text-hand">●</span> Tests checked on the server, with spaced review of the signs you miss.</li>
          <li className="flex gap-2"><span aria-hidden className="text-hand">●</span> Progress reports — and a direct line to the team when a sign looks wrong.</li>
        </ul>
        <p className="mt-5 text-[14px] text-muted">The translator works without an account. You only need one to learn.</p>
      </section>

      <section className="panel p-6" aria-labelledby="auth-title">
        <div role="tablist" aria-label="Account" className="mb-5 grid grid-cols-2 rounded-xl border border-line bg-surface2 p-1">
          <Link to={`/login${window.location.search}`} role="tab" aria-selected={!registering} className={`rounded-lg py-2 text-center text-[14.5px] font-semibold ${!registering ? 'bg-ink text-bg' : 'text-muted'}`}>Sign in</Link>
          <Link to={`/register${window.location.search}`} role="tab" aria-selected={registering} className={`rounded-lg py-2 text-center text-[14.5px] font-semibold ${registering ? 'bg-ink text-bg' : 'text-muted'}`}>Create account</Link>
        </div>
        <h2 id="auth-title" className="font-display text-[22px] font-semibold">{registering ? 'Create your learner account' : 'Welcome back'}</h2>
        <p className="mb-4 text-[14px] text-muted">{registering ? 'Free. Your progress is saved as you learn.' : 'Learners and administrators sign in here.'}</p>

        {registering && !settings.registrationOpen ? (
          <p className="rounded-xl bg-surface2 p-3 text-[14.5px] text-muted">New accounts aren’t being accepted right now. Ask an administrator to create one for you.</p>
        ) : (
          <form onSubmit={submit} className="space-y-3" noValidate>
            {registering && (
              <label className="block">
                <span className="field-label">Name</span>
                <input required autoComplete="name" value={form.name} onChange={set('name')} maxLength={60} className="input mt-1" />
              </label>
            )}
            <label className="block">
              <span className="field-label">Email</span>
              <input required type="email" autoComplete="email" value={form.email} onChange={set('email')} className="input mt-1" />
            </label>
            <label className="block">
              <span className="field-label">Password{registering ? ' (at least 8 characters)' : ''}</span>
              <span className="relative mt-1 block">
                <input required type={show ? 'text' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} value={form.password} onChange={set('password')} minLength={registering ? 8 : undefined} className="input pr-16" />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[13px] font-semibold text-muted hover:text-ink" aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
              </span>
            </label>
            {m.error && <p role="alert" className="rounded-lg border border-live/40 bg-live/10 px-3 py-2 text-[14px]">{m.error.message}</p>}
            <button type="submit" className="btn btn-primary w-full" disabled={m.isPending}>{m.isPending ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}</button>
          </form>
        )}
      </section>
    </div>
  );
}
