import { useRef, useState } from 'react';
import { CheckCircle2, Loader2, Printer } from 'lucide-react';
import { treasurerAPI } from '../../../services/api';
import { printClaimReceipt } from './claimReceipt';
import { Action, ClaimDialog, ClaimIdentity, ClaimQueue, Detail } from './ClaimWorkflow';
import { fieldClass, peso, shortDate, useClaimQueue } from './claimWorkflowUtils';

const todayIso = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function ClaimsAwaitingRelease({ user, showToast, onReleased }) {
  const queue = useClaimQueue(treasurerAPI.getAwaitingReleaseClaims);
  const [target, setTarget] = useState(null);
  const [form, setForm] = useState({ dvNumber: '', releaseDate: todayIso(), remarks: '' });
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [released, setReleased] = useState(null);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  const open = (claim) => {
    setTarget(claim); setReview(false); setReleased(null); setError('');
    setForm({ dvNumber: '', releaseDate: todayIso(), remarks: '' });
  };
  const close = () => { if (!inFlight.current) setTarget(null); };
  const release = async () => {
    if (inFlight.current || !review || !form.dvNumber.trim() || !form.releaseDate) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const res = await treasurerAPI.releaseClaim(target.claimId, { dvNumber: form.dvNumber.trim(), releaseDate: form.releaseDate, remarks: form.remarks.trim() || undefined, releasedBy: user?.name || user?.username });
      setReleased(res.data);
      showToast?.('Disbursement recorded successfully.', 'success');
      queue.refresh(); onReleased?.();
    } catch (err) { setError(err.response?.data?.message || 'Unable to record this disbursement. Please try again.'); }
    finally { inFlight.current = false; setBusy(false); }
  };

  return <div className="space-y-5">
    <header><h2 className="text-2xl font-semibold tracking-tight text-slate-900">Awaiting release</h2><p className="mt-1.5 text-sm text-slate-500">Record the disbursement for claims with completed deductions.</p></header>
    <ClaimQueue queue={queue} release onSelect={open} />
    <p className="text-xs leading-5 text-slate-500">For release shows the beneficiary’s payout after the benefit cap. Any retained amount remains with the cooperative.</p>
    {target && <ClaimDialog title={released ? 'Disbursement recorded' : review ? 'Confirm release' : 'Prepare release'} step={released ? 'Completed' : review ? 'Step 2 of 2 · Confirm disbursement' : 'Step 1 of 2 · Disbursement details'} busy={busy} onClose={close} footer={released ? <>
      <Action onClick={() => printClaimReceipt(released)}><Printer className="h-4 w-4" />Print receipt</Action><Action primary onClick={close}>Done</Action>
    </> : <>
      <Action disabled={busy} onClick={() => { if (review) { setReview(false); setError(''); } else close(); }}>{review ? 'Back to details' : 'Cancel'}</Action>
      {review ? <Action primary onClick={release} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? 'Recording release…' : 'Confirm release'}</Action> : <Action primary type="submit" form="release-details" disabled={!form.dvNumber.trim() || !form.releaseDate}>Review release</Action>}
    </>}>
      <ClaimIdentity claim={target} />
      {released ? <>
        <div role="status" className="flex items-start gap-3 text-sm leading-6 text-slate-700"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-coop-green" /><p><strong>{peso(released.payout?.amount)}</strong> recorded as released to <strong>{released.beneficiaryName}</strong>.</p></div>
        <dl><Detail label="DV number">{released.payout?.dvNumber}</Detail><Detail label="Release date">{shortDate(released.payout?.releasedAt)}</Detail></dl><p className="text-sm text-slate-500">You can print the receipt now or find it later in the Disbursement Report.</p>
      </> : <>
        <div><p className="text-xs text-slate-500">Amount to beneficiary</p><p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{peso(target.payoutAmount ?? target.deduction?.totalCollected)}</p><p className="mt-1 text-xs text-slate-500">Calculated from the deduction collected and the benefit cap.</p></div>
        <dl className="rounded-md bg-slate-50 px-4"><Detail label="Total collected">{peso(target.deduction?.totalCollected)}</Detail>{target.retainedAmount > 0 && <><Detail label="Benefit cap">{peso(target.maxBenefitAmount)}</Detail><Detail label="Retained by cooperative">{peso(target.retainedAmount)}</Detail></>}</dl>
        {review ? <>
          <dl><Detail label="DV number">{form.dvNumber.trim()}</Detail><Detail label="Release date">{shortDate(`${form.releaseDate}T00:00:00`)}</Detail>{form.remarks.trim() && <Detail label="Remarks">{form.remarks.trim()}</Detail>}</dl>
          <p className="border-t border-slate-200 pt-4 text-sm leading-6 text-slate-600">Confirm that the beneficiary, amount, and voucher details match the disbursement. Confirming marks this claim as released.</p>
        </> : <form id="release-details" onSubmit={(event) => { event.preventDefault(); if (form.dvNumber.trim() && form.releaseDate) setReview(true); }} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="release-dv" className="mb-1.5 block text-sm font-medium">DV number (required)</label><input id="release-dv" required autoComplete="off" className={fieldClass} placeholder="Enter voucher number" value={form.dvNumber} onChange={(e) => setForm({ ...form, dvNumber: e.target.value })} /></div><div><label htmlFor="release-date" className="mb-1.5 block text-sm font-medium">Release date (required)</label><input id="release-date" type="date" required className={fieldClass} value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} /></div></div>
          <div><label htmlFor="release-remarks" className="mb-1.5 block text-sm font-medium">Remarks <span className="font-normal text-slate-500">(optional)</span></label><textarea id="release-remarks" rows={3} className={fieldClass} placeholder="Add a note for this disbursement" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
        </form>}
      </>}
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </ClaimDialog>}
  </div>;
}
