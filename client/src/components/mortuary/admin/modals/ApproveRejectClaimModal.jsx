import React, { useState } from 'react';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Modal from '../../shared/Modal';
import Button from '../../../shared/ui/Button';
import { claimAPI } from '../../../../services/api';

// mode: 'approve' | 'reject'
export default function ApproveRejectClaimModal({ isOpen, onClose, mode, claim, user, onDone }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    if (submitting) return;
    setReason('');
    setError('');
    onClose();
  };

  const handleConfirm = async () => {
    if (submitting || !claim) return;
    setError('');

    if (mode === 'reject' && !reason.trim()) {
      setError('A rejection reason is required.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'approve') {
        await claimAPI.approveClaim(claim.claimId, { approvedBy: user?.name || user?.username });
      } else {
        await claimAPI.rejectClaim(claim.claimId, {
          reason: reason.trim(),
          rejectedBy: user?.name || user?.username,
        });
      }
      setReason('');
      onClose();
      onDone?.();
    } catch (err) {
      setError(err.response?.data?.message || `Unable to ${mode} this claim.`);
    } finally {
      setSubmitting(false);
    }
  };

  const isApprove = mode === 'approve';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={isApprove ? 'Approve Claim' : 'Reject Claim'}>
      <div className="space-y-4">
        {isApprove ? (
          <div className="flex items-start gap-3 p-4 border border-green-200 bg-green-50 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-coop-green shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700">
              This will approve the claim for <span className="font-bold">{claim?.memberName}</span> and move it to{' '}
              <span className="font-bold">Pending Monthly Deduction</span>, ready for the Treasurer to process.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 p-4 border border-rose-200 bg-rose-50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-800">
                Rejecting this claim for <span className="font-bold">{claim?.memberName}</span> is final and requires a
                reason.
              </p>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
                Rejection reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                autoFocus
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400"
                placeholder="e.g. Missing/invalid documents"
              />
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose} className="flex-1" disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={isApprove ? 'primary' : 'danger'}
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> {isApprove ? 'Approving...' : 'Rejecting...'}
              </>
            ) : isApprove ? (
              'Approve Claim'
            ) : (
              'Reject Claim'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
