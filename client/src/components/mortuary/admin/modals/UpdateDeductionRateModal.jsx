import { Textarea } from '../../../ui/input';
import { FormField, ModalActions } from '../../../ui/workspace';
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../../shared/Modal';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import { deductionSettingAPI } from '../../../../services/api';
import { formatSettingAmountInput, parseSettingAmount, displaySettingAmount } from '../../../../utils/settingAmount';

export default function UpdateDeductionRateModal({ isOpen, onClose, currentAmount, user, onSaved }) {
  const [amount, setAmount] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    if (submitting) return;
    setAmount('');
    setDescription('');
    setError('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsed = parseSettingAmount(amount);
    if (!Number.isFinite(parsed)) {
      setError('Enter an amount greater than 0, such as 10,000 or 10,000.50. Use digits and up to 2 decimal places; letters are not allowed.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await deductionSettingAPI.updateRate({
        amount: parsed,
        effectiveDate,
        description: description || undefined,
        createdBy: user?.name || user?.username,
      });
      setAmount('');
      setDescription('');
      onClose();
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update the deduction rate.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Update Deduction Rate">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-500">
          Current rate: <span className="font-bold text-slate-900">₱{displaySettingAmount(currentAmount)}</span> per approved claim. This
          value may change through board approval.
        </p>

        <FormField>
          <label htmlFor="deduction-rate-amount" className="text-sm font-semibold text-slate-700 mb-1.5 block">
            New Amount (₱) <span className="text-red-500">*</span>
          </label>
          <Input
            id="deduction-rate-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => { setAmount(formatSettingAmountInput(e.target.value)); setError(''); }}
            placeholder="25"
            disabled={submitting}
            aria-invalid={Boolean(error)}
            aria-describedby="deduction-rate-help deduction-rate-error"
          />
          <p id="deduction-rate-help" className="text-xs text-slate-500 mt-1">Commas are added automatically. Enter a positive amount with up to 2 decimal places.</p>
        </FormField>

        <FormField>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Effective Date</label>
          <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
        </FormField>

        <FormField>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Description (optional)</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green"
            placeholder="e.g. Board resolution #12, series 2026"
          />
        </FormField>

        {error && <p id="deduction-rate-error" role="alert" className="text-sm text-red-600">{error}</p>}

        <ModalActions className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose} className="flex-1" disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save New Rate
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
