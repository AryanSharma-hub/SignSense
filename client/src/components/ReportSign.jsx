import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { Icon } from './ui.jsx';
import { useAuth } from '../hooks/useAuth.js';

/**
 * "Report a problem with this sign": the shortest path from a learner who notices a wrong
 * sign to the admin review queue (feedback category "sign-accuracy", linked to the sign).
 */
export function ReportSignButton({ sign, page }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const send = useMutation({
    mutationFn: () => api.post('/feedback', { category: 'sign-accuracy', gestureId: sign.id, message, page }),
    onSuccess: () => setMessage(''),
  });
  if (!user || !sign?.id) return null;
  if (!open) {
    return <button type="button" className="btn btn-quiet !min-h-[38px] text-[13.5px]" onClick={() => { setOpen(true); send.reset(); }}><Icon name="flag" size={15} /> Report a problem</button>;
  }
  return (
    <form className="mt-2 w-full rounded-xl border border-line bg-surface2 p-3" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
      {send.isSuccess ? (
        <p className="text-[14px]" role="status">Thanks — the team will review {sign.gloss}. You can follow it under Feedback.
          <button type="button" className="btn btn-quiet ml-2 !min-h-[32px] text-[13px]" onClick={() => setOpen(false)}>Close</button></p>
      ) : (
        <>
          <label className="field-label" htmlFor={`report-${sign.id}`}>What looks wrong with {sign.gloss}?</label>
          <textarea id={`report-${sign.id}`} rows={2} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} className="input mt-1" placeholder="e.g. the handshape, where it is made, the movement…" />
          {send.error && <p role="alert" className="mt-1 text-[13px] text-live">{send.error.message}</p>}
          <div className="mt-2 flex gap-2">
            <button type="submit" className="btn btn-primary !min-h-[36px] text-[13.5px]" disabled={message.trim().length < 3 || send.isPending}>Send report</button>
            <button type="button" className="btn btn-quiet !min-h-[36px] text-[13.5px]" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </>
      )}
    </form>
  );
}
