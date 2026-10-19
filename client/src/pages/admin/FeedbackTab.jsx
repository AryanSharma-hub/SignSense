import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { Icon } from '../../components/ui.jsx';
import { Link } from '../../lib/router.js';
import { CATEGORIES, STATUS } from '../FeedbackPage.jsx';
import { fmt } from './OverviewTab.jsx';

function Item({ f, refresh }) {
  const [reply, setReply] = useState(f.adminReply ?? '');
  const [confirm, setConfirm] = useState(false);
  const update = useMutation({ mutationFn: (body) => api.patch(`/admin/feedback/${f.id}`, body), onSuccess: refresh });
  const remove = useMutation({ mutationFn: () => api.del(`/admin/feedback/${f.id}`), onSuccess: refresh });
  return (
    <li className="panel p-4">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="font-semibold">{f.user ? `${f.user.name} (${f.user.email})` : 'Deleted user'}</span>
        <span className="text-muted">{fmt(f.createdAt)}</span>
        <span className="rounded-md border border-line px-1.5 py-0.5 font-semibold">{CATEGORIES.find(([v]) => v === f.category)?.[1]}</span>
        {f.gloss && (f.gestureId ? <Link className="gloss underline-offset-2 hover:underline" to={`/admin/signs?edit=${f.gestureId}`}>{f.gloss}</Link> : <span className="gloss">{f.gloss}</span>)}
        {f.rating && <span aria-label={`Rated ${f.rating} of 5`} className="text-expression">{'★'.repeat(f.rating)}<span className="text-muted">{'★'.repeat(5 - f.rating)}</span></span>}
        <label className="ml-auto flex items-center gap-1.5"><span className="sr-only">Status</span>
          <select value={f.status} onChange={(e) => update.mutate({ status: e.target.value })} className="input !min-h-[34px] !w-auto text-[13px]">
            {Object.entries(STATUS).map(([v]) => <option key={v} value={v}>{v === 'new' ? 'New' : v === 'reviewing' ? 'Reviewing' : 'Resolved'}</option>)}
          </select></label>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-[15px]">{f.message}</p>
      {f.page && <p className="mt-1 text-[12.5px] text-muted">From {f.page}</p>}
      <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); update.mutate({ adminReply: reply, status: f.status === 'new' ? 'reviewing' : f.status }); }}>
        <label className="flex-1"><span className="field-label">Reply (the learner sees this)</span><textarea rows={2} maxLength={2000} value={reply} onChange={(e) => setReply(e.target.value)} className="input mt-1" /></label>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary !min-h-[40px]" disabled={update.isPending || reply === (f.adminReply ?? '')}>Save reply</button>
          {confirm
            ? <><button type="button" className="btn !min-h-[40px] !border-live text-live" onClick={() => remove.mutate()}>Delete</button><button type="button" className="btn btn-quiet !min-h-[40px]" onClick={() => setConfirm(false)}>Keep</button></>
            : <button type="button" className="btn btn-quiet !min-h-[40px]" aria-label="Delete feedback" onClick={() => setConfirm(true)}><Icon name="trash" size={15} /></button>}
        </div>
      </form>
      {f.repliedAt && <p className="mt-1 text-[12px] text-muted">Replied {fmt(f.repliedAt)}</p>}
      {(update.error || remove.error) && <p role="alert" className="mt-1 text-live">{(update.error || remove.error).message}</p>}
    </li>
  );
}

/** Every piece of feedback, newest unanswered first. */
export function FeedbackTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const q = useQuery({ queryKey: ['admin', 'feedback', status, category], queryFn: () => api.get(`/admin/feedback?${new URLSearchParams({ status, category })}`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="font-display text-[26px] font-semibold tracking-tight">Feedback</h2>
          <p className="text-[14px] text-muted">Reply, set a status, and follow sign reports through to a fix.</p></div>
        <div className="flex gap-2">
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="input !w-auto"><option value="">All statuses</option><option value="new">New</option><option value="reviewing">Reviewing</option><option value="resolved">Resolved</option></select>
          <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="input !w-auto"><option value="">All topics</option>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </div>
      </header>
      {q.isLoading ? <p className="text-muted">Loading…</p> : (
        <ul className="space-y-3">{(q.data?.feedback ?? []).map((f) => <Item key={`${f.id}-${f.status}-${f.repliedAt}`} f={f} refresh={refresh} />)}</ul>
      )}
      {q.data?.feedback?.length === 0 && <p className="panel p-4 text-muted">No feedback matches.</p>}
    </div>
  );
}
