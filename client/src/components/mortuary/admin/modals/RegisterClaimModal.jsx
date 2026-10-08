import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, CheckCircle2, ArrowRight, FileText, UserRound } from 'lucide-react';
import Modal from '../../shared/Modal';
import SearchableMemberSelect from '../../shared/SearchableMemberSelect';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import { beneficiaryAPI, claimAPI } from '../../../../services/api';
import { sanitizePhoneInput, validatePhPhone } from '../../../../utils/validation';

const emptyBeneficiary = { beneficiaryName: '', relationship: '', contactNumber: '', address: '' };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const formatDate = value => new Date(`${value}T12:00:00`).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

function Field({ id, label, required, children }) {
  return <div className="space-y-1.5"><label htmlFor={id} className="block text-sm font-semibold text-slate-700">{label}{required && <span className="text-rose-600"> *</span>}</label>{children}</div>;
}

export default function RegisterClaimModal(props) {
  // Each opening starts a fresh draft; closing never leaves a stale lookup behind.
  return props.isOpen ? <ClaimRegistration {...props} /> : null;
}

function ClaimRegistration({ onClose, members = [], membersLoading, membersError, onRetryMembers, user, onRegistered }) {
  const [step, setStep] = useState('details');
  const [memberId, setMemberId] = useState('');
  const [dateOfDeath, setDateOfDeath] = useState('');
  const [causeOfDeath, setCauseOfDeath] = useState('');
  const [remarks, setRemarks] = useState('');
  const [beneficiary, setBeneficiary] = useState(null);
  const [beneficiaryForm, setBeneficiaryForm] = useState(emptyBeneficiary);
  const [lookup, setLookup] = useState('idle');
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [discard, setDiscard] = useState(false);
  const lock = useRef(false);
  const heading = useRef(null);
  const selectedMember = members.find(m => String(m.id) === String(memberId));
  const dirty = !!(memberId || dateOfDeath || causeOfDeath || remarks);
  const recipient = beneficiary || beneficiaryForm;

  useEffect(() => { heading.current?.focus(); }, [step, discard]);
  useEffect(() => {
    if (!memberId) return;
    let cancelled = false;
    beneficiaryAPI.getHistory(memberId).then(res => {
      if (cancelled) return;
      if (!Array.isArray(res?.data)) throw new Error('Invalid beneficiary response');
      setBeneficiary(res.data.find(b => b.isActive) || null);
      setLookup('ready');
    }).catch(() => { if (!cancelled) setLookup('error'); });
    return () => { cancelled = true; };
  }, [memberId, retry]);

  const close = () => {
    if (lock.current) return;
    if (dirty && step !== 'success') setDiscard(true);
    else onClose();
  };
  const chooseMember = id => {
    if (String(id) === String(memberId)) return;
    const member = members.find(m => String(m.id) === String(id));
    setMemberId(id);
    setBeneficiary(null);
    setBeneficiaryForm({ ...emptyBeneficiary, beneficiaryName: member?.beneficiaries?.trim() || '', relationship: member?.beneficiaryRelationship?.trim() || '' });
    setLookup('loading');
    setError('');
  };
  const review = e => {
    e.preventDefault();
    setError('');
    if (!selectedMember) return setError('Please select the member this claim is for.');
    if (lookup !== 'ready') return setError('Please wait until the beneficiary details are available.');
    if (!dateOfDeath || dateOfDeath > today()) return setError('Enter a date of death that is today or earlier.');
    if (!beneficiary) {
      if (!beneficiaryForm.beneficiaryName.trim() || !beneficiaryForm.relationship.trim()) return setError('Enter the beneficiary’s full name and relationship.');
      const phoneError = validatePhPhone(beneficiaryForm.contactNumber);
      if (phoneError) return setError(phoneError);
    }
    setStep('review');
  };
  const submit = async () => {
    if (lock.current) return;
    lock.current = true;
    setSubmitting(true);
    setError('');
    let savedBeneficiary = beneficiary;
    try {
      if (!savedBeneficiary) {
        const res = await beneficiaryAPI.updateBeneficiary(memberId, {
          ...Object.fromEntries(Object.entries(beneficiaryForm).map(([key, value]) => [key, value.trim()])),
          updatedBy: user?.name || user?.username,
        });
        if (!res?.data?.beneficiaryId) throw new Error('The beneficiary could not be confirmed. Please try again.');
        savedBeneficiary = res.data;
        setBeneficiary(savedBeneficiary);
      }
      await claimAPI.createClaim({ memberId, beneficiaryId: savedBeneficiary.beneficiaryId, dateOfDeath, causeOfDeath: causeOfDeath.trim() || undefined, remarks: remarks.trim() || undefined, createdBy: user?.name || user?.username });
      setStep('success');
    } catch (err) {
      setError((savedBeneficiary && !beneficiary ? 'Beneficiary details were saved. ' : '') + (err.response?.data?.message || err.message || 'Unable to register this claim. Please try again.'));
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  };
  const finish = () => { onClose(); onRegistered?.(); };
  const update = key => e => setBeneficiaryForm(f => ({ ...f, [key]: key === 'contactNumber' ? sanitizePhoneInput(e.target.value) : e.target.value }));

  return <Modal isOpen onClose={step === 'success' ? finish : close} title="Register New Claim" maxWidth="max-w-2xl" className="rounded-2xl shadow-2xl" accessible>
    <div className="space-y-6" aria-busy={submitting}>
      {discard ? <div className="space-y-5">
        <h2 ref={heading} tabIndex={-1} className="text-lg font-semibold text-slate-900 outline-none">Leave this claim?</h2>
        <p className="text-sm text-slate-600">Your claim draft will be discarded.{beneficiary && step === 'review' ? ' Any beneficiary details already saved will remain on the member’s record.' : ''}</p>
        <div className="flex flex-wrap justify-end gap-3"><Button variant="secondary" onClick={onClose}>Discard draft</Button><Button onClick={() => setDiscard(false)}>Keep editing</Button></div>
      </div> : step === 'success' ? <div className="py-4 text-center space-y-4">
        <CheckCircle2 className="w-12 h-12 mx-auto text-coop-green" />
        <h2 ref={heading} tabIndex={-1} className="text-xl font-bold text-slate-900 outline-none">Claim registered</h2>
        <p className="text-sm text-slate-600">The claim for <strong>{selectedMember?.name}</strong> is now awaiting requirements.</p>
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Next, open the claim to add and verify the required documents.</div>
        <Button onClick={finish} className="w-full sm:w-auto">Back to claims</Button>
      </div> : <>
        <ol aria-label="Registration progress" className="flex gap-3 text-sm">
          {['Details', 'Review & register'].map((label, index) => <li key={label} aria-current={(step === 'details' ? index === 0 : index === 1) ? 'step' : undefined} className={`flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5 ${((step === 'details' && index === 0) || (step === 'review' && index === 1)) ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'bg-slate-50 text-slate-500'}`}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs">{index + 1}</span>{label}</li>)}
        </ol>
        <div><h2 ref={heading} tabIndex={-1} className="text-lg font-bold text-slate-900 outline-none">{step === 'details' ? 'Let’s start with the claim details' : 'Review before registering'}</h2><p className="mt-1 text-sm text-slate-500">{step === 'details' ? 'Select a member, confirm their beneficiary, and review the information. Fields marked * are required.' : 'Please check the member, beneficiary, and date below. You can go back to make changes.'}</p></div>
        {error && <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
        {step === 'details' ? <form onSubmit={review} className="space-y-5">
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><UserRound className="h-4 w-4 text-coop-green" /> Member & beneficiary</h3>
            <div><p id="claim-member-label" className="mb-1.5 text-sm font-semibold text-slate-700">Deceased member <span className="text-rose-600">*</span></p>
              {membersLoading ? <p role="status" className="text-sm text-slate-500">Loading members…</p> : membersError ? <div role="alert" className="text-sm text-rose-700">{membersError} <button type="button" onClick={onRetryMembers} className="underline font-semibold">Try again</button></div> : <SearchableMemberSelect members={members} value={memberId} onChange={chooseMember} placeholder="Search by member name or Passbook No." ariaLabel="Deceased member" />}
              {!membersLoading && !membersError && !members.length && <p className="mt-2 text-sm text-slate-500">No eligible members are available to register a claim.</p>}
            </div>
            {memberId && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              {lookup === 'loading' ? <p role="status" className="flex gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Looking up beneficiary details…</p> : lookup === 'error' ? <div role="alert" className="text-sm text-rose-700">We couldn’t load the beneficiary. Please try again before continuing.<button type="button" className="block mt-2 font-semibold underline" onClick={() => { setLookup('loading'); setRetry(n => n + 1); }}>Retry lookup</button></div> : beneficiary ? <div className="space-y-1 text-sm"><p className="flex gap-2 items-center font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Beneficiary on file</p><p className="font-semibold text-slate-900 break-words">{beneficiary.beneficiaryName}</p><p className="text-slate-600">{beneficiary.relationship} · {beneficiary.contactNumber}</p></div> : <div className="space-y-3">
                <div><p className="text-sm font-semibold text-slate-900">Complete the beneficiary details</p><p className="mt-1 text-xs leading-relaxed text-slate-500">There is no active beneficiary record. Any existing name and relationship are filled in below. These details will be saved when you register the claim.</p></div>
                <Field id="claim-beneficiary" label="Full name" required><Input id="claim-beneficiary" required value={beneficiaryForm.beneficiaryName} onChange={update('beneficiaryName')} autoComplete="name" /></Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field id="claim-relationship" label="Relationship" required><Input id="claim-relationship" required placeholder="e.g. Spouse" value={beneficiaryForm.relationship} onChange={update('relationship')} /></Field><Field id="claim-contact" label="Mobile number" required><Input id="claim-contact" required type="tel" inputMode="numeric" maxLength={11} placeholder="09171234567" value={beneficiaryForm.contactNumber} onChange={update('contactNumber')} /></Field></div>
                <Field id="claim-address" label="Address (optional)"><Input id="claim-address" value={beneficiaryForm.address} onChange={update('address')} /></Field>
              </div>}
            </div>}
          </section>
          <section className="space-y-4 border-t border-slate-100 pt-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><FileText className="h-4 w-4 text-coop-green" /> Claim information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field id="claim-death-date" label="Date of death" required><Input id="claim-death-date" type="date" required max={today()} value={dateOfDeath} onChange={e => setDateOfDeath(e.target.value)} /></Field><Field id="claim-cause" label="Cause of death (optional)"><Input id="claim-cause" value={causeOfDeath} onChange={e => setCauseOfDeath(e.target.value)} placeholder="Enter if known" /></Field></div>
            <Field id="claim-remarks" label="Remarks (optional)"><textarea id="claim-remarks" value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30" placeholder="Add any information helpful for reviewing this claim" /></Field>
          </section>
          <div className="sticky -bottom-5 border-t border-slate-200 bg-white py-4 flex flex-col-reverse sm:flex-row sm:justify-between gap-3"><Button variant="ghost" onClick={close}>Cancel</Button><Button type="submit" disabled={!memberId || lookup !== 'ready' || membersLoading || !!membersError}>Review claim <ArrowRight className="h-4 w-4" /></Button></div>
        </form> : <div className="space-y-5">
          <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
            {[[ 'Member', selectedMember?.name ], ['Passbook No.', memberId], ['Beneficiary', recipient.beneficiaryName], ['Relationship', recipient.relationship], ['Mobile number', recipient.contactNumber], ['Beneficiary address', recipient.address || 'Not provided'], ['Date of death', formatDate(dateOfDeath)], ['Date filed', 'Recorded automatically on registration'], ['Cause of death', causeOfDeath.trim() || 'Not provided'], ['Remarks', remarks.trim() || 'None']].map(([label, value]) => <div key={label} className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-1 sm:gap-4 py-3 text-sm"><dt className="text-slate-500">{label}</dt><dd className="font-medium text-slate-900 whitespace-pre-wrap break-words min-w-0">{value}</dd></div>)}
          </dl>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900"><p className="font-semibold">What happens next</p><p className="mt-1">Registering marks the member as deceased and creates a claim awaiting requirements. Benefit approval and payment happen after review.</p></div>
          <div className="sticky -bottom-5 border-t border-slate-200 bg-white py-4 flex flex-col-reverse sm:flex-row sm:justify-between gap-3"><Button variant="secondary" disabled={submitting} onClick={() => { setError(''); setStep('details'); }}>Back to details</Button><Button disabled={submitting} onClick={submit}>{submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Registering…</> : 'Register claim'}</Button></div>
        </div>}
      </>}
    </div>
  </Modal>;
}
