import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { treasurerAPI } from '../../../services/api';
import { Action, ClaimDialog, ClaimIdentity, ClaimQueue, Detail } from './ClaimWorkflow';
import { fieldClass, peso, shortDate, useClaimQueue } from './claimWorkflowUtils';

export default function ClaimsPendingDeduction({ user, showToast, onProcessed }) {
  const queue = useClaimQueue(treasurerAPI.getPendingDeductionClaims);
  const [rate, setRate] = useState(null);
  const [rateLoading, setRateLoading] = useState(true);
  const [target, setTarget] = useState(null);
  const [jvNumber, setJvNumber] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    treasurerAPI.getDeductionRate().then((res) => { if (active) setRate(res.data); })
      .catch(() => {}).finally(() => { if (active) setRateLoading(false); });
    return () => { active = false; };
  }, []);

  const open = (claim) => {
    setTarget(claim); setJvNumber(''); setPreview(null); setDone(false); setError('');
  };
  const close = () => { if (!inFlight.current) setTarget(null); };
  const review = async (event) => {
    event.preventDefault();
    if (!jvNumber.trim() || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const res = await treasurerAPI.previewClaimDeduction(target.claimId);
      if (!res.data || !Number.isFinite(Number(res.data.amountPerMember)) || !Number.isFinite(Number(res.data.totalCollected))) throw new Error('Preview unavailable');
      setPreview(res.data);
    } catch (err) { setError(err.response?.data?.message || 'Unable to calculate this deduction. Please try again.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const process = async () => {
    if (!preview || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      await treasurerAPI.processClaimDeduction(target.claimId, { processedBy: user?.name || user?.username, jvNumber: jvNumber.trim() });
      setDone(true);
      showToast?.('Deduction processed. Claim is now awaiting release.', 'success');
      queue.refresh(); onProcessed?.();
    } catch (err) { setError(err.response?.data?.message || 'Unable to process this deduction. Please try again.'); }
    finally { inFlight.current = false; setBusy(false); }
  };

  return <div className="space-y-5">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><h2 className="text-2xl font-semibold tracking-tight text-slate-900">Pending deduction</h2><p className="mt-1.5 text-sm text-slate-500">Review approved claims, record a JV number, and confirm the member assessment.</p></div>
      <div className="shrink-0 border-l-2 border-slate-200 pl-4"><p className="text-xs text-slate-500">Current deduction / member</p><p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{rateLoading ? 'Loading…' : rate ? peso(rate.amount) : 'Unavailable'}</p><p className="mt-0.5 text-xs text-slate-500">Set by Admin{rate?.effectiveDate ? ` · ${shortDate(rate.effectiveDate)}` : ''}</p></div>
    </header>
    <ClaimQueue queue={queue} onSelect={open} />
    {target && <ClaimDialog title={done ? 'Deduction recorded' : preview ? 'Confirm deduction' : 'Review deduction'} step={done ? 'Completed' : preview ? 'Step 2 of 2 · Confirm assessment' : 'Step 1 of 2 · Claim details'} busy={busy} onClose={close} footer={done ? <Action primary onClick={close}>Done</Action> : <>
      <Action disabled={busy} onClick={() => { if (preview) { setPreview(null); setError(''); } else close(); }}>{preview ? 'Back to details' : 'Cancel'}</Action>
      {preview ? <Action primary disabled={busy} onClick={process}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? 'Processing deduction…' : 'Confirm deduction'}</Action> : <Action primary type="submit" form="deduction-details" disabled={busy || !jvNumber.trim()}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? 'Calculating impact…' : 'Review impact'}</Action>}
    </>}>
      <ClaimIdentity claim={target} />
      {done ? <div role="status" className="flex gap-3 text-sm leading-6 text-slate-700"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-coop-green" /><p>The assessment has been recorded under <strong>{jvNumber.trim()}</strong>. This claim is now in <strong>Awaiting Release</strong>.</p></div> : preview ? <>
        <dl><Detail label="JV number">{jvNumber.trim()}</Detail><Detail label="Active members to be charged">{Number(preview.membersCharged).toLocaleString()}</Detail><Detail label="Deduction per member">{peso(preview.amountPerMember)}</Detail><Detail label="Total assessment" strong>{peso(preview.totalCollected)}</Detail></dl>
        {preview.membersGoingNegative > 0 && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"><strong>{preview.membersGoingNegative.toLocaleString()} members</strong> will have a negative balance after this assessment.</div>}
        <div className="flex gap-2 text-sm leading-6 text-slate-600"><AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-600" /><p>Confirming deducts the amount from the eligible members’ balances immediately. This action cannot be undone from this screen.</p></div>
      </> : <form id="deduction-details" onSubmit={review} className="space-y-5">
        <div className="rounded-md bg-slate-50 px-4 py-3"><p className="text-xs text-slate-500">Admin-set rate per member</p><p className="mt-1 text-xl font-semibold tabular-nums">{peso(rate?.amount)}</p><p className="mt-1 text-xs leading-5 text-slate-500">The next step calculates the current rate, member count, and balance impact before anything is deducted.</p></div>
        <div><label htmlFor="deduction-jv" className="mb-1.5 block text-sm font-medium">JV (Journal Disbursement) number <span className="text-slate-500">(required)</span></label><input id="deduction-jv" required autoComplete="off" disabled={busy} value={jvNumber} onChange={(e) => setJvNumber(e.target.value)} placeholder="Enter the JV number" aria-describedby="jv-help" className={fieldClass} /><p id="jv-help" className="mt-2 text-xs text-slate-500">Use the reference number from the supporting journal document.</p></div>
      </form>}
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </ClaimDialog>}
  </div>;
}
