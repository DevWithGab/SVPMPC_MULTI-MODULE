import React, { useState, useEffect, useCallback } from 'react';
import { Banknote, Loader2, AlertTriangle, FileText } from 'lucide-react';
import Modal from '../shared/Modal';
import Button from '../../shared/ui/Button';
import Input from '../../shared/ui/Input';
import { treasurerAPI } from '../../../services/api';

export default function ClaimsPendingDeduction({ user, showToast, onProcessed }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null); // claim being processed
  const [amount, setAmount] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await treasurerAPI.getPendingDeductionClaims({ limit: 50 });
      setClaims(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openModal = (claim) => {
    setTarget(claim);
    setAmount('25');
    setConfirmStep(false);
  };

  const closeModal = () => {
    if (submitting) return;
    setTarget(null);
    setConfirmStep(false);
  };

  const handleReview = (e) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      showToast?.('Enter a valid amount.', 'error');
      return;
    }
    setConfirmStep(true);
  };

  const handleProcess = async () => {
    if (!target || submitting) return;
    setSubmitting(true);
    try {
      const res = await treasurerAPI.processClaimDeduction(target.claimId, {
        customAmount: parseFloat(amount),
        processedBy: user?.name || user?.username,
      });
      showToast?.(res?.message || 'Deduction processed.', 'success');
      setTarget(null);
      setConfirmStep(false);
      load();
      onProcessed?.();
    } catch (err) {
      showToast?.(err.response?.data?.message || 'Unable to process the deduction.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Pending Deduction</h2>
        <p className="text-sm text-slate-500 mt-1">
          Claims approved by Admin, ready for the month-end death-fund assessment.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Member</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden sm:table-cell">Beneficiary</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Approved</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-16 text-center text-sm text-slate-400">Loading...</td></tr>
            ) : claims.length > 0 ? (
              claims.map((claim) => (
                <tr key={claim.claimId} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-sm font-semibold text-slate-900">{claim.memberName}</td>
                  <td className="px-6 py-3.5 text-sm text-slate-500 hidden sm:table-cell">{claim.beneficiaryName}</td>
                  <td className="px-6 py-3.5 text-sm text-slate-500 hidden md:table-cell">
                    {claim.approval?.approvedAt ? new Date(claim.approval.approvedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <button
                      onClick={() => openModal(claim)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-coop-green hover:bg-coop-darkGreen text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Banknote className="w-3.5 h-3.5" /> Process Deduction
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-16 text-center text-sm text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8 text-slate-300" />
                    No claims pending deduction.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={Boolean(target)} onClose={closeModal} title={confirmStep ? 'Confirm Deduction' : 'Process Deduction'}>
        {!confirmStep ? (
          <form onSubmit={handleReview} className="space-y-5">
            <p className="text-sm text-slate-600">
              Charge every other active member for the death of{' '}
              <span className="font-bold text-slate-800">{target?.memberName}</span>.
            </p>
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1 block">Amount per member (₱)</label>
              <Input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className="h-12 text-lg font-bold" />
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="ghost" onClick={closeModal} className="flex-1 h-11 border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50">
                Cancel
              </Button>
              <Button type="submit" className="flex-1 h-11 bg-coop-green hover:bg-coop-darkGreen text-white font-semibold text-sm">
                Review Deduction
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start gap-3 p-4 border border-rose-200 bg-rose-50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-800">
                This will immediately deduct <span className="font-bold">₱{parseFloat(amount || 0).toLocaleString()}</span> from
                every active member and cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="ghost" disabled={submitting} onClick={() => setConfirmStep(false)} className="flex-1 h-11 border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50">
                Go back
              </Button>
              <Button type="button" onClick={handleProcess} disabled={submitting} className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm disabled:opacity-50">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : 'Yes, process now'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
