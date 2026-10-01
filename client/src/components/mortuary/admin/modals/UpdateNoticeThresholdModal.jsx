import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../../shared/Modal';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import { noticeThresholdSettingAPI } from '../../../../services/api';

// Numeric thresholds only — the letter content itself is edited as a
// document via NoticeLetterEditorModal, not here. Submitting this form
// still carries the existing letter content forward unchanged (the server
// requires it on every update since each save supersedes the whole row).
export default function UpdateNoticeThresholdModal({ isOpen, onClose, current, user, onSaved }) {
  const [form, setForm] = useState({
    targetBalance: '',
    notice1Min: '',
    notice1Max: '',
    notice2Min: '',
    notice2Max: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setForm({
        targetBalance: current?.targetBalance ?? '',
        notice1Min: current?.notice1Min ?? '',
        notice1Max: current?.notice1Max ?? '',
        notice2Min: current?.notice2Min ?? '',
        notice2Max: current?.notice2Max ?? '',
        effectiveDate: new Date().toISOString().split('T')[0],
        description: '',
      });
      setError('');
    }
  }, [isOpen, current]);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    const parsed = {
      targetBalance: parseFloat(form.targetBalance),
      notice1Min: parseFloat(form.notice1Min),
      notice1Max: parseFloat(form.notice1Max),
      notice2Min: parseFloat(form.notice2Min),
      notice2Max: parseFloat(form.notice2Max),
    };

    for (const [key, value] of Object.entries(parsed)) {
      if (form[key] === '' || isNaN(value)) {
        setError('Every threshold field is required and must be a number.');
        return;
      }
    }
    if (parsed.targetBalance <= 0) {
      setError('Target balance must be greater than 0.');
      return;
    }
    if (parsed.notice2Min < 0) {
      setError('Notice 2 minimum cannot be negative.');
      return;
    }
    if (parsed.notice2Max < parsed.notice2Min) {
      setError('Notice 2 maximum must be greater than or equal to its minimum.');
      return;
    }
    if (parsed.notice1Min <= parsed.notice2Max) {
      setError('Notice 1 minimum must be greater than the Notice 2 maximum.');
      return;
    }
    if (parsed.notice1Max < parsed.notice1Min) {
      setError('Notice 1 maximum must be greater than or equal to its minimum.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await noticeThresholdSettingAPI.updateThresholds({
        ...parsed,
        noticeBodyTemplate: current?.noticeBodyTemplate,
        finalNoticeBodyTemplate: current?.finalNoticeBodyTemplate,
        effectiveDate: form.effectiveDate,
        description: form.description || undefined,
        createdBy: user?.name || user?.username,
      });
      onClose();
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update notice thresholds.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={submitting ? () => {} : onClose} title="Update Notice Thresholds">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-500">
          Balances at or below <span className="font-bold text-slate-900">Notice 1 Maximum</span> start receiving a
          paper notice. Ranges must not overlap — Notice 1 sits entirely above Notice 2. To edit the letter wording
          itself, use "Edit Document" instead.
        </p>

        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
            Target Balance (₱) <span className="text-red-500">*</span>
          </label>
          <Input type="text" inputMode="decimal" value={form.targetBalance} onChange={setField('targetBalance')} placeholder="1000" />
          <p className="text-xs text-slate-400 mt-1">The sustaining balance referenced in the printed letter (e.g. "deposit enough to reach ₱1,000").</p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
          <div className="col-span-2 text-xs font-bold text-amber-700 uppercase tracking-wide">Notice 1 range</div>
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Minimum (₱)</label>
            <Input type="text" inputMode="decimal" value={form.notice1Min} onChange={setField('notice1Min')} placeholder="700" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Maximum (₱)</label>
            <Input type="text" inputMode="decimal" value={form.notice1Max} onChange={setField('notice1Max')} placeholder="900" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 bg-red-50 border border-red-100 rounded-lg">
          <div className="col-span-2 text-xs font-bold text-red-700 uppercase tracking-wide">Notice 2 range</div>
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Minimum (₱)</label>
            <Input type="text" inputMode="decimal" value={form.notice2Min} onChange={setField('notice2Min')} placeholder="300" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Maximum (₱)</label>
            <Input type="text" inputMode="decimal" value={form.notice2Max} onChange={setField('notice2Max')} placeholder="699" />
          </div>
        </div>
        <p className="text-xs text-slate-400 -mt-2">
          Below the Notice 2 minimum is always the <span className="font-semibold">Final Notice</span> (negative balances included).
        </p>

        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Effective Date</label>
          <Input type="date" value={form.effectiveDate} onChange={setField('effectiveDate')} />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Description (optional)</label>
          <textarea
            value={form.description}
            onChange={setField('description')}
            rows={2}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green"
            placeholder="e.g. Board resolution #14, series 2026"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1" disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save New Thresholds
          </Button>
        </div>
      </form>
    </Modal>
  );
}
