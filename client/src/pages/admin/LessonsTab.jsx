import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { Icon, SourceBadge } from '../../components/ui.jsx';
import { useVocabulary } from '../../api/hooks.js';

function LessonEditor({ lesson, gestures, onClose }) {
  const qc = useQueryClient();
  const byId = useMemo(() => new Map(gestures.map((g) => [g.id, g])), [gestures]);
  const [f, setF] = useState({ title: lesson?.title ?? '', unit: lesson?.unit ?? '', description: lesson?.description ?? '', level: lesson?.level ?? 'beginner', published: lesson?.published ?? true });
  const [ids, setIds] = useState(lesson?.gestureIds ?? []);
  const [find, setFind] = useState('');
  const matches = useMemo(() => {
    const q = find.trim().toLowerCase();
    if (!q) return [];
    return gestures.filter((g) => !ids.includes(g.id) && (g.gloss.toLowerCase().includes(q) || g.keywords.some((k) => k.keyword === q)))
      .sort((a, b) => Number(b.gloss.toLowerCase() === q) - Number(a.gloss.toLowerCase() === q)).slice(0, 8);
  }, [find, gestures, ids]);

  const save = useMutation({
    mutationFn: async () => {
      const l = lesson?.id ? (await api.put(`/admin/lessons/${lesson.id}`, f)).lesson : (await api.post('/admin/lessons', f)).lesson;
      await api.put(`/admin/lessons/${l.id}/signs`, { gestureIds: ids });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'lessons'] }); qc.invalidateQueries({ queryKey: ['learn'] }); onClose(); },
  });
  const move = (i, d) => { const a = ids.slice(); [a[i], a[i + d]] = [a[i + d], a[i]]; setIds(a); };

  return (
    <form className="panel space-y-4 p-4 md:p-5" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <h3 className="font-display text-[20px] font-semibold">{lesson?.id ? `Edit “${lesson.title}”` : 'New lesson'}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="field-label">Title</span><input required maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="input mt-1" /></label>
        <label className="block"><span className="field-label">Unit (groups lessons on the Learn page)</span><input required maxLength={60} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} className="input mt-1" /></label>
      </div>
      <label className="block"><span className="field-label">Description</span><textarea rows={2} maxLength={600} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="input mt-1" /></label>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2"><span className="field-label">Level</span>
          <select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} className="input !w-auto">{['beginner', 'intermediate', 'advanced'].map((l) => <option key={l}>{l}</option>)}</select></label>
        <label className="flex items-center gap-2 text-[15px]"><input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} className="h-5 w-5 accent-[rgb(var(--hand))]" /> Published (visible to learners)</label>
      </div>

      <fieldset>
        <legend className="field-label mb-1">Signs in this lesson ({ids.length})</legend>
        <ol className="space-y-1.5">
          {ids.map((id, i) => {
            const g = byId.get(id);
            return (
              <li key={id} className="flex items-center gap-2 rounded-lg border border-line px-2 py-1">
                <span className="w-6 text-right text-[12px] text-muted">{i + 1}</span>
                <span className="gloss">{g?.gloss ?? `#${id}`}</span>{g && <SourceBadge sign={g} />}
                <span className="ml-auto flex">
                  <button type="button" className="btn btn-quiet !min-h-[30px] !px-1.5" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><Icon name="up" size={14} /></button>
                  <button type="button" className="btn btn-quiet !min-h-[30px] !px-1.5" disabled={i === ids.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><Icon name="down" size={14} /></button>
                  <button type="button" className="btn btn-quiet !min-h-[30px] !px-1.5" onClick={() => setIds(ids.filter((x) => x !== id))} aria-label={`Remove ${g?.gloss}`}><Icon name="x" size={14} /></button>
                </span>
              </li>
            );
          })}
        </ol>
        <label className="mt-2 block"><span className="sr-only">Add a sign</span>
          <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Add a sign: type a gloss or word" className="input" /></label>
        {matches.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {matches.map((g) => <li key={g.id}><button type="button" className="chip border-line bg-surface !py-1 text-[13px] hover:bg-surface2" onClick={() => { setIds([...ids, g.id]); setFind(''); }}><Icon name="plus" size={12} /> <span className="gloss">{g.gloss}</span></button></li>)}
          </ul>
        )}
      </fieldset>
      {save.error && <p role="alert" className="text-live">{save.error.message}</p>}
      <div className="flex gap-2"><button type="submit" className="btn btn-primary" disabled={save.isPending}>Save lesson</button><button type="button" className="btn btn-quiet" onClick={onClose}>Cancel</button></div>
    </form>
  );
}

/** The course: lessons in order, grouped into units. */
export function LessonsTab() {
  const qc = useQueryClient();
  const voc = useVocabulary();
  const q = useQuery({ queryKey: ['admin', 'lessons'], queryFn: () => api.get('/admin/lessons') });
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin', 'lessons'] }); qc.invalidateQueries({ queryKey: ['learn'] }); };
  const reorder = useMutation({ mutationFn: (ids) => api.post('/admin/lessons/reorder', { ids }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id) => api.del(`/admin/lessons/${id}`), onSuccess: () => { setConfirm(null); refresh(); } });
  const toggle = useMutation({ mutationFn: (l) => api.put(`/admin/lessons/${l.id}`, { ...l, published: !l.published }), onSuccess: refresh });

  if (editing && voc.ready) return <LessonEditor lesson={editing.new ? null : editing} gestures={voc.gestures} onClose={() => setEditing(null)} />;
  const lessons = q.data?.lessons ?? [];
  const move = (i, d) => { const ids = lessons.map((l) => l.id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]]; reorder.mutate(ids); };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="font-display text-[26px] font-semibold tracking-tight">Lessons</h2>
          <p className="text-[14px] text-muted">The course learners see, in this order. Unpublished lessons are hidden from learners.</p></div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({ new: true })}><Icon name="plus" size={15} /> New lesson</button>
      </header>
      <section className="panel divide-y divide-line">
        {lessons.map((l, i) => (
          <div key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <span className="flex flex-col">
              <button type="button" className="btn btn-quiet !min-h-[24px] !px-1" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)} aria-label={`Move ${l.title} up`}><Icon name="up" size={14} /></button>
              <button type="button" className="btn btn-quiet !min-h-[24px] !px-1" disabled={i === lessons.length - 1 || reorder.isPending} onClick={() => move(i, 1)} aria-label={`Move ${l.title} down`}><Icon name="down" size={14} /></button>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{l.title} {!l.published && <span className="ml-1 rounded bg-surface2 px-1.5 text-[12px] font-bold text-muted">Hidden</span>}</span>
              <span className="block text-[13px] text-muted">{l.unit} · {l.gestureIds.length} signs · {l.level}</span>
            </span>
            <button type="button" className="btn !min-h-[34px] text-[13px]" onClick={() => toggle.mutate(l)}>{l.published ? 'Hide' : 'Publish'}</button>
            <button type="button" className="btn !min-h-[34px] text-[13px]" onClick={() => setEditing(l)}><Icon name="edit" size={14} /> Edit</button>
            {confirm === l.id
              ? <span className="flex items-center gap-1 text-[13px]">Delete?<button type="button" className="btn !min-h-[34px] !border-live text-[13px] text-live" onClick={() => remove.mutate(l.id)}>Delete</button><button type="button" className="btn btn-quiet !min-h-[34px] text-[13px]" onClick={() => setConfirm(null)}>Keep</button></span>
              : <button type="button" className="btn btn-quiet !min-h-[34px] text-[13px]" onClick={() => setConfirm(l.id)} aria-label={`Delete ${l.title}`}><Icon name="trash" size={14} /></button>}
          </div>
        ))}
        {q.isLoading && <p className="p-4 text-muted">Loading…</p>}
        {!q.isLoading && lessons.length === 0 && <p className="p-4 text-muted">No lessons yet.</p>}
      </section>
    </div>
  );
}
