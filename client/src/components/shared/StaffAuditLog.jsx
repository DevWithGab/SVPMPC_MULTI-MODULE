import { useEffect, useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import { auditAPI } from '../../services/api';
import { Button } from '../ui/button';
import { Pagination, PaginationInfo } from '../ui/pagination';
import { usePagination } from '../../hooks/usePagination';
import { formatDateTime } from '../../utils/date';
import { readableLabel, outcomeLabel } from '../../utils/auditDetails';
import AuditLogDetails from './AuditLogDetails';

// Staff account actions (staffController.js's audit() helper) are logged
// under module: 'admin' — only super_admin can query that module (see
// auditLogRoutes.js), and this is the only screen that does. Without it the
// data was real and retained (confirmed via GET /audit/trail/staff/:id) but
// structurally unreachable — nothing in the app ever rendered it, despite
// StaffAccounts.jsx's own delete-confirmation dialog promising "Historical
// records and audit logs will be retained."
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
  const { page, limit, setPage } = usePagination(1, 10);

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
    <section className="bg-white border border-slate-200 rounded-xl p-6 mb-8" aria-label="Staff account audit trail">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold">Staff Account Activity</h2>
          <p className="text-sm text-slate-500">Every staff account created, edited, password-reset, or deleted — retained even after the account itself is removed.</p>
        </div>
        <div className="flex gap-2">
          <select value={action} onChange={(e) => setAction(e.target.value)} className="border rounded-md px-3 py-2 text-sm" aria-label="Filter by action">
            <option value="">All actions</option>
            <option value="staff_created">Created</option>
            <option value="staff_updated">Updated</option>
            <option value="staff_password_reset">Password reset</option>
            <option value="staff_deleted">Deleted</option>
          </select>
          <Button variant="outline" disabled={loading} onClick={refresh}>Refresh</Button>
        </div>
      </div>

      {listError && <p role="alert" className="text-red-700 mb-4">{listError}</p>}
      {loading && <p role="status" className="py-3">Loading staff activity...</p>}

      {!loading && !listError && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>{['When', 'Performed by', 'Action', 'Staff account', 'Result', 'Details'].map((title) => (
                <th className="p-3 border-b" key={title}>{title}</th>
              ))}</tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id}>
                  <td className="p-3 border-b whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                  <td className="p-3 border-b">{log.userName || 'System'}</td>
                  <td className="p-3 border-b">{actionLabel(log.action)}</td>
                  <td className="p-3 border-b">{log.entityName || '—'}</td>
                  <td className="p-3 border-b capitalize">{outcomeLabel(log.status)}</td>
                  <td className="p-3 border-b">
                    <Button variant="outline" size="sm" onClick={() => setSelectedLog(log)}>
                      <Eye className="w-4 h-4 mr-1" /> View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!logs.length && <p className="py-4 text-slate-500">No staff account activity yet.</p>}
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
