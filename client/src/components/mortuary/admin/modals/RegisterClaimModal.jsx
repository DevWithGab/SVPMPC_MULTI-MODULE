import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, UserPlus, AlertCircle } from 'lucide-react';
import Modal from '../../shared/Modal';
import SearchableMemberSelect from '../../shared/SearchableMemberSelect';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import { beneficiaryAPI, claimAPI } from '../../../../services/api';
import { sanitizePhoneInput, validatePhPhone } from '../../../../utils/validation';

const emptyBeneficiaryForm = { beneficiaryName: '', relationship: '', contactNumber: '', address: '' };

export default function RegisterClaimModal({ isOpen, onClose, members, user, onRegistered }) {
  const [step, setStep] = useState('form'); // 'form' | 'confirm'
  const [memberId, setMemberId] = useState('');
  const [dateOfDeath, setDateOfDeath] = useState(new Date().toISOString().split('T')[0]);
  const [causeOfDeath, setCauseOfDeath] = useState('');
  const [remarks, setRemarks] = useState('');

  const [beneficiary, setBeneficiary] = useState(null);
  const [loadingBeneficiary, setLoadingBeneficiary] = useState(false);
  const [beneficiaryForm, setBeneficiaryForm] = useState(emptyBeneficiaryForm);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setStep('form');
    setMemberId('');
    setDateOfDeath(new Date().toISOString().split('T')[0]);
    setCauseOfDeath('');
    setRemarks('');
    setBeneficiary(null);
    setBeneficiaryForm(emptyBeneficiaryForm);
    setError('');
  }, []);

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  // Auto-look-up the member's current beneficiary whenever selection changes
  useEffect(() => {
    if (!memberId) {
      setBeneficiary(null);
      setBeneficiaryForm(emptyBeneficiaryForm);
      return;
    }

    let cancelled = false;
    setLoadingBeneficiary(true);
    setBeneficiary(null);
    setBeneficiaryForm(emptyBeneficiaryForm);

    beneficiaryAPI
      .getHistory(memberId)
      .then((res) => {
        if (cancelled) return;
        const history = Array.isArray(res?.data) ? res.data : [];
        const current = history.find((b) => b.isActive) || null;
        setBeneficiary(current);

        if (!current) {
          // Members registered before the structured Beneficiary record
          // existed only ever got a free-text name on Member.beneficiaries
          // (no relationship/contact number was ever captured for them).
          // There's genuinely no structured record to find, but carry the
          // legacy name over so the admin isn't retyping a name that's
          // already visible elsewhere on this member's profile.
          const legacyName = (members || [])
            .find((m) => m.id?.toString() === memberId?.toString())
            ?.beneficiaries?.trim();
          if (legacyName) {
            setBeneficiaryForm((f) => ({ ...f, beneficiaryName: legacyName }));
          }
        }
      })
      .catch(() => {
        // Leave beneficiary null — the form below already treats a null
        // beneficiary as "show the quick-add fields."
      })
      .finally(() => {
        if (!cancelled) setLoadingBeneficiary(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  const selectedMember = (members || []).find((m) => m.id?.toString() === memberId?.toString());
  const legacyBeneficiaryCarriedOver =
    !beneficiary && !loadingBeneficiary && beneficiaryForm.beneficiaryName === selectedMember?.beneficiaries?.trim() && !!selectedMember?.beneficiaries?.trim();

  const handleContinue = async (e) => {
    e.preventDefault();
    setError('');

    if (!memberId) {
      setError('Select the deceased member.');
      return;
    }
    if (!dateOfDeath) {
      setError('Date of death is required.');
      return;
    }

    if (!beneficiary) {
      // No beneficiary on file — register the quick-add form as their first
      // beneficiary record before moving on.
      const { beneficiaryName, relationship, contactNumber } = beneficiaryForm;
      if (!beneficiaryName.trim() || !relationship.trim() || !contactNumber.trim()) {
        setError('Beneficiary name, relationship, and contact number are required.');
        return;
      }
      const phoneError = validatePhPhone(contactNumber);
      if (phoneError) {
        setError(phoneError);
        return;
      }

      setSubmitting(true);
      try {
        const res = await beneficiaryAPI.updateBeneficiary(memberId, {
          ...beneficiaryForm,
          updatedBy: user?.name || user?.username,
        });
        setBeneficiary(res?.data || null);
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to save beneficiary information.');
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
    }

    setStep('confirm');
  };

  const handleSubmitClaim = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');

    try {
      await claimAPI.createClaim({
        memberId,
        beneficiaryId: beneficiary?.beneficiaryId,
        dateOfDeath,
        causeOfDeath: causeOfDeath || undefined,
        remarks: remarks || undefined,
        createdBy: user?.name || user?.username,
      });
      reset();
      onClose();
      onRegistered?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to register this claim.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      maxWidth="max-w-lg"
      title={step === 'confirm' ? 'Confirm Claim Details' : 'Register New Claim'}
    >
      {step === 'form' ? (
        <form onSubmit={handleContinue} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
              Deceased Member <span className="text-red-500">*</span>
            </label>
            <SearchableMemberSelect
              members={(members || []).map((m) => ({ id: m.id, name: m.name, address: m.address, balance: 0 }))}
              value={memberId}
              onChange={setMemberId}
              placeholder="Search member by name or ID..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
                Date of Death <span className="text-red-500">*</span>
              </label>
              <Input type="date" value={dateOfDeath} onChange={(e) => setDateOfDeath(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Date Filed</label>
              <Input type="date" value={new Date().toISOString().split('T')[0]} disabled />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Cause of Death (optional)</label>
            <Input value={causeOfDeath} onChange={(e) => setCauseOfDeath(e.target.value)} placeholder="e.g. Natural causes" />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green"
              placeholder="Optional notes"
            />
          </div>

          {memberId && (
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/60">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Beneficiary</p>
              {loadingBeneficiary ? (
                <p className="text-sm text-slate-400">Looking up beneficiary...</p>
              ) : beneficiary ? (
                <div className="text-sm">
                  <p className="font-semibold text-slate-900">{beneficiary.beneficiaryName}</p>
                  <p className="text-slate-500">{beneficiary.relationship} • {beneficiary.contactNumber}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <UserPlus className="w-3.5 h-3.5 shrink-0" />
                    {legacyBeneficiaryCarriedOver
                      ? `${selectedMember?.name || 'This member'} only has a name on file — carried it over below. Confirm the relationship and contact number to continue.`
                      : `No beneficiary on file for ${selectedMember?.name || 'this member'} — add one to continue.`}
                  </div>
                  <Input
                    placeholder="Beneficiary full name"
                    value={beneficiaryForm.beneficiaryName}
                    onChange={(e) => setBeneficiaryForm((f) => ({ ...f, beneficiaryName: e.target.value }))}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Relationship"
                      value={beneficiaryForm.relationship}
                      onChange={(e) => setBeneficiaryForm((f) => ({ ...f, relationship: e.target.value }))}
                    />
                    <Input
                      type="tel"
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="09171234567"
                      value={beneficiaryForm.contactNumber}
                      onChange={(e) => setBeneficiaryForm((f) => ({ ...f, contactNumber: sanitizePhoneInput(e.target.value) }))}
                    />
                  </div>
                  <Input
                    placeholder="Address (optional)"
                    value={beneficiaryForm.address}
                    onChange={(e) => setBeneficiaryForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={handleClose} className="flex-1" disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="border border-slate-200 divide-y divide-slate-200 rounded-lg overflow-hidden">
            <div className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-slate-500">Deceased Member</span>
              <span className="font-semibold text-slate-900">{selectedMember?.name}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5 text-sm bg-slate-50">
              <span className="text-slate-500">Beneficiary</span>
              <span className="font-semibold text-slate-900">{beneficiary?.beneficiaryName}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-slate-500">Date of Death</span>
              <span className="font-semibold text-slate-900">{dateOfDeath}</span>
            </div>
            {causeOfDeath && (
              <div className="flex justify-between px-4 py-2.5 text-sm bg-slate-50">
                <span className="text-slate-500">Cause of Death</span>
                <span className="font-semibold text-slate-900">{causeOfDeath}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400">
            Filing this claim will mark the member's status as deceased and start the requirements checklist.
          </p>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setStep('form')} className="flex-1" disabled={submitting}>
              Back
            </Button>
            <Button type="button" onClick={handleSubmitClaim} className="flex-1" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Filing...
                </>
              ) : (
                'File Claim'
              )}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
