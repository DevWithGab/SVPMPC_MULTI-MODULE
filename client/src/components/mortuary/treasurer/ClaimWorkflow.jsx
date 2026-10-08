import { useEffect, useId, useRef } from 'react';
import { ArrowRight, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { Pagination } from '../../ui/pagination';
import { fieldClass, peso, shortDate } from './claimWorkflowUtils';

export function Action({ children, primary = false, className = '', ...props }) {
  return <button type="button" {...props} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coop-green focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${primary ? 'border-coop-green bg-coop-green text-white hover:bg-coop-darkGreen' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'} ${className}`}>{children}</button>;
}

export function ClaimQueue({ queue, release = false, onSelect }) {
  const { claims, loading, error, total, page, setPage, search, setSearch, refresh } = queue;
  return <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" aria-label={release ? 'Claims awaiting release' : 'Claims pending deduction'}>
    <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-sm">
        <Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <input aria-label="Search by member, beneficiary or claim ID" placeholder="Search member, beneficiary or claim ID" value={search} onChange={(e) => setSearch(e.target.value)} className={`${fieldClass} pl-9 pr-10`} />
        {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-1 top-1 rounded p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>}
      </div>
      <Action onClick={refresh} disabled={loading}><RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Action>
    </div>
    {!loading && error ? <div role="alert" className="space-y-3 px-5 py-12 text-center"><p className="text-sm text-red-700">{error}</p><Action onClick={refresh}>Try again</Action></div>
      : loading ? <div role="status" className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading claims…</div>
        : !claims.length ? <div className="px-5 py-16 text-center"><h3 className="font-semibold text-slate-900">{search ? 'No matching claims' : release ? 'No claims awaiting release' : 'No claims pending deduction'}</h3><p className="mt-2 text-sm text-slate-500">{search ? 'Try a different name or claim ID.' : release ? 'Claims appear here after their deductions are processed.' : 'Claims appear here once they have been approved.'}</p>{search && <Action className="mt-4" onClick={() => setSearch('')}>Clear search</Action>}</div>
          : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600"><tr><th scope="col" className="px-5 py-3 font-medium">Member / claim</th><th scope="col" className="hidden px-5 py-3 font-medium lg:table-cell">Beneficiary</th><th scope="col" className="hidden whitespace-nowrap px-5 py-3 font-medium md:table-cell">{release ? 'Deducted on' : 'Approved on'}</th>{release && <th scope="col" className="whitespace-nowrap px-5 py-3 text-right font-medium">For release</th>}<th scope="col" className="px-5 py-3 text-right font-medium">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{claims.map((claim) => <tr key={claim.claimId} className="hover:bg-slate-50/60">
              <td className="min-w-44 px-5 py-4"><p className="font-semibold text-slate-900">{claim.memberName || '—'}</p><p className="mt-1 text-xs text-slate-500">{claim.claimId}</p><p className="mt-1 text-xs text-slate-500 lg:hidden">Beneficiary: {claim.beneficiaryName || '—'}</p></td>
              <td className="hidden px-5 py-4 text-slate-600 lg:table-cell">{claim.beneficiaryName || '—'}</td>
              <td className="hidden whitespace-nowrap px-5 py-4 text-slate-600 md:table-cell">{shortDate(release ? claim.deduction?.processedAt : claim.approval?.approvedAt)}</td>
              {release && <td className="whitespace-nowrap px-5 py-4 text-right font-semibold tabular-nums text-slate-900">{peso(claim.payoutAmount ?? claim.deduction?.totalCollected)}{claim.retainedAmount > 0 && <p className="mt-1 text-xs font-normal text-slate-500">{peso(claim.retainedAmount)} retained</p>}</td>}
              <td className="px-5 py-4 text-right"><Action className="whitespace-nowrap" aria-label={`${release ? 'Prepare release' : 'Review deduction'} for ${claim.memberName}, ${claim.claimId}`} onClick={() => onSelect(claim)}>{release ? 'Prepare release' : 'Review deduction'}<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></Action></td>
            </tr>)}</tbody>
          </table></div>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
      <span aria-live="polite">{loading ? 'Loading…' : error ? 'Claims unavailable' : total ? `${(page - 1) * 10 + 1}–${Math.min(page * 10, total)} of ${total} ${search ? 'matching ' : ''}claims` : '0 claims'}</span>
      <Pagination
        currentPage={page}
        totalPages={Math.max(1, Math.ceil(total / 10))}
        onPageChange={setPage}
        hasNextPage={!loading && !error && page * 10 < total}
        hasPrevPage={!loading && !error && page > 1}
      />
    </div>
  </section>;
}

export function ClaimDialog({ title, step, busy, onClose, children, footer }) {
  const ref = useRef(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  return <dialog ref={ref} aria-labelledby={id} onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50">
    <div className="flex max-h-[90dvh] flex-col">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-6 py-4"><div><p className="mb-1 text-xs text-slate-500">{step}</p><h3 id={id} className="text-lg font-semibold">{title}</h3></div><Action disabled={busy} aria-label="Close dialog" onClick={onClose} className="border-transparent px-2"><X className="h-4 w-4" /></Action></header>
      <div className="space-y-5 overflow-y-auto px-6 py-5">{children}</div>
      <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">{footer}</footer>
    </div>
  </dialog>;
}

export function ClaimIdentity({ claim }) {
  return <div className="border-b border-slate-200 pb-4"><p className="text-xs text-slate-500">{claim.claimId}</p><p className="mt-1 text-lg font-semibold text-slate-900">{claim.memberName}</p><p className="mt-1 text-sm text-slate-600">Beneficiary: <span className="font-medium text-slate-900">{claim.beneficiaryName || '—'}</span></p></div>;
}

export function Detail({ label, children, strong = false }) {
  return <div className={`flex justify-between gap-6 py-2.5 text-sm ${strong ? 'border-t border-slate-200 font-semibold text-slate-900' : 'text-slate-600'}`}><dt>{label}</dt><dd className="text-right font-medium tabular-nums text-slate-900 break-words">{children}</dd></div>;
}
