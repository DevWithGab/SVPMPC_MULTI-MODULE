import React, { useState, useEffect, useCallback } from 'react';
import { Search, FileText, TrendingUp, TrendingDown, Wallet, Download } from 'lucide-react';
import Input from '../../shared/ui/Input';
import { treasurerAPI } from '../../../services/api';

// A per-claim breakdown of the three figures the dashboards report as totals:
// what each claim collected from the members, what went to the beneficiary,
// and what the cooperative retained. The dashboard answers "how much"; this
// answers "from which claims".
//
// A claim appears here as soon as its deduction is processed, so the money it
// is holding is visible before it goes out. Until the disbursement is recorded
// the Released and Net Income columns show greyed-out projections of what the
// claim WILL pay and retain; only on release do they become real and feed the
// totals. That mirrors getClaimFinancialTotals, which recognises income on
// release — see the comment there for why the three tiles reconcile.

const peso = (value) =>
  `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const shortDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');

const STATUS_LABEL = {
  deduction_processed: { text: 'Awaiting release', className: 'bg-amber-100 text-amber-700' },
  released: { text: 'Released', className: 'bg-green-100 text-coop-green' },
};

const SummaryTile = ({ label, value, hint, icon: Icon, tone }) => (
  <div className={`rounded-xl border p-4 ${tone}`}>
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 shrink-0 opacity-70" />
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
    </div>
    <p className="text-2xl font-bold mt-2 tabular-nums">{value}</p>
    <p className="text-xs opacity-60 mt-0.5">{hint}</p>
  </div>
);

export default function ClaimIncomeReport() {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);
  const [maxBenefit, setMaxBenefit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async (searchTerm) => {
    setLoading(true);
    try {
      const res = await treasurerAPI.getClaimIncomeReport({ limit: 100, search: searchTerm || undefined });
      setRows(Array.isArray(res?.data) ? res.data : []);
      setTotals(res?.totals || null);
      setMaxBenefit(res?.maxBenefitAmount ?? null);
    } catch {
      setRows([]);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(search), 300);
    return () => clearTimeout(timer);
  }, [search, load]);

  const exportCSV = () => {
    if (!rows.length) return;
    const header = [
      'Claim ID', 'Deceased Member', 'Beneficiary', 'Status', 'Members Charged', 'Per Member',
      'Total Collected', 'Released', 'Net Income', 'Processed', 'Released On', 'DV Number',
    ];
    const body = rows.map((r) => [
      r.claimId, r.memberName, r.beneficiaryName, r.status, r.membersCharged, r.amountPerMember,
      r.totalCollected, r.amountReleased ?? '', r.netIncome,
      r.processedAt ? new Date(r.processedAt).toISOString().split('T')[0] : '',
      r.releasedAt ? new Date(r.releasedAt).toISOString().split('T')[0] : '',
      r.dvNumber ?? '',
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((cell) => (typeof cell === 'string' ? `"${cell.replace(/"/g, '""')}"` : cell)).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `claims-income-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Claims Income Report</h2>
          <p className="text-sm text-slate-500 mt-1">
            Where every claim's money went — collected from members, released to the beneficiary, retained by the cooperative.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search claim ID or name..."
              className="pl-9"
            />
          </div>
          <button
            onClick={exportCSV}
            disabled={!rows.length}
            className="inline-flex items-center gap-1.5 px-3 h-10 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      {/* Totals span every claim matching the current search, not just the rows
          on screen, so these agree with the dashboard tiles when unfiltered. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryTile
          label="Total Deductions Collected"
          value={peso(totals?.totalDeductionsCollected)}
          hint="Held, awaiting release"
          icon={TrendingUp}
          tone="bg-blue-50 border-blue-100 text-blue-900"
        />
        <SummaryTile
          label="Total Claims Released"
          value={peso(totals?.totalReleased)}
          hint={maxBenefit ? `Benefits paid out (max ${peso(maxBenefit)}/claim)` : 'Benefits paid out'}
          icon={TrendingDown}
          tone="bg-rose-50 border-rose-100 text-rose-900"
        />
        <SummaryTile
          label="Net Claims Income"
          value={peso(totals?.netClaimsBalance)}
          hint="Surplus retained by the cooperative"
          icon={Wallet}
          tone="bg-green-50 border-green-100 text-green-900"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Deceased Member</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden lg:table-cell">Assessment</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Collected</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Released</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Net Income</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden sm:table-cell">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-400">Loading...</td></tr>
              ) : rows.length > 0 ? (
                rows.map((r) => {
                  const badge = STATUS_LABEL[r.status] || { text: r.status, className: 'bg-slate-100 text-slate-600' };
                  const pending = !r.settled;
                  return (
                    <tr key={r.claimId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold text-slate-900">{r.memberName}</p>
                        <p className="text-xs text-slate-400 mt-0.5">to {r.beneficiaryName} · {shortDate(r.processedAt)}</p>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-500 hidden lg:table-cell tabular-nums">
                        {r.membersCharged.toLocaleString()} × {peso(r.amountPerMember)}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right tabular-nums">
                        {/* Held money drains to 0 on release, matching the tile
                            above; the gross stays visible underneath so the row
                            still shows what the assessment brought in. */}
                        <span className={pending ? 'font-semibold text-slate-700' : 'text-slate-400'}>
                          {peso(pending ? r.totalCollected : 0)}
                        </span>
                        {!pending && (
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            {peso(r.totalCollected)} disbursed
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right tabular-nums">
                        {pending ? (
                          // Not yet disbursed — show what it will release, marked
                          // as a projection so it isn't read as money already out.
                          <span className="text-slate-400 italic">{peso(r.projectedRelease)} pending</span>
                        ) : (
                          <span className="font-semibold text-rose-600">{peso(r.amountReleased)}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right font-bold tabular-nums">
                        {pending ? (
                          <span className="text-slate-400 italic font-normal">{peso(r.projectedIncome)} pending</span>
                        ) : (
                          <span className={r.netIncome < 0 ? 'text-rose-600' : 'text-coop-green'}>
                            {peso(r.netIncome)}
                          </span>
                        )}
                        {r.capApplied && (
                          <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">
                            cap applied
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${badge.className}`}>
                          {badge.text}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-8 h-8 text-slate-300" />
                      No claim has been assessed yet — process a deduction and it will appear here.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {maxBenefit != null && (
        <p className="text-xs text-slate-400">
          Benefit cap is {peso(maxBenefit)} per claim. A claim that collects more than the cap releases the cap and
          retains the rest as income; one that collects less releases everything and retains nothing. Collected money is
          held until the disbursement is recorded — on release it splits into the benefit and the cooperative's income,
          so the held figure returns to zero.
        </p>
      )}
    </div>
  );
}
