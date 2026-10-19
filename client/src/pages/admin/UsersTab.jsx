import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { Icon } from '../../components/ui.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { fmt } from './OverviewTab.jsx';

function UserRow({ u, me, refresh }) {
  const [pw, setPw] = useState(null); // null | '' (editing)
  const [confirm, setConfirm] = useState(false);
  const patch = useMutation({ mutationFn: (b) => api.patch(`/admin/users/${u.id}`, b), onSuccess: refresh });
  const reset = useMutation({ mutationFn: () => api.post(`/admin/users/${u.id}/password`, { password: pw }), onSuccess: () => setPw(null) });
  const remove = useMutation({ mutationFn: () => api.del(`/admin/users/${u.id}`), onSuccess: refresh });
  const err = patch.error || reset.error || remove.error;
  const self = u.id === me.id;
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{u.name} {self && <span className="text-[12px] text-muted">(you)</span>} {u.disabled && <span className="ml-1 rounded bg-live/15 px-1.5 text-[12px] font-bold text-live">Disabled</span>}</span>
          <span className="block text-[13px] text-muted">{u.email} · joined {fmt(u.createdAt)} · last sign-in {fmt(u.lastLoginAt)}</span>
        </span>
        <label className="flex items-center gap-1.5 text-[13px]"><span className="sr-only">Role</span>
          <select value={u.role} disabled={self || patch.isPending} onChange={(e) => patch.mutate({ role: e.target.value })} className="input !min-h-[34px] !w-auto text-[13px]">
            <option value="user">Learner</option><option value="admin">Administrator</option>
          </select></label>
        <button type="button" className="btn !min-h-[34px] text-[13px]" disabled={self} onClick={() => patch.mutate({ disabled: !u.disabled })}>{u.disabled ? 'Enable' : 'Disable'}</button>
        <button type="button" className="btn !min-h-[34px] text-[13px]" onClick={() => setPw(pw === null ? '' : null)}>Reset password</button>
        {confirm
          ? <span className="flex items-center gap-1 text-[13px]">Delete account and progress?<button type="button" className="btn !min-h-[34px] !border-live text-[13px] text-live" onClick={() => remove.mutate()}>Delete</button><button type="button" className="btn btn-quiet !min-h-[34px] text-[13px]" onClick={() => setConfirm(false)}>Keep</button></span>
          : <button type="button" className="btn btn-quiet !min-h-[34px] text-[13px]" disabled={self} onClick={() => setConfirm(true)} aria-label={`Delete ${u.name}`}><Icon name="trash" size={14} /></button>}
      </div>
      {pw !== null && (
        <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); reset.mutate(); }}>
          <label><span className="field-label">New password for {u.name}</span><input type="text" autoComplete="off" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} className="input mt-1 !min-h-[38px]" /></label>
          <button type="submit" className="btn btn-primary !min-h-[38px]" disabled={pw.length < 8}>Set password</button>
          <span className="text-[12.5px] text-muted">They will be signed out everywhere.</span>
        </form>
      )}
      {reset.isSuccess && <p role="status" className="mt-1 text-[13px] text-ok">Password changed.</p>}
      {err && <p role="alert" className="mt-1 text-[13px] text-live">{err.message}</p>}
    </li>
  );
}

/** Accounts: roles, access, password resets, and creating accounts (including administrators). */
export function UsersTab() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const q = useQuery({ queryKey: ['admin', 'users'], queryFn: () => api.get('/admin/users') });
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });
  const create = useMutation({ mutationFn: () => api.post('/admin/users', form), onSuccess: () => { setForm({ name: '', email: '', password: '', role: 'user' }); refresh(); } });
  const [find, setFind] = useState('');
  const users = (q.data?.users ?? []).filter((u) => !find || `${u.name} ${u.email}`.toLowerCase().includes(find.toLowerCase()));

  return (
    <div className="space-y-4">
      <h2 className="font-display text-[26px] font-semibold tracking-tight">Users</h2>
      <form className="panel grid gap-3 p-4 md:grid-cols-[1fr_1fr_1fr_auto_auto] md:items-end" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <p className="font-semibold md:col-span-5">Create an account</p>
        <label><span className="field-label">Name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input mt-1" /></label>
        <label><span className="field-label">Email</span><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input mt-1" /></label>
        <label><span className="field-label">Temporary password</span><input required minLength={8} type="text" autoComplete="off" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input mt-1" /></label>
        <label><span className="field-label">Role</span><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input mt-1"><option value="user">Learner</option><option value="admin">Administrator</option></select></label>
        <button type="submit" className="btn btn-primary" disabled={create.isPending}><Icon name="plus" size={15} /> Create</button>
        {create.error && <p role="alert" className="text-[14px] text-live md:col-span-5">{create.error.message}</p>}
      </form>
      <label className="block max-w-sm"><span className="sr-only">Find a user</span><input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find by name or email" className="input" /></label>
      <ul className="panel divide-y divide-line">
        {users.map((u) => <UserRow key={u.id} u={u} me={me} refresh={refresh} />)}
        {q.isLoading && <li className="p-4 text-muted">Loading…</li>}
      </ul>
    </div>
  );
}
