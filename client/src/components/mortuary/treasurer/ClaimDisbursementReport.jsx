import React, { useState, useEffect, useCallback } from 'react';
import { Search, FileText, Eye, Printer } from 'lucide-react';
import Modal from '../shared/Modal';
import Button from '../../shared/ui/Button';
import Input from '../../shared/ui/Input';
import { treasurerAPI } from '../../../services/api';
import { printClaimReceipt } from './claimReceipt';

// A read-only history of every claim that has already been paid out —
// the record-keeping counterpart to the "Awaiting Release" action tab.
// The table only shows enough to scan the list; everything else (DV
// number, claim ID, released by, remarks) lives in the details modal.
export default function ClaimDisbursementReport() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async (searchTerm) => {
    setLoading(true);
    try {
      const res = await treasurerAPI.getDisbursementReport({ limit: 100, search: searchTerm || undefined });
      setClaims(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(search), 300);
    return () => clearTimeout(timer);
  }, [search, load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Claim Disbursement Report</h2>
          <p className="text-sm text-slate-500 mt-1">
            Every mortuary benefit already released to a beneficiary.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search DV #, claim ID, name..."
            className="pl-9"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Deceased Member</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Beneficiary</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Amount Released</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Release Date</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-16 text-center text-sm text-slate-400">Loading...</td></tr>
              ) : claims.length > 0 ? (
                claims.map((claim) => (
                  <tr key={claim.claimId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5 text-sm font-semibold text-slate-900">{claim.memberName}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{claim.beneficiaryName}</td>
                    <td className="px-6 py-3.5 text-sm text-right font-bold text-coop-green">
                      ₱{claim.payout?.amount?.toLocaleString?.() ?? claim.payout?.amount ?? 0}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-500">
                      {claim.payout?.releasedAt ? new Date(claim.payout.releasedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => setViewing(claim)}
                        title="View disbursement details"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-coop-green"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-sm text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-8 h-8 text-slate-300" />
                      No claims have been released yet.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={Boolean(viewing)} onClose={() => setViewing(null)} title="Disbursement Details">
        {viewing && (
          <div className="space-y-5">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="font-semibold text-slate-500 text-xs uppercase tracking-wide">DV Number</dt>
                <dd className="mt-1 font-mono text-slate-900">{viewing.payout?.dvNumber || '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500 text-xs uppercase tracking-wide">Claim ID</dt>
                <dd className="mt-1 font-mono text-slate-900">{viewing.claimId}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500 text-xs uppercase tracking-wide">Deceased Member</dt>
                <dd className="mt-1 font-semibold text-slate-900">{viewing.memberName}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500 text-xs uppercase tracking-wide">Beneficiary</dt>
                <dd className="mt-1 text-slate-900">{viewing.beneficiaryName}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500 text-xs uppercase tracking-wide">Amount Released</dt>
                <dd className="mt-1 font-bold text-coop-green">
                  ₱{viewing.payout?.amount?.toLocaleString?.() ?? viewing.payout?.amount ?? 0}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500 text-xs uppercase tracking-wide">Release Date</dt>
                <dd className="mt-1 text-slate-900">
                  {viewing.payout?.releasedAt ? new Date(viewing.payout.releasedAt).toLocaleDateString() : '—'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-semibold text-slate-500 text-xs uppercase tracking-wide">Released By</dt>
                <dd className="mt-1 text-slate-900">{viewing.payout?.releasedBy || '—'}</dd>
              </div>
              {viewing.payout?.remarks && (
                <div className="sm:col-span-2">
                  <dt className="font-semibold text-slate-500 text-xs uppercase tracking-wide">Remarks</dt>
                  <dd className="mt-1 text-slate-700">{viewing.payout.remarks}</dd>
                </div>
              )}
            </dl>

            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={() => setViewing(null)} className="flex-1 h-11 border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50">
                Close
              </Button>
              <Button type="button" onClick={() => printClaimReceipt(viewing)} className="flex-1 h-11 bg-coop-green hover:bg-coop-darkGreen text-white font-semibold text-sm">
                <Printer className="w-4 h-4" /> Print Receipt
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
