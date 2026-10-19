import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.js';

/** Change your display name and password. */
export default function AccountPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState(user.name);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const saveName = useMutation({ mutationFn: () => api.patch('/auth/me', { name }), onSuccess: (d) => qc.setQueryData(['me'], d.user) });
  const savePw = useMutation({ mutationFn: () => api.post('/auth/password', pw), onSuccess: () => setPw({ currentPassword: '', newPassword: '' }) });

  return (
    <div className="mx-auto grid max-w-3xl gap-5 md:grid-cols-2">
      <section className="panel p-5">
        <h2 className="font-display text-[22px] font-semibold">Your details</h2>
        <p className="mb-4 text-[14px] text-muted">{user.email} · {user.role === 'admin' ? 'Administrator' : 'Learner'} since {new Date(user.createdAt).toLocaleDateString()}</p>
        <form onSubmit={(e) => { e.preventDefault(); saveName.mutate(); }} className="space-y-3">
          <label className="block"><span className="field-label">Name</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="input mt-1" /></label>
          {saveName.error && <p role="alert" className="text-[14px] text-live">{saveName.error.message}</p>}
          {saveName.isSuccess && <p role="status" className="text-[14px] text-ok">Saved.</p>}
          <button type="submit" className="btn btn-primary" disabled={!name.trim() || name === user.name}>Save name</button>
        </form>
      </section>
      <section className="panel p-5">
        <h2 className="font-display text-[22px] font-semibold">Change password</h2>
        <p className="mb-4 text-[14px] text-muted">Other devices will be signed out.</p>
        <form onSubmit={(e) => { e.preventDefault(); savePw.mutate(); }} className="space-y-3">
          <label className="block"><span className="field-label">Current password</span><input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} className="input mt-1" /></label>
          <label className="block"><span className="field-label">New password (at least 8 characters)</span><input type="password" autoComplete="new-password" minLength={8} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} className="input mt-1" /></label>
          {savePw.error && <p role="alert" className="text-[14px] text-live">{savePw.error.message}</p>}
          {savePw.isSuccess && <p role="status" className="text-[14px] text-ok">Password changed.</p>}
          <button type="submit" className="btn btn-primary" disabled={!pw.currentPassword || pw.newPassword.length < 8}>Change password</button>
        </form>
      </section>
    </div>
  );
}
