import { useEffect, useRef, useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import api from '../../../services/api';

const peso = value => Number(value || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

export default function LedgerCorrectionDialog({ entry, member, onClose, onSaved }) {
  const dialog = useRef(null);
  const pending = entry.pendingCorrection;
  const [amount, setAmount] = useState(String(pending?.amount ?? entry.received));
  const [review, setReview] = useState(Boolean(pending));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempted, setAttempted] = useState(Boolean(pending));
  const request = useRef(null);
  const inFlight = useRef(false);
  const before = pending?.expectedAmount ?? entry.received;
  const delta = Math.round((Number(amount) - before) * 100) / 100;
  const valid = /^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0 && Number(amount) !== before;
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  const submit = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setAttempted(true);
    request.current ||= { amount: Number(amount), reason: pending?.reason || '', expectedAmount: before, expectedBalance: member.balance };
    try {
      await api.post(`/mortuary/treasurer/ledger/${encodeURIComponent(member.id)}/entries/${encodeURIComponent(pending?.sourceLedgerId || entry.sourceLedgerId || entry.id)}/correct`, request.current);
      await onSaved();
    } catch (cause) {
      setError(cause.response?.data?.message || 'Unable to confirm the result. Retry this same correction safely, or close and refresh the ledger.');
    } finally { inFlight.current = false; setBusy(false); }
  };
  return <dialog ref={dialog} aria-labelledby="ledger-correction-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto w-[calc(100%_-_2rem)] max-w-xl max-h-[90dvh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-black/40">
    <h2 id="ledger-correction-title" className="text-xl font-bold">{pending ? 'Finish saved edit' : 'Edit amount'}</h2>
    <p className="mt-2 text-sm text-slate-600">{member.name} · Reference {entry.ref_no}</p>
    <>
      <p className="mt-4 text-sm text-slate-600">The ledger and printed statement will show the updated amount. Your name, the time, and the old and new amounts are saved in the audit log.</p>
      {!review ? <form className="mt-5 space-y-4" onSubmit={event => { event.preventDefault(); if (valid) setReview(true); }}>
        <p>Original amount: <strong>{peso(before)}</strong></p>
        <label className="block text-sm font-medium">New amount<Input autoFocus type="number" min="0.01" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} /></label>
        <Button type="submit" disabled={!valid}>Review change</Button>
      </form> : <div className="mt-5 space-y-3">
        <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-sm">
          <dt>Original amount</dt><dd className="text-right">{peso(before)}</dd>
          <dt>New amount</dt><dd className="text-right font-semibold">{peso(Number(amount))}</dd>
          <dt>Balance adjustment</dt><dd className="text-right">{delta > 0 ? '+' : ''}{peso(delta)}</dd>
          <dt>{pending ? 'Current balance (already adjusted)' : 'Balance after edit'}</dt><dd className="text-right font-bold">{peso(pending ? member.balance : member.balance + delta)}</dd>
        </dl>
        <p className="text-sm text-slate-600">{pending ? 'Retry completes the payment history and audit log without another balance adjustment.' : 'Confirm that the amount matches the original receipt or opening balance record.'}</p>
      </div>}
    </>
    {error && <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      <Button variant="outline" disabled={busy} onClick={onClose}>Close</Button>
      {review && !attempted && <Button variant="outline" onClick={() => setReview(false)}>Back</Button>}
      {review && <Button disabled={busy} onClick={submit}>{busy ? 'Saving…' : attempted ? 'Retry save' : 'Save amount'}</Button>}
    </div>
  </dialog>;
}
