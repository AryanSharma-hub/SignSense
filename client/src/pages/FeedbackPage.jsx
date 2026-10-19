import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useVocabulary } from '../api/hooks.js';

export const CATEGORIES = [
  ['sign-accuracy', 'A sign looks wrong'], ['lesson', 'A lesson or test'], ['bug', 'Something isn’t working'],
  ['suggestion', 'An idea or suggestion'], ['other', 'Something else'],
];
export const STATUS = { new: 'Sent', reviewing: 'Being looked at', resolved: 'Resolved' };

function Stars({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Rating" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(value === n ? null : n)} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-surface2">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"
            fill={value && n <= value ? 'rgb(var(--expression))' : 'none'} stroke="rgb(var(--expression))" strokeWidth="1.6" strokeLinejoin="round" /></svg>
        </button>
      ))}
    </div>
  );
}

/** Send feedback (optionally about a specific sign) and follow what happened to it. */
export default function FeedbackPage({ settings }) {
  const qc = useQueryClient();
  const voc = useVocabulary();
  const mine = useQuery({ queryKey: ['learn', 'feedback'], queryFn: () => api.get('/feedback/mine') });
  const [form, setForm] = useState({ category: 'suggestion', rating: null, message: '', sign: '' });
  const signMatch = useMemo(() => {
    const g = form.sign.trim().toUpperCase();
    return g ? voc.gestures.find((x) => x.gloss === g) : null;
  }, [form.sign, voc.gestures]);
  const send = useMutation({
    mutationFn: () => api.post('/feedback', {
      category: form.category, rating: form.rating, message: form.message,
      gestureId: form.category === 'sign-accuracy' ? signMatch?.id : undefined, page: '/feedback',
    }),
    onSuccess: () => { setForm({ category: 'suggestion', rating: null, message: '', sign: '' }); qc.invalidateQueries({ queryKey: ['learn', 'feedback'] }); },
  });
  const needsSign = form.category === 'sign-accuracy';

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="panel p-5" aria-labelledby="fb-title">
        <h2 id="fb-title" className="font-display text-[26px] font-semibold tracking-tight">Send feedback</h2>
        <p className="mb-4 text-[14.5px] text-muted">The team reads every message. Reports about wrong signs go straight to the sign review queue.</p>
        {!settings.feedbackEnabled ? <p className="rounded-xl bg-surface2 p-3 text-muted">Feedback is switched off right now.</p> : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
            <fieldset>
              <legend className="field-label mb-1.5">What is it about?</legend>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {CATEGORIES.map(([v, label]) => (
                  <label key={v} className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border px-3 text-[14.5px] ${form.category === v ? 'border-hand bg-hand/10' : 'border-line bg-surface'}`}>
                    <input type="radio" name="category" value={v} checked={form.category === v} onChange={() => setForm({ ...form, category: v })} className="accent-[rgb(var(--hand))]" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            {needsSign && (
              <label className="block">
                <span className="field-label">Which sign?</span>
                <input list="sign-glosses" value={form.sign} onChange={(e) => setForm({ ...form, sign: e.target.value })} className="input mt-1" placeholder="e.g. WATER" />
                <datalist id="sign-glosses">{voc.gestures.slice(0, 3000).map((g) => <option key={g.id} value={g.gloss} />)}</datalist>
                <span className="mt-1 block text-[13px] text-muted">{form.sign && (signMatch ? `Linked to ${signMatch.gloss}.` : 'No sign with that name — your message will still be sent.')}</span>
              </label>
            )}
            <div><span className="field-label">How would you rate SignSense? (optional)</span><Stars value={form.rating} onChange={(rating) => setForm({ ...form, rating })} /></div>
            <label className="block">
              <span className="field-label">Your message</span>
              <textarea rows={5} required minLength={3} maxLength={2000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="input mt-1" />
              <span className="mt-1 block text-right text-[12px] text-muted">{form.message.length}/2000</span>
            </label>
            {send.error && <p role="alert" className="rounded-lg border border-live/40 bg-live/10 px-3 py-2 text-[14px]">{send.error.message}</p>}
            {send.isSuccess && <p role="status" className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-[14px]">Thank you — your feedback was sent.</p>}
            <button type="submit" className="btn btn-primary" disabled={form.message.trim().length < 3 || send.isPending}>{send.isPending ? 'Sending…' : 'Send feedback'}</button>
          </form>
        )}
      </section>

      <section className="panel p-5" aria-labelledby="fb-mine">
        <h2 id="fb-mine" className="font-display text-[20px] font-semibold">Your feedback</h2>
        {mine.isLoading ? <p className="text-muted">Loading…</p> : (mine.data?.feedback?.length ? (
          <ul className="mt-3 space-y-3">
            {mine.data.feedback.map((f) => (
              <li key={f.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                  <span className="rounded-md border border-line px-1.5 py-0.5 font-semibold">{CATEGORIES.find(([v]) => v === f.category)?.[1]}</span>
                  {f.gloss && <span className="gloss">{f.gloss}</span>}
                  <span className={`ml-auto rounded-md px-1.5 py-0.5 font-bold ${f.status === 'resolved' ? 'bg-ok/15 text-ok' : f.status === 'reviewing' ? 'bg-expression/15 text-expression' : 'bg-surface2 text-muted'}`}>{STATUS[f.status]}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[14.5px]">{f.message}</p>
                <p className="mt-1 text-[12px] text-muted">{new Date(f.createdAt).toLocaleString()}</p>
                {f.adminReply && <div className="mt-2 rounded-lg border-l-4 border-hand bg-hand/10 px-3 py-2 text-[14px]"><p className="text-[12px] font-bold text-muted">Reply from the team</p><p className="whitespace-pre-wrap">{f.adminReply}</p></div>}
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-[14.5px] text-muted">You haven’t sent any feedback yet.</p>)}
      </section>
    </div>
  );
}
