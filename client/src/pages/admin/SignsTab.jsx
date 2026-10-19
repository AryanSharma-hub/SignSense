import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { Icon, SourceBadge } from '../../components/ui.jsx';
import { useVocabulary } from '../../api/hooks.js';
import { SignEditor } from './SignEditor.jsx';

/** Every sign in the library: find, edit, review, delete, or create new ones. */
export function SignsTab() {
  const voc = useVocabulary();
  const [q, setQ] = useState('');
  const [source, setSource] = useState('');
  const [review, setReview] = useState('');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(null); // gesture | {new:true} | null
  const list = useQuery({
    queryKey: ['admin', 'signs', q, source, review, page],
    queryFn: () => api.get(`/admin/signs?${new URLSearchParams({ q, source, review, page })}`),
    placeholderData: keepPreviousData,
  });

  // Deep link from the overview (?edit=<id>), or a draft handed over from the translator.
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get('edit'));
    if (id && voc.ready) { const g = voc.gestures.find((x) => x.id === id); if (g) setEditing(g); }
    try {
      const draft = sessionStorage.getItem('signsense:new-sign-steps');
      if (draft) { sessionStorage.removeItem('signsense:new-sign-steps'); setEditing({ new: true, steps: JSON.parse(draft) }); }
    } catch { /* ignore */ }
  }, [voc.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(0); }, [q, source, review]);
  const data = list.data;
  const pages = data ? Math.ceil(data.total / data.size) : 0;

  if (editing && voc.ready) {
    return (
      <section className="panel p-4 md:p-5">
        <SignEditor
          key={editing.id ?? 'new'} sign={editing.new ? null : editing} initialSteps={editing.steps} vocab={voc.vocab}
          onDone={(g, o) => { if (o?.cancelled || g === null) setEditing(null); else setEditing(g); }}
        />
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[26px] font-semibold tracking-tight">Signs</h2>
          <p className="text-[14px] text-muted">Edit any sign, mark it reviewed once a fluent signer has checked it, or add a new one. Tip: build a sign on the signer in the translator and choose “Save as new sign”.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({ new: true })}><Icon name="plus" size={15} /> New sign</button>
      </header>
      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Search signs</span>
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search gloss or keyword" className="input pl-9" />
        </label>
        <select aria-label="Source" value={source} onChange={(e) => setSource(e.target.value)} className="input !w-auto">
          <option value="">All sources</option><option value="curated">Curated</option><option value="asl-lex">ASL-LEX</option><option value="authored">Authored</option><option value="admin">Admin-created</option>
        </select>
        <select aria-label="Review status" value={review} onChange={(e) => setReview(e.target.value)} className="input !w-auto">
          <option value="">Any review status</option><option value="unreviewed">Not reviewed</option><option value="reviewed">Reviewed</option>
        </select>
      </div>

      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[14px]">
          <thead className="border-b border-line text-[12.5px] text-muted"><tr><th className="px-4 py-2 font-semibold">Sign</th><th className="font-semibold">Meaning</th><th className="font-semibold">Source</th><th className="font-semibold">Review</th><th /></tr></thead>
          <tbody className="divide-y divide-line">
            {data?.signs.map((g) => (
              <tr key={g.id} className="hover:bg-surface2/60">
                <td className="px-4 py-2"><span className="gloss">{g.gloss}</span></td>
                <td className="max-w-[340px] truncate pr-3 text-muted" title={g.meaning}>{g.meaning}</td>
                <td className="pr-3">{g.source === 'admin' ? <span className="rounded-md border border-hand/40 px-1.5 py-0.5 text-[11.5px] font-semibold">Admin</span> : <SourceBadge sign={g} />}</td>
                <td className="pr-3">{g.needsReview ? <span className="text-muted">—</span> : <span className="font-semibold text-ok">✓ Reviewed</span>}</td>
                <td className="pr-4 text-right"><button type="button" className="btn !min-h-[34px] !px-2.5 text-[13px]" onClick={() => setEditing(g)}><Icon name="edit" size={14} /> Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.total === 0 && <p className="p-4 text-muted">No signs match.</p>}
      </section>
      {data && pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between text-[14px]">
          <span className="text-muted">{data.total.toLocaleString()} signs · page {page + 1} of {pages}</span>
          <span className="flex gap-2">
            <button type="button" className="btn !min-h-[36px]" disabled={page === 0} onClick={() => setPage(page - 1)}><Icon name="left" size={14} /> Previous</button>
            <button type="button" className="btn !min-h-[36px]" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next <Icon name="right" size={14} /></button>
          </span>
        </nav>
      )}
    </div>
  );
}
