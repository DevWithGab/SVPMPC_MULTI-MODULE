import { Table as DataTable } from '../ui/table';
import { useEffect, useRef, useState } from 'react';
import { Eye, ClipboardList, RefreshCw } from 'lucide-react';
import { auditAPI } from '../../services/api';
import { Button } from '../ui/button';
import { Pagination, PaginationInfo } from '../ui/pagination';
import { usePagination } from '../../hooks/usePagination';
import { formatDateTime } from '../../utils/date';
import { readableLabel, outcomeLabel } from '../../utils/auditDetails';
import AuditLogDetails from './AuditLogDetails';

/* Yung staff account actions (galing sa staffController.js's audit() helper)
ay naka-log sa ilalim ng module: 'admin' - super_admin lang ang pwedeng
mag-query ng module na 'to (tignan sa auditLogRoutes.js), at ito lang yung
screen na gumagawa nito. Kung wala 'to, totoo at naka-retain naman yung data
(na-confirm via GET /audit/trail/staff/:id) pero structurally unreachable -
walang nagrender nito sa app kahit yung delete-confirmation dialog ng
StaffAccounts.jsx mismo ay nangako ng "Historical records and audit logs
will be retained." */
const ACTION_LABELS = {
  staff_created: 'Account created',
  staff_updated: 'Account updated',
  staff_password_reset: 'Password reset',
  staff_deleted: 'Account deleted',
};
const actionLabel = (action) => ACTION_LABELS[action] || readableLabel(action);

export default function StaffAuditLog() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [action, setAction] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const requestVersion = useRef(0);
  const { page, limit, setPage } = usePagination(1, 100);

  const refresh = async () => {
    const version = ++requestVersion.current;
    setLoading(true); setListError('');
    try {
      const result = await auditAPI.getLogs({ module: 'admin', action: action || undefined, page, limit });
      if (version === requestVersion.current) {
        setLogs(result.logs || []);
        setPagination(result.pagination || { total: 0, pages: 1 });
      }
    } catch (error) {
      if (version === requestVersion.current) {
        setListError(error.response?.data?.message || 'Unable to load the staff audit trail. Try Refresh.');
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [page, limit, action]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); }, [action, setPage]);

  return (
    <section className="sam-staff-audit bg-white border border-slate-200 rounded-xl p-6 mb-8" aria-label="Staff account audit trail" aria-busy={loading}>
      <div className="sam-panel-heading flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold">Staff account activity</h2>
          <p className="text-sm text-slate-500">Account changes and password resets are retained, even after an account is removed.</p>
        </div>
        <div className="flex gap-2">
          <select value={action} onChange={(e) => setAction(e.target.value)} className="border rounded-md px-3 py-2 text-sm" aria-label="Filter by action">
            <option value="">All actions</option>
            <option value="staff_created">Created</option>
            <option value="staff_updated">Updated</option>
            <option value="staff_password_reset">Password reset</option>
            <option value="staff_deleted">Deleted</option>
          </select>
          <Button variant="outline" disabled={loading} onClick={refresh}><RefreshCw size={15} aria-hidden="true" />Refresh</Button>
        </div>
      </div>

      {listError && <p role="alert" className="text-red-700 mb-4">{listError}</p>}
      {loading && <p role="status" className="py-3">Loading staff activity...</p>}

      {!loading && !listError && (
        <div className="overflow-x-auto">
          <DataTable className="w-full text-sm text-left">
            <thead>
              <tr>{['When', 'Performed by', 'Action', 'Staff account', 'Result', 'Details'].map((title) => (
                <th className="p-3 border-b" key={title}>{title}</th>
              ))}</tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id}>
                  <td data-label="When" className="p-3 border-b whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                  <td data-label="Performed by" className="p-3 border-b">{log.userName || 'System'}</td>
                  <td data-label="Action" className="p-3 border-b"><span className="sam-action-label">{actionLabel(log.action)}</span></td>
                  <td data-label="Staff account" className="p-3 border-b">{log.entityName || '—'}</td>
                  <td data-label="Result" className="p-3 border-b capitalize"><span className={`sam-audit-result sam-audit-result-${log.status}`}>{outcomeLabel(log.status)}</span></td>
                  <td data-label="Details" className="p-3 border-b">
                    <Button variant="outline" size="sm" onClick={() => setSelectedLog(log)}>
                      <Eye className="w-4 h-4 mr-1" /> View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {!logs.length && <div className="sam-empty" role="status"><ClipboardList size={30} aria-hidden="true" /><strong>{action ? 'No activity matches this filter' : 'No staff account activity yet'}</strong><p>{action ? 'Choose another action to review the staff audit trail.' : 'Account changes will appear here when staff access is managed.'}</p>{action && <Button variant="outline" onClick={() => setAction('')}>Clear filter</Button>}</div>}
        </div>
      )}

      {logs.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-100">
          <PaginationInfo currentPage={page} limit={limit} total={pagination.total} />
          <Pagination
            currentPage={page}
            totalPages={pagination.pages}
            onPageChange={setPage}
            hasNextPage={page < pagination.pages}
            hasPrevPage={page > 1}
          />
        </div>
      )}

      {selectedLog && (
        <AuditLogDetails log={selectedLog} module="admin" actionLabel={actionLabel} onClose={() => setSelectedLog(null)} />
      )}
    </section>
  );
}
