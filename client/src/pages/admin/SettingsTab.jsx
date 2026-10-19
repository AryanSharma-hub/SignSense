import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';

/** Site-wide settings: name, tagline, announcement, and which features are open. */
export function SettingsTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api.get('/admin/settings') });
  const [form, setForm] = useState(null);
  useEffect(() => { if (q.data && !form) setForm(q.data.settings); }, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation({
    mutationFn: () => api.put('/admin/settings', form),
    onSuccess: (d) => { setForm(d.settings); qc.invalidateQueries({ queryKey: ['settings'] }); qc.invalidateQueries({ queryKey: ['admin'] }); },
  });
  if (!form) return <p className="text-muted">Loading…</p>;
  const schema = q.data.schema;
  const dirty = JSON.stringify(form) !== JSON.stringify(q.data.settings);

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <h2 className="font-display text-[26px] font-semibold tracking-tight">Site settings</h2>
      <section className="panel space-y-4 p-5">
        {Object.entries(schema).map(([k, def]) => (
          def.type === 'boolean' ? (
            <label key={k} className="flex items-center gap-3 text-[15px]">
              <input type="checkbox" checked={!!form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} className="h-5 w-5 accent-[rgb(var(--hand))]" />
              {def.label}
            </label>
          ) : (
            <label key={k} className="block">
              <span className="field-label">{def.label}</span>
              {k === 'announcement'
                ? <textarea rows={2} maxLength={def.max} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="input mt-1" />
                : <input type={def.type === 'number' ? 'number' : 'text'} min={def.min} max={def.max} step={def.integer ? 1 : 0.05} maxLength={def.type === 'string' ? def.max : undefined}
                    value={form[k]} onChange={(e) => setForm({ ...form, [k]: def.type === 'number' ? Number(e.target.value) : e.target.value })} className="input mt-1 max-w-md" />}
            </label>
          )
        ))}
      </section>
      {save.error && <p role="alert" className="text-live">{save.error.message}</p>}
      {save.isSuccess && !dirty && <p role="status" className="text-ok">Saved — the site updates for everyone straight away.</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={!dirty || save.isPending}>Save settings</button>
        <button type="button" className="btn btn-quiet" disabled={!dirty} onClick={() => setForm(q.data.settings)}>Undo changes</button>
      </div>
    </form>
  );
}
