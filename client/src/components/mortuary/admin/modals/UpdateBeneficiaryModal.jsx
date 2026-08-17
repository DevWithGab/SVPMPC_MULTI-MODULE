import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../../shared/Modal';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import { beneficiaryAPI } from '../../../../services/api';
import { sanitizePhoneInput, validatePhPhone } from '../../../../utils/validation';

export default function UpdateBeneficiaryModal({ isOpen, onClose, memberId, memberName, current, user, onSaved }) {
  const [form, setForm] = useState({ beneficiaryName: '', relationship: '', contactNumber: '', address: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setForm({
        beneficiaryName: current?.beneficiaryName || '',
        relationship: current?.relationship || '',
        contactNumber: current?.contactNumber || '',
        address: current?.address || '',
        notes: '',
      });
      setError('');
    }
  }, [isOpen, current]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.beneficiaryName.trim() || !form.relationship.trim() || !form.contactNumber.trim()) {
      setError('Beneficiary name, relationship, and contact number are required.');
      return;
    }
    const phoneError = validatePhPhone(form.contactNumber);
    if (phoneError) {
      setError(phoneError);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await beneficiaryAPI.updateBeneficiary(memberId, {
        ...form,
        updatedBy: user?.name || user?.username,
      });
      onClose();
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update beneficiary information.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Beneficiary Information">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-500">
          For <span className="font-semibold text-slate-900">{memberName}</span>. Saving this creates a new beneficiary
          record — the previous one is kept in History.
        </p>

        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
            Beneficiary Name <span className="text-red-500">*</span>
          </label>
          <Input value={form.beneficiaryName} onChange={(e) => setForm((f) => ({ ...f, beneficiaryName: e.target.value }))} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
              Relationship <span className="text-red-500">*</span>
            </label>
            <Input value={form.relationship} onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
              Contact Number <span className="text-red-500">*</span>
            </label>
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={11}
              placeholder="09171234567"
              value={form.contactNumber}
              onChange={(e) => setForm((f) => ({ ...f, contactNumber: sanitizePhoneInput(e.target.value) }))}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Address</label>
          <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1" disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
