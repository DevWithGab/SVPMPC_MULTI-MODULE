import { useEffect, useRef, useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import api from '../../../services/api';

const peso = value => Number(value || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

export default function LedgerCorrectionDialog({ entry, member, historyOnly = false, onClose, onSaved }) {
  const dialog = useRef(null);
  const pending = entry.pendingCorrection;
  const [amount, setAmount] = useState(String(pending?.amount ?? entry.received));
  const [reason, setReason] = useState(pending?.reason || '');
  const [review, setReview] = useState(Boolean(pending));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempted, setAttempted] = useState(Boolean(pending));
  const request = useRef(null);
  const inFlight = useRef(false);
  const before = pending?.expectedAmount ?? entry.received;
  const delta = Math.round((Number(amount) - before) * 100) / 100;
  const valid = /^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0 && Number(amount) !== before && reason.trim().length >= 10 && reason.trim().length <= 500;
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  const submit = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setAttempted(true);
    request.current ||= { amount: Number(amount), reason: reason.trim(), expectedAmount: before, expectedBalance: member.balance };
    try {
      await api.post(`/mortuary/treasurer/ledger/${encodeURIComponent(member.id)}/entries/${encodeURIComponent(pending?.sourceLedgerId || entry.sourceLedgerId || entry.id)}/correct`, request.current);
      await onSaved();
    } catch (cause) {
      setError(cause.response?.data?.message || 'Unable to confirm the result. Retry this same correction safely, or close and refresh the ledger.');
    } finally { inFlight.current = false; setBusy(false); }
  };
  return <dialog ref={dialog} aria-labelledby="ledger-correction-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto w-[calc(100%_-_2rem)] max-w-xl max-h-[90dvh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-black/40">
    <h2 id="ledger-correction-title" className="text-xl font-bold">{historyOnly ? 'Correction history' : pending ? 'Finish saved correction' : 'Correct entry'}</h2>
    <p className="mt-2 text-sm text-slate-600">{member.name} · Reference {entry.ref_no}</p>
    {historyOnly ? <ol className="mt-5 space-y-4">{entry.correctionHistory.map(item => <li key={item.ledgerId} className="border-b border-slate-200 pb-4">
      <p className="font-semibold">{peso(item.beforeAmount)} → {peso(item.afterAmount)}</p>
      <p className="mt-1 whitespace-pre-wrap break-words">{item.reason}</p>
      <p className="mt-2 text-sm text-slate-500">{item.userName} · {new Date(item.createdAt).toLocaleString('en-PH')}</p>
      {!item.completed && <p className="text-sm text-amber-800">Balance saved; payment history or audit log needs retry.</p>}
    </li>)}</ol> : <>
      <p className="mt-4 text-sm text-slate-600">The original entry stays in the ledger. A linked reversal and replacement record the correction.</p>
      {!review ? <form className="mt-5 space-y-4" onSubmit={event => { event.preventDefault(); if (valid) setReview(true); }}>
        <p>Original amount: <strong>{peso(before)}</strong></p>
        <label className="block text-sm font-medium">Corrected amount<Input autoFocus type="number" min="0.01" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} /></label>
        <label className="block text-sm font-medium">Reason for correction<textarea className="mt-1 w-full rounded-md border border-slate-300 p-3" rows={3} minLength={10} maxLength={500} required value={reason} onChange={event => setReason(event.target.value)} placeholder="Example: Entered 1,000 instead of 100 from the receipt." /></label>
        <p className="text-xs text-slate-500">Required: 10–500 characters. Your name and the time will be recorded.</p>
        <Button type="submit" disabled={!valid}>Review correction</Button>
      </form> : <div className="mt-5 space-y-3">
        <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-sm">
          <dt>Original amount</dt><dd className="text-right">{peso(before)}</dd>
          <dt>Corrected amount</dt><dd className="text-right font-semibold">{peso(Number(amount))}</dd>
          <dt>Balance adjustment</dt><dd className="text-right">{delta > 0 ? '+' : ''}{peso(delta)}</dd>
          <dt>{pending ? 'Current balance (already adjusted)' : 'Balance after correction'}</dt><dd className="text-right font-bold">{peso(pending ? member.balance : member.balance + delta)}</dd>
        </dl>
        <p className="whitespace-pre-wrap break-words text-sm"><strong>Reason:</strong> {reason}</p>
        <p className="text-sm text-slate-600">{pending ? 'Retry completes the payment history and audit log without another balance adjustment.' : 'Confirm that the amount matches the original receipt or opening balance record.'}</p>
      </div>}
    </>}
    {error && <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      <Button variant="outline" disabled={busy} onClick={onClose}>Close</Button>
      {!historyOnly && review && !attempted && <Button variant="outline" onClick={() => setReview(false)}>Back</Button>}
      {!historyOnly && review && <Button disabled={busy} onClick={submit}>{busy ? 'Saving…' : attempted ? 'Retry correction' : 'Confirm correction'}</Button>}
    </div>
  </dialog>;
}
