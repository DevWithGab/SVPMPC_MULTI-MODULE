import React, { useState, useEffect, useCallback } from 'react';
import { HandCoins, Loader2, CheckCircle2, FileText, Printer } from 'lucide-react';
import Modal from '../shared/Modal';
import Button from '../../shared/ui/Button';
import Input from '../../shared/ui/Input';
import { treasurerAPI } from '../../../services/api';
import { printClaimReceipt } from './claimReceipt';

const todayIso = () => new Date().toISOString().split('T')[0];

const peso = (value) =>
  `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ClaimsAwaitingRelease({ user, showToast, onReleased }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null);
  const [form, setForm] = useState({ dvNumber: '', releaseDate: todayIso(), remarks: '' });
  const [submitting, setSubmitting] = useState(false);
  const [released, setReleased] = useState(null); // the just-released claim, once confirmed

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
    setReleased(null);
    setForm({ dvNumber: '', releaseDate: todayIso(), remarks: '' });
  };

  const closeModal = () => {
    if (submitting) return;
    setTarget(null);
    setReleased(null);
  };

  const handleRelease = async (e) => {
    e.preventDefault();
    if (!target || submitting) return;
    if (!form.dvNumber.trim()) {
      showToast?.('Enter the DV (Disbursement Voucher) number.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // No amount is sent: the payout is always the total collected from the
      // other members for this claim and the server resolves it, so it cannot
      // be altered from this screen.
      const res = await treasurerAPI.releaseClaim(target.claimId, {
        dvNumber: form.dvNumber.trim(),
        releaseDate: form.releaseDate,
        remarks: form.remarks.trim() || undefined,
        releasedBy: user?.name || user?.username,
      });
      showToast?.(res?.message || 'Claim released.', 'success');
      setReleased(res?.data || null);
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
          Deduction has been collected — record the disbursement to release the death benefit to the beneficiary.
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
                      <HandCoins className="w-3.5 h-3.5" /> Record Disbursement
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

      <Modal isOpen={Boolean(target)} onClose={closeModal} title={released ? 'Claim Released' : 'Record Disbursement'}>
        {released ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3 p-4 border border-green-200 bg-green-50 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-coop-green shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">
                ₱{released.payout?.amount?.toLocaleString?.() ?? released.payout?.amount} released to{' '}
                <span className="font-bold">{released.beneficiaryName}</span> (DV# {released.payout?.dvNumber}).
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="ghost" onClick={closeModal} className="flex-1 h-11 border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50">
                Done
              </Button>
              <Button type="button" onClick={() => printClaimReceipt(released)} className="flex-1 h-11 bg-coop-green hover:bg-coop-darkGreen text-white font-semibold text-sm">
                <Printer className="w-4 h-4" /> Print Receipt
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRelease} className="space-y-5">
            <div className="flex items-start gap-3 p-4 border border-green-200 bg-green-50 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-coop-green shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">
                Release the death benefit for <span className="font-bold">{target?.memberName}</span> to{' '}
                <span className="font-bold">{target?.beneficiaryName}</span>.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1 block">DV Number</label>
                <Input
                  type="text"
                  value={form.dvNumber}
                  onChange={(e) => setForm((f) => ({ ...f, dvNumber: e.target.value }))}
                  placeholder="e.g., DV-2026-0142"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1 block">Release Date</label>
                <Input
                  type="date"
                  value={form.releaseDate}
                  onChange={(e) => setForm((f) => ({ ...f, releaseDate: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1 block">
                Amount Released (₱) — to the beneficiary
              </label>
              <Input
                type="text"
                value={peso(target?.payoutAmount ?? target?.deduction?.totalCollected)}
                readOnly
                className="h-12 text-lg font-bold bg-slate-50 text-slate-700 cursor-not-allowed"
              />
              <p className="text-xs text-slate-400 mt-1">
                {target?.deduction?.membersCharged
                  ? `${target.deduction.membersCharged.toLocaleString()} members × ${peso(target.deduction.amountPerMember)} deducted for this claim`
                  : 'Set automatically from the deduction collected for this claim'}{' '}
                — this cannot be edited.
              </p>

              {/* Once the assessment collects past the benefit cap, the surplus
                  is the cooperative's income — show the Treasurer the split
                  rather than leaving the difference unexplained. */}
              {target?.retainedAmount > 0 && (
                <dl className="mt-3 border border-slate-200 rounded-lg divide-y divide-slate-100 text-sm">
                  <div className="flex justify-between px-3 py-2">
                    <dt className="text-slate-500">Total collected from members</dt>
                    <dd className="font-semibold text-slate-700">{peso(target.deduction?.totalCollected)}</dd>
                  </div>
                  <div className="flex justify-between px-3 py-2">
                    <dt className="text-slate-500">
                      Released to beneficiary (cap {peso(target.maxBenefitAmount)})
                    </dt>
                    <dd className="font-semibold text-slate-700">{peso(target.payoutAmount)}</dd>
                  </div>
                  <div className="flex justify-between px-3 py-2 bg-slate-50">
                    <dt className="text-slate-500">Retained as cooperative income</dt>
                    <dd className="font-bold text-coop-green">{peso(target.retainedAmount)}</dd>
                  </div>
                </dl>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1 block">Recipient (Beneficiary)</label>
              <Input type="text" value={target?.beneficiaryName || ''} disabled className="bg-slate-50 text-slate-500" />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1 block">Remarks (optional)</label>
              <textarea
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                rows={2}
                placeholder="Any notes about this disbursement..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="ghost" disabled={submitting} onClick={closeModal} className="flex-1 h-11 border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="flex-1 h-11 bg-coop-green hover:bg-coop-darkGreen text-white font-semibold text-sm disabled:opacity-50">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Releasing...</> : 'Release Claim'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
