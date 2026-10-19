import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { Icon, TONE, SourceBadge } from '../../components/ui.jsx';
import { SignPlayer } from '../../components/SignPlayer.jsx';
import { blankStep } from '../../lib/steps.js';

export const POS = ['', 'noun', 'verb', 'adj', 'adv', 'pronoun', 'interj'];

/** After any sign write: refresh the dashboard lists and the public vocabulary everywhere. */
export function useInvalidateSigns() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['admin'] });
    qc.invalidateQueries({ queryKey: ['gestures'] });
    qc.invalidateQueries({ queryKey: ['learn'] });
  };
}

const toForm = (g) => ({
  gloss: g?.gloss ?? '', english: g?.english ?? '', pos: g?.pos ?? '', meaning: g?.meaning ?? '',
  keywords: (g?.keywords ?? []).map((k) => ({ keyword: k.keyword ?? k[0], weight: k.weight ?? k[1] ?? 1 })),
  signForm: (g?.signForm?.length ? g.signForm : [blankStep()]).map((s) => ({
    E: s.E ?? null, HD: s.HD ?? null, L: s.L ?? null,
    H: { right: s.H?.right ?? null, left: s.H?.left ?? null }, M: { right: s.M?.right ?? null, left: s.M?.left ?? null }, together: s.together ?? [],
  })),
});

function Select({ label, value, options, onChange, k }) {
  return (
    <label className="block min-w-0">
      <span className={`text-[12px] font-semibold ${TONE[k]?.text ?? 'text-muted'}`}>{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className="input mt-0.5 !min-h-[38px] text-[14px]">
        <option value="">—</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}

/**
 * Create or edit a sign: names and meaning, the English words it answers to, and its
 * steps (each step one moment: hands, place, movement, face, head), previewed live.
 */
export function SignEditor({ sign, vocab, onDone, initialSteps }) {
  const invalidate = useInvalidateSigns();
  const isNew = !sign?.id;
  const [form, setForm] = useState(() => (initialSteps ? { ...toForm(null), signForm: toForm({ signForm: initialSteps }).signForm } : toForm(sign)));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hands = useMemo(() => vocab.hands.filter((h) => h.family !== 'legacy'), [vocab]);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setStep = (i, fn) => set({ signForm: form.signForm.map((s, k) => (k === i ? fn(s) : s)) });

  const save = useMutation({
    mutationFn: () => (isNew ? api.post('/admin/signs', form) : api.put(`/admin/signs/${sign.id}`, form)),
    onSuccess: (d) => { invalidate(); onDone?.(d.sign); },
  });
  const review = useMutation({
    mutationFn: (reviewed) => api.post(`/admin/signs/${sign.id}/review`, { reviewed }),
    onSuccess: () => { invalidate(); onDone?.({ ...sign, needsReview: !sign.needsReview }); },
  });
  const remove = useMutation({ mutationFn: () => api.del(`/admin/signs/${sign.id}`), onSuccess: () => { invalidate(); onDone?.(null); } });
  const err = save.error || review.error || remove.error;

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-[20px] font-semibold">{isNew ? 'New sign' : <>Edit <span className="gloss">{sign.gloss}</span></>}</h3>
        {!isNew && <SourceBadge sign={sign} />}
        {!isNew && (sign.needsReview
          ? <span className="rounded-md border border-line px-1.5 py-0.5 text-[12px] font-semibold text-muted">Not reviewed</span>
          : <span className="rounded-md bg-ok/15 px-1.5 py-0.5 text-[12px] font-bold text-ok">Reviewed</span>)}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-1"><span className="field-label">Gloss</span><input required value={form.gloss} onChange={(e) => set({ gloss: e.target.value })} maxLength={60} className="input mt-1 uppercase" /></label>
            <label className="block"><span className="field-label">English word</span><input value={form.english} onChange={(e) => set({ english: e.target.value })} maxLength={60} className="input mt-1" placeholder="defaults to the gloss" /></label>
            <label className="block"><span className="field-label">Part of speech</span>
              <select value={form.pos} onChange={(e) => set({ pos: e.target.value })} className="input mt-1">{POS.map((p) => <option key={p} value={p}>{p || '—'}</option>)}</select></label>
          </div>
          <label className="block"><span className="field-label">Meaning / how it is signed</span><textarea required rows={2} maxLength={400} value={form.meaning} onChange={(e) => set({ meaning: e.target.value })} className="input mt-1" /></label>

          <fieldset>
            <legend className="field-label mb-1">Words that bring up this sign (weight 1 = same sign, lower = weaker match)</legend>
            <ul className="space-y-1.5">
              {form.keywords.map((k, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input aria-label="Keyword" value={k.keyword} onChange={(e) => set({ keywords: form.keywords.map((x, j) => (j === i ? { ...x, keyword: e.target.value } : x)) })} className="input !min-h-[38px] flex-1 text-[14px]" />
                  <input aria-label="Weight" type="number" min="0.05" max="1" step="0.05" value={k.weight} onChange={(e) => set({ keywords: form.keywords.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)) })} className="input !min-h-[38px] w-[84px] text-[14px]" />
                  <button type="button" className="btn btn-quiet !min-h-[38px] !px-2" aria-label={`Remove keyword ${k.keyword}`} onClick={() => set({ keywords: form.keywords.filter((_, j) => j !== i) })}><Icon name="x" size={15} /></button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-quiet mt-1 !min-h-[36px] text-[13.5px]" onClick={() => set({ keywords: [...form.keywords, { keyword: '', weight: 1 }] })}><Icon name="plus" size={14} /> Add keyword</button>
          </fieldset>
        </div>
        <div>
          <p className="field-label mb-1">Preview</p>
          <SignPlayer signForm={form.signForm} vocab={vocab} label="this sign" autoPlay={false} className="rounded-xl border border-line p-2" />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="field-label mb-1">Steps — each step is one moment; later steps change only what they set</legend>
        {form.signForm.map((s, i) => (
          <div key={i} className="rounded-xl border border-line bg-surface2/50 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[13px] font-bold">Step {i + 1}</span>
              <span className="ml-auto flex">
                <button type="button" className="btn btn-quiet !min-h-[32px] !px-2" disabled={i === 0} aria-label={`Move step ${i + 1} up`} onClick={() => { const a = form.signForm.slice(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; set({ signForm: a }); }}><Icon name="up" size={15} /></button>
                <button type="button" className="btn btn-quiet !min-h-[32px] !px-2" disabled={i === form.signForm.length - 1} aria-label={`Move step ${i + 1} down`} onClick={() => { const a = form.signForm.slice(); [a[i + 1], a[i]] = [a[i], a[i + 1]]; set({ signForm: a }); }}><Icon name="down" size={15} /></button>
                <button type="button" className="btn btn-quiet !min-h-[32px] !px-2" disabled={form.signForm.length === 1} aria-label={`Remove step ${i + 1}`} onClick={() => set({ signForm: form.signForm.filter((_, j) => j !== i) })}><Icon name="trash" size={15} /></button>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Select k="H" label="Right hand" value={s.H.right} options={hands} onChange={(v) => setStep(i, (x) => ({ ...x, H: { ...x.H, right: v } }))} />
              <Select k="H" label="Left hand" value={s.H.left} options={hands} onChange={(v) => setStep(i, (x) => ({ ...x, H: { ...x.H, left: v } }))} />
              <Select k="M" label="Right movement" value={s.M.right} options={vocab.movements} onChange={(v) => setStep(i, (x) => ({ ...x, M: { ...x.M, right: v } }))} />
              <Select k="M" label="Left movement" value={s.M.left} options={vocab.movements} onChange={(v) => setStep(i, (x) => ({ ...x, M: { ...x.M, left: v } }))} />
              <Select k="L" label="Location" value={s.L} options={vocab.locations} onChange={(v) => setStep(i, (x) => ({ ...x, L: v }))} />
              <Select k="E" label="Face" value={s.E} options={vocab.expressions} onChange={(v) => setStep(i, (x) => ({ ...x, E: v }))} />
              <Select k="HD" label="Head" value={s.HD} options={vocab.heads} onChange={(v) => setStep(i, (x) => ({ ...x, HD: v }))} />
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-quiet !min-h-[36px] text-[13.5px]" disabled={form.signForm.length >= 12} onClick={() => set({ signForm: [...form.signForm, blankStep()] })}><Icon name="plus" size={14} /> Add step</button>
      </fieldset>

      {err && <p role="alert" className="rounded-lg border border-live/40 bg-live/10 px-3 py-2 text-[14px]">{err.message}</p>}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <button type="submit" className="btn btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : isNew ? 'Create sign' : 'Save changes'}</button>
        {!isNew && (
          <button type="button" className="btn" disabled={review.isPending} onClick={() => review.mutate(sign.needsReview)}>
            <Icon name="check" size={15} /> {sign.needsReview ? 'Mark as reviewed' : 'Mark as not reviewed'}
          </button>
        )}
        <button type="button" className="btn btn-quiet" onClick={() => onDone?.(sign ?? null, { cancelled: true })}>Cancel</button>
        {!isNew && (confirmDelete ? (
          <span className="ml-auto flex items-center gap-2 text-[14px]">Delete {sign.gloss} for everyone?
            <button type="button" className="btn !min-h-[38px] !border-live text-live" onClick={() => remove.mutate()}>Delete</button>
            <button type="button" className="btn btn-quiet !min-h-[38px]" onClick={() => setConfirmDelete(false)}>Keep</button></span>
        ) : <button type="button" className="btn btn-quiet ml-auto text-live" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={15} /> Delete sign</button>)}
      </div>
      {!isNew && <p className="text-[12.5px] text-muted">Saving changes marks the sign as not reviewed again. Edited and admin-created signs are never overwritten by data upgrades.</p>}
    </form>
  );
}
