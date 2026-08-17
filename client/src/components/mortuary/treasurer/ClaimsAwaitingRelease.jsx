import React, { useState, useEffect, useCallback } from 'react';
import { HandCoins, Loader2, CheckCircle2, FileText } from 'lucide-react';
import Modal from '../shared/Modal';
import Button from '../../shared/ui/Button';
import Input from '../../shared/ui/Input';
import { treasurerAPI } from '../../../services/api';

export default function ClaimsAwaitingRelease({ user, showToast, onReleased }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await treasurerAPI.getAwaitingReleaseClaims({ limit: 50 });
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
    setAmount(claim.deduction?.totalCollected ? String(claim.deduction.totalCollected) : '');
  };

  const closeModal = () => {
    if (submitting) return;
    setTarget(null);
  };

  const handleRelease = async (e) => {
    e.preventDefault();
    if (!target || submitting) return;

    setSubmitting(true);
    try {
      const res = await treasurerAPI.releaseClaim(target.claimId, {
        amount: amount ? parseFloat(amount) : undefined,
        releasedBy: user?.name || user?.username,
      });
      showToast?.(res?.message || 'Claim released.', 'success');
      setTarget(null);
      load();
      onReleased?.();
    } catch (err) {
      showToast?.(err.response?.data?.message || 'Unable to release this claim.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Awaiting Release</h2>
        <p className="text-sm text-slate-500 mt-1">
          Deduction has been collected — release the death benefit payout to the beneficiary.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Member</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden sm:table-cell">Beneficiary</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Collected</th>
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
                    ₱{claim.deduction?.totalCollected?.toLocaleString?.() ?? claim.deduction?.totalCollected ?? 0}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <button
                      onClick={() => openModal(claim)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-coop-green hover:bg-coop-darkGreen text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <HandCoins className="w-3.5 h-3.5" /> Release Payout
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-16 text-center text-sm text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8 text-slate-300" />
                    No claims awaiting release.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={Boolean(target)} onClose={closeModal} title="Release Payout">
        <form onSubmit={handleRelease} className="space-y-5">
          <div className="flex items-start gap-3 p-4 border border-green-200 bg-green-50 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-coop-green shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700">
              Release the death benefit for <span className="font-bold">{target?.memberName}</span> to{' '}
              <span className="font-bold">{target?.beneficiaryName}</span>.
            </p>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1 block">
              Amount to release (₱) — defaults to the member's current balance if left blank
            </label>
            <Input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Member's current balance" className="h-12 text-lg font-bold" />
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="ghost" disabled={submitting} onClick={closeModal} className="flex-1 h-11 border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="flex-1 h-11 bg-coop-green hover:bg-coop-darkGreen text-white font-semibold text-sm disabled:opacity-50">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Releasing...</> : 'Release Payout'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
