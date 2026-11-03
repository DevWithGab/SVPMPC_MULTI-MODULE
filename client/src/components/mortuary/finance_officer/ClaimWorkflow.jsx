import { Button } from '../../ui/button';
import { Panel, ModalActions, DialogHeader } from '../../ui/workspace';
import { Table as DataTable } from '../../ui/table';
import { Input as TextInput } from '../../ui/input';
import { useEffect, useId, useRef } from 'react';
import { Loader2, RefreshCw, Search, X } from 'lucide-react';
import { Pagination } from '../../ui/pagination';
import { fieldClass, shortDate } from './claimWorkflowUtils';

export function Action({ children, primary = false, className = '', ...props }) {
  return <Button type="button" variant={primary ? 'default' : 'outline'} {...props} className={`mc-action ${className}`}>{children}</Button>;
}

const checkboxClass = 'h-4 w-4 rounded border-slate-300 accent-coop-green';

/* Selection survives search and paging (keyed by claimId), so the treasurer can
gather e.g. every death claim of the month into one batch. */
export function ClaimQueue({ queue, selected, onToggle, onToggleAll, footer }) {
  const { claims, loading, error, total, page, setPage, search, setSearch, refresh } = queue;
  const allOnPageSelected = claims.length > 0 && claims.every((claim) => selected.has(claim.claimId));
  return <Panel as="section" className="mc-register mc-claim-queue" aria-busy={loading} aria-label="Claims pending deduction">
    <div className="mc-queue-filters">
      <div className="mc-search-field"><label htmlFor="mc-deduction-search">Find a claim</label><div className="relative">
        <Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <TextInput id="mc-deduction-search" aria-label="Search by member, beneficiary or claim ID" placeholder="Search member, beneficiary or claim ID" value={search} onChange={(e) => setSearch(e.target.value)} className={`${fieldClass} pl-9 pr-10`} />
        {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-1 top-1 rounded p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>}
      </div></div>
      <Action onClick={refresh} disabled={loading}><RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Action>
    </div>
    {!loading && error ? <div role="alert" className="space-y-3 px-5 py-12 text-center"><p className="text-sm text-red-700">{error}</p><Action onClick={refresh}>Try again</Action></div>
      : loading ? <div role="status" className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading claims…</div>
        : !claims.length ? <div className="px-5 py-16 text-center"><h3 className="font-semibold text-slate-900">{search ? 'No matching claims' : 'No claims pending deduction'}</h3><p className="mt-2 text-sm text-slate-500">{search ? 'Try a different name or claim ID.' : 'Claims appear here once they have been approved.'}</p>{search && <Action className="mt-4" onClick={() => setSearch('')}>Clear search</Action>}</div>
          : <><p className="mc-scroll-hint">Scroll across the table to see beneficiaries and claim dates.</p><div className="mc-table-scroll" role="region" aria-label="Deduction register" tabIndex={0}><DataTable className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600"><tr><th scope="col" className="w-12 px-5 py-3"><label className="mc-check-target"><input type="checkbox" ref={input => { if (input) input.indeterminate = !allOnPageSelected && claims.some(claim => selected.has(claim.claimId)); }} className={checkboxClass} aria-label="Select all claims on this page" checked={allOnPageSelected} onChange={(e) => onToggleAll(claims, e.target.checked)} /></label></th><th scope="col" className="px-5 py-3 font-medium">Member / claim</th><th scope="col" className="hidden px-5 py-3 font-medium lg:table-cell">Beneficiary</th><th scope="col" className="hidden whitespace-nowrap px-5 py-3 font-medium md:table-cell">Date of death</th><th scope="col" className="hidden whitespace-nowrap px-5 py-3 font-medium md:table-cell">Approved on</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{claims.map((claim) => <tr key={claim.claimId} data-selected={selected.has(claim.claimId)} className={selected.has(claim.claimId) ? 'bg-green-50/60' : 'hover:bg-slate-50/60'}>
              <td className="w-12 px-5 py-4"><label className="mc-check-target"><input type="checkbox" className={checkboxClass} aria-label={`Select claim ${claim.claimId} for ${claim.memberName}`} checked={selected.has(claim.claimId)} onChange={() => onToggle(claim)} /></label></td>
              <td className="min-w-44 px-5 py-4"><p className="font-semibold text-slate-900">{claim.memberName || '—'}</p><p className="mt-1 text-xs text-slate-500">{claim.claimId}</p><p className="mt-1 text-xs text-slate-500 lg:hidden">Beneficiary: {claim.beneficiaryName || '—'}</p></td>
              <td className="hidden px-5 py-4 text-slate-600 lg:table-cell">{claim.beneficiaryName || '—'}</td>
              <td className="hidden whitespace-nowrap px-5 py-4 text-slate-600 md:table-cell">{shortDate(claim.dateOfDeath)}</td>
              <td className="hidden whitespace-nowrap px-5 py-4 text-slate-600 md:table-cell">{shortDate(claim.approval?.approvedAt)}</td>
            </tr>)}</tbody>
          </DataTable></div></>}
    {footer}
    {total > 0 && <div className="mc-pagination">
      <span aria-live="polite">{loading ? 'Loading…' : error ? 'Claims unavailable' : total ? `${(page - 1) * 100 + 1}–${Math.min(page * 100, total)} of ${total} ${search ? 'matching ' : ''}claims` : '0 claims'}</span>
      <Pagination
        currentPage={page}
        totalPages={Math.max(1, Math.ceil(total / 100))}
        onPageChange={setPage}
        hasNextPage={!loading && !error && page * 100 < total}
        hasPrevPage={!loading && !error && page > 1}
      />
    </div>}
  </Panel>;
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
  return <dialog ref={ref} aria-labelledby={id} onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }} className="ui-dialog mc-dialog fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50">
    <div className="flex max-h-[90dvh] flex-col">
      <DialogHeader title={title} titleId={id} eyebrow={step} busy={busy} onClose={onClose} />
      <div className="ui-dialog-body space-y-5">{children}</div>
      <ModalActions as="footer" className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">{footer}</ModalActions>
    </div>
  </dialog>;
}

export function Detail({ label, children, strong = false }) {
  return <div className={`flex justify-between gap-6 py-2.5 text-sm ${strong ? 'border-t border-slate-200 font-semibold text-slate-900' : 'text-slate-600'}`}><dt>{label}</dt><dd className="text-right font-medium tabular-nums text-slate-900 break-words">{children}</dd></div>;
}
