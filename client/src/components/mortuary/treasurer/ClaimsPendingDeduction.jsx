import { Input as TextInput } from '../../ui/input';
import { FormField } from '../../ui/workspace';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Printer } from 'lucide-react';
import { treasurerAPI } from '../../../services/api';
import { Action, ClaimDialog, ClaimQueue, Detail } from './ClaimWorkflow';
import { fieldClass, peso, shortDate, useClaimQueue } from './claimWorkflowUtils';
import { showClaimAlert } from './claimAlerts';
import { printDeductionSummary } from './deductionSummary';

function BatchClaims({ claims, amount }) {
  return <div className="rounded-md border border-slate-200">
    <p className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">{claims.length} {claims.length === 1 ? 'claim' : 'claims'} in this batch</p>
    <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto">{claims.map((claim) => <li key={claim.claimId} className="flex justify-between gap-4 px-4 py-2 text-sm">
      <span><span className="font-medium text-slate-900">{claim.memberName}</span><span className="block text-xs text-slate-500">{claim.claimId} · Beneficiary: {claim.beneficiaryName || '—'}</span></span>
      {amount != null && <span className="shrink-0 tabular-nums text-slate-700">{peso(amount)}</span>}
    </li>)}</ul>
  </div>;
}

export default function ClaimsPendingDeduction({ onProcessed }) {
  const queue = useClaimQueue(treasurerAPI.getPendingDeductionClaims);
  const [rate, setRate] = useState(null);
  const [rateLoading, setRateLoading] = useState(true);
  const [selected, setSelected] = useState(() => new Map());
  const [open, setOpen] = useState(false);
  const [jvNumber, setJvNumber] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    treasurerAPI.getDeductionRate().then((res) => { if (active) setRate(res.data); })
      .catch(() => {}).finally(() => { if (active) setRateLoading(false); });
    return () => { active = false; };
  }, []);

  const toggle = (claim) => setSelected((old) => {
    const next = new Map(old);
    if (next.has(claim.claimId)) next.delete(claim.claimId); else next.set(claim.claimId, claim);
    return next;
  });
  const toggleAll = (claims, checked) => setSelected((old) => {
    const next = new Map(old);
    claims.forEach((claim) => { if (checked) next.set(claim.claimId, claim); else next.delete(claim.claimId); });
    return next;
  });
  const selectedClaims = [...selected.values()];

  const start = () => { setJvNumber(''); setPreview(null); setResult(null); setError(''); setOpen(true); };
  const close = () => { if (!inFlight.current) setOpen(false); };
  const review = async (event) => {
    event.preventDefault();
    if (!jvNumber.trim() || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const res = await treasurerAPI.previewDeductionBatch([...selected.keys()]);
      if (!res.data || !Number.isFinite(Number(res.data.amountPerMember)) || !Number.isFinite(Number(res.data.totalCollected))) throw new Error('Preview unavailable');
      setPreview(res.data);
    } catch (err) { setError(err.response?.data?.message || 'Unable to calculate this deduction. Please try again.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const process = async () => {
    if (!preview || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const res = await treasurerAPI.processDeductionBatch([...selected.keys()], jvNumber.trim());
      setResult(res.data);
      setSelected(new Map());
      await showClaimAlert({
        icon: 'success',
        title: 'Deduction processed successfully',
        text: `${res.data.claimCount} ${res.data.claimCount === 1 ? 'claim has' : 'claims have'} been recorded under JV ${jvNumber.trim()}.`,
        confirmButtonText: 'View summary',
      });
      queue.refresh();
      // Refresh failures must not report an already saved deduction as failed.
      await Promise.allSettled([Promise.resolve().then(() => onProcessed?.())]);
    } catch (err) {
      const message = err.response?.data?.message || 'Unable to process this deduction. Please try again.';
      setError(message);
      await showClaimAlert({ icon: 'error', title: 'Could not process deduction', text: message });
    }
    finally { inFlight.current = false; setBusy(false); }
  };

  const shown = result || preview;
  return <div className="mc-view space-y-5">
    <header className="mc-view-heading">
      <div><h2 className="text-2xl font-bold text-slate-900 tracking-tight">Approved claims</h2></div>
      <div className="mc-rate"><p>Deduction rate: <strong>{rateLoading ? 'Loading…' : rate ? peso(rate.amount) : 'Unavailable'}</strong>{rate && <span> per active member / per claim</span>}</p><p>Set in Settings{rate?.effectiveDate ? ` · ${shortDate(rate.effectiveDate)}` : ''}</p></div>
    </header>
    <ClaimQueue queue={queue} selected={selected} onToggle={toggle} onToggleAll={toggleAll} footer={<>
    <div className="mc-selection" role="status" aria-live="polite">
      <p className="text-sm text-slate-700">{selected.size ? <><strong>{selected.size}</strong> {selected.size === 1 ? 'claim' : 'claims'} selected{rate ? <> · <span className="tabular-nums">{peso(rate.amount * selected.size)}</span> per active member</> : null}</> : 'No claims selected'}</p>
      <div className="mc-selection-actions">
        {selected.size > 0 && <Action onClick={() => setSelected(new Map())}>Clear selection</Action>}
        <Action primary disabled={!selected.size} onClick={start}>Review deduction{selected.size ? ` (${selected.size})` : ''}</Action>
      </div>
    </div>
    <p className="mc-selection-help">You&apos;ll enter a reference number and review the impact before confirming.</p>
    <details className="mc-batch-help"><summary>About batch deductions</summary><p>Select the claims to deduct together (for example, all of this month&apos;s death claims), then record one JV number for the batch.</p></details>
    </>} />
    {open && <ClaimDialog title={result ? 'Deduction summary' : preview ? 'Confirm deduction' : 'Batch deduction'} step={result ? 'Completed' : preview ? 'Step 2 of 2 · Confirm assessment' : 'Step 1 of 2 · JV number'} busy={busy} onClose={close} footer={result ? <>
      <Action onClick={() => printDeductionSummary(result)}><Printer className="h-4 w-4" />Print summary</Action><Action primary onClick={close}>Done</Action>
    </> : <>
      <Action disabled={busy} onClick={() => { if (preview) { setPreview(null); setError(''); } else close(); }}>{preview ? 'Back' : 'Cancel'}</Action>
      {preview ? <Action primary disabled={busy} onClick={process}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? 'Processing deduction…' : 'Confirm deduction'}</Action> : <Action primary type="submit" form="deduction-details" disabled={busy || !jvNumber.trim()}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? 'Calculating impact…' : 'Review summary'}</Action>}
    </>}>
      {result && <div role="status" className="flex gap-3 text-sm leading-6 text-slate-700"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-coop-green" /><p>{result.claimCount} {result.claimCount === 1 ? 'claim was' : 'claims were'} recorded under <strong>{result.jvNumber}</strong>. These claims are now complete.</p></div>}
      {shown ? <>
        <dl><Detail label="JV number">{jvNumber.trim()}</Detail><Detail label="Claims in this batch">{shown.claimCount}</Detail><Detail label="Rate per claim">{peso(shown.ratePerClaim)}</Detail><Detail label="Deduction per member">{peso(shown.amountPerMember)}</Detail><Detail label="Active members charged">{Number(shown.membersCharged).toLocaleString()}</Detail><Detail label="Total assessment" strong>{peso(shown.totalCollected)}</Detail></dl>
        <BatchClaims claims={shown.claims} amount={shown.collectedPerClaim} />
        {!result && shown.membersGoingNegative > 0 && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"><strong>{shown.membersGoingNegative.toLocaleString()} members</strong> will have a negative balance after this assessment.</div>}
        {!result && <div className="flex gap-2 text-sm leading-6 text-slate-600"><AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-600" /><p>Confirming deducts {peso(shown.amountPerMember)} from each active member’s balance as one entry. This action cannot be undone from this screen.</p></div>}
      </> : <form id="deduction-details" onSubmit={review} className="space-y-5">
        <BatchClaims claims={selectedClaims} />
        <FormField><label htmlFor="deduction-jv" className="mb-1.5 block text-sm font-medium">Reference Number <span className="text-slate-500">(required)</span></label><TextInput id="deduction-jv" required autoComplete="off" disabled={busy} value={jvNumber} onChange={(e) => setJvNumber(e.target.value)} placeholder="Reference number" aria-describedby="jv-help" className={fieldClass} /><p id="jv-help" className="mt-2 text-xs text-slate-500">One reference number from the supporting journal document, used for every claim in this batch.</p></FormField>
      </form>}
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </ClaimDialog>}
  </div>;
}
