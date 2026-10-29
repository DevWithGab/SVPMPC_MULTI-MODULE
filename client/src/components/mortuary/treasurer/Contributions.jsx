import { SearchField } from '../../ui/workspace';
import { Button as ActionButton } from '../../ui/button';
import { Input as TextInput } from '../../ui/input';
import { PageHeader } from '../../ui/workspace';
import { Table as DataTable } from '../../ui/table';
import React, { useEffect, useState } from 'react';
import { Search, Banknote, CalendarDays, Archive, Upload } from 'lucide-react';
import AttendanceMetricGrid from '../../attendance/shared/AttendanceMetricGrid';
import './Contributions.css';
import BulkPaymentUpload from './BulkPaymentUpload';
import { Pagination, PaginationInfo } from '../../ui/pagination';
import { usePagination } from '../../../hooks/usePagination';

const Contributions = ({
  contributions,
  paymentSearchQuery,
  setPaymentSearchQuery,
  setIsAddContributionOpen,
  onPaymentsImported
}) => {
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().toISOString().slice(0, 7);
  const contributionsToday = contributions.filter(c => c.payment_date === today);
  const totalToday = contributionsToday.reduce((sum, c) => sum + (c.amount || 0), 0);
  const contributionsMonth = contributions.filter(c => c.payment_date?.startsWith(currentMonth));
  const totalMonth = contributionsMonth.reduce((sum, c) => sum + (c.amount || 0), 0);

  const filteredContributions = contributions.filter(c =>
    c.memberName?.toLowerCase().includes(paymentSearchQuery.toLowerCase()) ||
    c.member_name?.toLowerCase().includes(paymentSearchQuery.toLowerCase()) ||
    c.memberId?.toString().includes(paymentSearchQuery) ||
    c.member_id?.toString().includes(paymentSearchQuery)
  );

  const { page, limit, setPage } = usePagination(1, 100);

  useEffect(() => {
    setPage(1);
  }, [paymentSearchQuery, setPage]);

  const totalFilteredContributions = filteredContributions.length;
  const totalPages = Math.ceil(totalFilteredContributions / limit) || 1;
  const visiblePage = Math.min(page, totalPages);
  const pageStartIndex = (visiblePage - 1) * limit;
  const paginatedContributions = filteredContributions.slice(pageStartIndex, pageStartIndex + limit);

  return (
    <div className="mortuary-contributions">
      <PageHeader className="ct-header">
        <div><p className="ct-eyebrow">Mortuary management / Contributions</p><h1>Contributions</h1><p className="ct-description">Record member payments and review contribution history.</p></div>
        <div className="ct-header-actions">
          <ActionButton tooltip="Preview and import contribution payments from a CSV file." variant="outline" type="button" className="ct-button" onClick={() => setBulkUploadOpen(true)}><Upload size={15} aria-hidden="true" />Bulk upload CSV</ActionButton>
          <ActionButton tooltip="Record a contribution payment for a member." variant="default" type="button" className="ct-button ct-primary" onClick={() => setIsAddContributionOpen(true)}><Banknote size={15} aria-hidden="true" />Record payment</ActionButton>
        </div>
      </PageHeader>
      <AttendanceMetricGrid label="Contribution overview" items={[
        ["Today's contributions", '₱' + totalToday.toLocaleString(), contributionsToday.length.toLocaleString() + ' transactions', Banknote],
        ['This month', '₱' + totalMonth.toLocaleString(), new Date().toLocaleString('default', { month: 'long' }), CalendarDays],
        ['All-time records', contributions.length.toLocaleString(), 'Total contribution records', Archive],
      ]} />
      <section className="ct-filters" aria-labelledby="ct-filter-title">
        <div className="ct-filter-heading"><h2 id="ct-filter-title">Find a contribution</h2><button type="button" className="ct-text-button" disabled={!paymentSearchQuery} onClick={() => setPaymentSearchQuery('')}>Reset search</button></div>
        <label className="ct-search-label">Search members<SearchField as="span" className="ct-search"><Search size={16} aria-hidden="true" /><TextInput unstyled type="text" placeholder="Name or Passbook No." value={paymentSearchQuery} onChange={e => setPaymentSearchQuery(e.target.value)} /></SearchField></label>
      </section>
      <section className="ct-register" aria-labelledby="ct-register-title">
        <div className="ct-register-heading"><h2 id="ct-register-title">Contribution register</h2><p>Payment dates, member details, and recorded amounts.</p></div>
        <div className="ct-scope"><span>{totalFilteredContributions.toLocaleString()} of {contributions.length.toLocaleString()} records</span><span>{paymentSearchQuery ? 'Search results' : 'All contributions'}</span></div>
        <div className="ct-table-scroll" role="region" aria-label="Contribution register" tabIndex={0}>
          <DataTable><thead><tr><th scope="col">Date / Record</th><th scope="col">Member / Passbook</th><th scope="col" className="ct-number">Amount</th><th scope="col">Status</th></tr></thead>
          <tbody>{paginatedContributions.map(c => <tr key={c.id}>
            <td>{c.payment_date}<span className="ct-secondary">#{c.id.toString().padStart(6, '0')}</span></td>
            <td><strong>{c.member_name || c.memberName || ('Member #' + (c.member_id ?? c.memberId))}</strong><span className="ct-secondary">{c.member_id ?? c.memberId}</span></td>
            <td className="ct-number"><strong>₱{c.amount?.toLocaleString()}</strong></td>
            <td><span className={'ct-status' + (c.status === 'paid' || c.status === 'completed' ? ' ct-status-paid' : '')}>{c.status || 'Not recorded'}</span></td>
          </tr>)}</tbody></DataTable>
        </div>
        {!totalFilteredContributions && <div className="ct-empty" role="status"><strong>{paymentSearchQuery ? 'No contributions match your search' : 'No contributions recorded'}</strong><p>{paymentSearchQuery ? 'Try a different member name or passbook number.' : 'Record a payment or upload a CSV to add member contributions.'}</p>{paymentSearchQuery && <ActionButton variant="outline" type="button" className="ct-button" onClick={() => setPaymentSearchQuery('')}>Reset search</ActionButton>}</div>}
        <footer className="ct-pagination"><PaginationInfo currentPage={visiblePage} limit={limit} total={totalFilteredContributions} />{totalFilteredContributions > 0 && <Pagination currentPage={visiblePage} totalPages={totalPages} onPageChange={setPage} hasNextPage={visiblePage < totalPages} hasPrevPage={visiblePage > 1} />}</footer>
      </section>
      {bulkUploadOpen && <BulkPaymentUpload onClose={() => setBulkUploadOpen(false)} onImported={onPaymentsImported} />}
    </div>
  );
};

export default Contributions;
