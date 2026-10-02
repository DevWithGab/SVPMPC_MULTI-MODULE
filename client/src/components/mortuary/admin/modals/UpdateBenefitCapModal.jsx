import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../../shared/Modal';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import { benefitCapSettingAPI } from '../../../../services/api';

export default function UpdateBenefitCapModal({ isOpen, onClose, currentAmount, user, onSaved }) {
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
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError('Enter a valid amount greater than 0.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await benefitCapSettingAPI.updateCap({
        amount: parsed,
        effectiveDate,
        description: description || undefined,
        createdBy: user?.name || user?.username,
      });
      handleClose();
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update the benefit cap.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Update Benefit Cap">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-500">
          Current cap: <span className="font-bold text-slate-900">₱{currentAmount?.toLocaleString?.() ?? currentAmount}</span> released
          per claim — collections above this amount become cooperative income instead of being paid out. This
          value may change through board approval.
        </p>

        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
            New Cap (₱) <span className="text-red-500">*</span>
          </label>
          <Input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="50000"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Effective Date</label>
          <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green"
            placeholder="e.g. Board resolution #12, series 2026"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose} className="flex-1" disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save New Cap
          </Button>
        </div>
      </form>
    </Modal>
  );
}
