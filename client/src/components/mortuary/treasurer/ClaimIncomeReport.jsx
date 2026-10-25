import { Panel } from '../../ui/workspace';
import { Table as DataTable } from '../../ui/table';
import AttendanceMetricGrid from '../../attendance/shared/AttendanceMetricGrid';
import React, { useState, useEffect, useCallback } from 'react';
import { Search, FileText, TrendingUp, TrendingDown, Download } from 'lucide-react';
import Input from '../../shared/ui/Input';
import { Pagination, PaginationInfo } from '../../ui/pagination';
import { usePagination } from '../../../hooks/usePagination';
import { loadAllPages } from '../../../utils/loadAllPages';
import { treasurerAPI } from '../../../services/api';
import { reportCsvHeader } from '../../../utils/reportCsvHeader';

/* Per-claim collections, benefits, at retained income. Kung unreleased pa yung
claim, ipinapakita yung projected released amounts at income; mabibilang lang
sa totals pag na-release na. */

const peso = (value) =>
  `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const shortDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');

const STATUS_LABEL = {
  deduction_processed: { text: 'Awaiting release', className: 'bg-amber-100 text-amber-700' },
  released: { text: 'Released', className: 'bg-green-100 text-coop-green' },
};

export default function ClaimIncomeReport() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState(null);
  const [maxBenefit, setMaxBenefit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const { page, limit, setPage } = usePagination(1, 100);

  const load = useCallback(async (searchTerm, pageNum) => {
    setLoading(true);
    try {
      const res = await treasurerAPI.getClaimIncomeReport({ page: pageNum, limit, search: searchTerm || undefined });
      setRows(Array.isArray(res?.data) ? res.data : []);
      setTotal(res?.pagination?.total ?? 0);
      setTotals(res?.totals || null);
      setMaxBenefit(res?.maxBenefitAmount ?? null);
    } catch {
      setRows([]);
      setTotal(0);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => load(search, page), 300);
    return () => clearTimeout(timer);
  }, [search, page, load]);

  const totalPages = Math.ceil(total / limit) || 1;

  /* I-export lahat ng claim na match sa current search, hindi lang yung page
  na nakikita sa screen - paginated na kasi yung on-screen table, pero dapat
  kumpleto pa rin yung CSV report. */
  const exportCSV = async () => {
    if (!total || exporting) return;
    setExporting(true);
    try {
      const allRows = await loadAllPages((p) => treasurerAPI.getClaimIncomeReport({ page: p, limit: 100, search: search || undefined }));
      const header = [
        'Claim ID', 'Deceased Member', 'Beneficiary', 'Status', 'Members Charged', 'Per Member',
        'Total Collected', 'Released', 'Processed', 'Released On', 'DV Number',
      ];
      const body = allRows.map((r) => [
        r.claimId, r.memberName, r.beneficiaryName, r.status, r.membersCharged, r.amountPerMember,
        r.totalCollected, r.amountReleased ?? '',
        r.processedAt ? new Date(r.processedAt).toISOString().split('T')[0] : '',
        r.releasedAt ? new Date(r.releasedAt).toISOString().split('T')[0] : '',
        r.dvNumber ?? '',
      ]);
      const csv = [header, ...body]
        .map((line) => line.map((cell) => (typeof cell === 'string' ? `"${cell.replace(/"/g, '""')}"` : cell)).join(','))
        .join('\n');
      const reportHeader = reportCsvHeader({
        title: 'Claims Summary',
        program: 'Mortuary Aid Fund Program',
        scope: search ? `Claims matching "${search}".` : 'All claims.',
        metadata: ['Records', `${allRows.length} claims`],
      });
      const url = URL.createObjectURL(new Blob(['﻿' + reportHeader + csv], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `claims-income-report-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      // Export failures aren't fatal to the page; the on-screen report is unaffected.
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mc-view mc-report space-y-6">
      <div className="mc-view-heading">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Claims Summary</h2>
          <p className="text-sm text-slate-500 mt-1">
            Where every claim's money went — collected from members, released to the beneficiary, retained by the cooperative.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              aria-label="Search claims by claim ID or member"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search claim ID or name..."
              className="pl-9"
            />
          </div>
          <button
            onClick={exportCSV}
            disabled={!total || exporting}
            className="inline-flex items-center gap-1.5 px-3 h-10 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Download className="w-4 h-4" /> {exporting ? 'Exporting...' : 'CSV'}
          </button>
        </div>
      </div>

      {/* Sakop ng totals lahat ng claim na match sa current search, hindi lang
          yung rows na nakikita sa screen, kaya tugma sa dashboard tiles pag
          unfiltered. */}
      <AttendanceMetricGrid label="Claims summary totals" busy={loading} items={[
        ['Total deductions collected', loading ? '—' : peso(totals?.totalDeductionsCollected), 'Held, awaiting release', TrendingUp],
        ['Total claims released', loading ? '—' : peso(totals?.totalReleased), maxBenefit ? 'Benefits paid out (max ' + peso(maxBenefit) + '/claim)' : 'Benefits paid out', TrendingDown],
      ]} />

      <Panel as="div" className="mc-register">
        <div className="mc-table-scroll" role="region" aria-label="Claims report" tabIndex={0}>
          <DataTable className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Deceased Member</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden lg:table-cell">Assessment</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Collected</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Released</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden sm:table-cell">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-16 text-center text-sm text-slate-400">Loading...</td></tr>
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
                      <td className="px-5 py-3.5 text-sm text-right font-semibold text-slate-700 tabular-nums">
                        {peso(r.totalCollected)}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right tabular-nums">
                        {pending ? (
                          /* Hindi pa na-disburse - ipinapakita kung magkano
                          irerelease, minarkahan as projection para hindi
                          akalain na pera na talagang nalabas na. */
                          <span className="text-slate-400 italic">{peso(r.projectedRelease)} pending</span>
                        ) : (
                          <span className="font-semibold text-rose-600">{peso(r.amountReleased)}</span>
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
                  <td colSpan={5} className="px-6 py-16 text-center text-sm text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-8 h-8 text-slate-300" />
                      No claim has been assessed yet — process a deduction and it will appear here.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </div>
        {!loading && total > 0 && (
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <PaginationInfo currentPage={page} limit={limit} total={total} />
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              hasNextPage={page < totalPages}
              hasPrevPage={page > 1}
            />
          </div>
        )}
      </Panel>


    </div>
  );
}
