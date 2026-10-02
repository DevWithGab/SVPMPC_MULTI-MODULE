import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../../shared/Modal';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import { claimRequirementAPI } from '../../../../services/api';

// One modal for both add and edit — `editing` (a requirement row, or null)
// decides which mode this is. The internal document key is derived
// server-side from the label and never shown here; editing only ever
// changes the label.
export default function AddEditClaimRequirementModal({ isOpen, onClose, editing, onSaved }) {
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLabel(editing?.label || '');
      setError('');
    }
  }, [isOpen, editing]);

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) {
      setError('Enter a label for this requirement.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      if (editing) {
        await claimRequirementAPI.update(editing._id, trimmed);
      } else {
        await claimRequirementAPI.create(trimmed);
      }
      onSaved?.();
      handleClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save this requirement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={editing ? 'Edit Requirement' : 'Add Requirement'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
            Requirement Label <span className="text-red-500">*</span>
          </label>
          <Input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Barangay Certificate"
            autoFocus
          />
          <p className="text-xs text-slate-400 mt-1.5">
            {editing
              ? 'This updates how the requirement is labeled everywhere it appears, including on claims already filed.'
              : 'New claims filed from now on will include this in their requirements checklist.'}
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose} className="flex-1" disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {editing ? 'Save Changes' : 'Add Requirement'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
