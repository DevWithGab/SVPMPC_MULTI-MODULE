import { Button as ActionButton } from '../../ui/button';
import { Input as TextInput } from '../../ui/input';
import { FormField, ModalActions } from '../../ui/workspace';
import { useEffect, useRef } from 'react';
import { Banknote, Loader2 } from 'lucide-react';
import Modal from '../shared/Modal';
import SearchableMemberSelect from '../shared/SearchableMemberSelect';
import './RecordContributionModal.css';

export default function RecordContributionModal({
  isOpen, onClose, onSubmit, members, lockedMember, selectedMember,
  contribution, setContribution, submitting,
}) {
  const formRef = useRef(null);
  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      formRef.current?.querySelector(lockedMember ? '#contribution-amount' : '[role="button"]')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen, lockedMember]);

  const update = (key, value) => {
    if (!submitting) setContribution(previous => ({ ...previous, [key]: value }));
  };
  const member = lockedMember || selectedMember;

  return <Modal isOpen={isOpen} onClose={() => { if (!submitting) onClose(); }} title={lockedMember ? 'Record member deposit' : 'Record contribution payment'} accessible maxWidth="max-w-lg" className="contribution-payment-modal">
    <form ref={formRef} onSubmit={onSubmit} aria-busy={submitting} className="cp-form">
      <div className="cp-intro"><span className="cp-icon"><Banknote size={19} aria-hidden="true" /></span><div><p className="cp-eyebrow">Mortuary contributions</p><p>Enter the payment details for the member's ledger.</p></div></div>
      <fieldset disabled={submitting} className="cp-fields">
        <legend className="sr-only">Contribution payment details</legend>
        <div className="cp-field">
          <p id="contribution-member-label" className="cp-label">Member <span>(required)</span></p>
          {lockedMember ? <div className="cp-locked-member" aria-labelledby="contribution-member-label"><strong>{lockedMember.name || lockedMember.memberName}</strong><span>Passbook: {(lockedMember.id || lockedMember.memberId)?.toString().padStart(6, '0')}</span></div> : <div className="cp-member-picker" inert={submitting || undefined}><SearchableMemberSelect members={members} value={contribution.member_id} onChange={value => update('member_id', value)} placeholder="Search name or Passbook No." ariaLabel="Member (required): search name or Passbook No." /></div>}
        </div>
        <FormField className="cp-field"><label htmlFor="contribution-barangay">Barangay <span>(from member record)</span></label><TextInput id="contribution-barangay" value={member?.barangay || ''} placeholder="Select a member to see their barangay" readOnly className="cp-readonly" /></FormField>
        <div className="cp-columns">
          <FormField className="cp-field"><label htmlFor="contribution-amount">Amount (₱) <span>(required)</span></label><TextInput id="contribution-amount" type="number" min="1" step="0.01" placeholder="500.00" value={contribution.amount} onChange={e => update('amount', e.target.value)} required /></FormField>
          <FormField className="cp-field"><label htmlFor="contribution-date">Payment date <span>(required)</span></label><TextInput id="contribution-date" type="date" value={contribution.payment_date} onChange={e => update('payment_date', e.target.value)} required /></FormField>
        </div>
        <FormField className="cp-field"><label htmlFor="contribution-reference">Reference number <span>(required)</span></label><TextInput id="contribution-reference" type="text" placeholder="OR/CDV number" value={contribution.referenceNumber} onChange={e => update('referenceNumber', e.target.value)} aria-describedby="contribution-reference-help" required /><p id="contribution-reference-help" className="cp-help">Use the receipt or payment reference. This appears in the member's ledger.</p></FormField>
      </fieldset>
      <ModalActions className="cp-footer"><ActionButton variant="outline" type="button" className="cp-button" disabled={submitting} onClick={onClose}>Cancel</ActionButton><ActionButton variant="default" type="submit" className="cp-button cp-primary" disabled={submitting || !contribution.member_id}>{submitting ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Banknote size={15} aria-hidden="true" />}{submitting ? 'Recording…' : 'Record payment'}</ActionButton></ModalActions>
      <span className="sr-only" role="status">{submitting ? 'Recording payment. Please wait.' : ''}</span>
    </form>
  </Modal>;
}
