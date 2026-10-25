import { DialogHeader, ModalActions } from '../ui/workspace';
import { useEffect, useRef } from 'react';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { auditChanges, auditRows, readableLabel, outcomeLabel } from '../../utils/auditDetails';
import { formatDateTime } from '../../utils/date';
import './AuditLogDetails.css';

export default function AuditLogDetails({ log, module, actionLabel, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, []);
  const { kind, rows } = auditChanges(log.changes, module);
  const metadata = auditRows(log.metadata, module);
  const StatusIcon = log.status === 'success' ? CheckCircle : log.status === 'partial' ? Clock : AlertCircle;
  const statusClass = ['success', 'failed', 'partial'].includes(log.status) ? log.status : 'unknown';
  return (
    <dialog ref={ref} className="audit-detail ui-dialog" aria-labelledby="audit-detail-heading" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="audit-detail-shell">
        <DialogHeader title={actionLabel(log.action)} titleId="audit-detail-heading" eyebrow={`${readableLabel(module)} activity`} onClose={onClose} closeLabel="Close activity details" />
        <div className="ui-dialog-body audit-detail-body">
          <section className="audit-detail-summary" aria-label="Activity overview">
            <span className={`audit-outcome audit-outcome-${statusClass}`}><StatusIcon size={16} />{outcomeLabel(log.status)}</span>
            <p className="audit-detail-story">{log.description || 'No description was recorded for this activity.'}</p>
            <dl className="audit-detail-facts">
              <div><dt>Performed by</dt><dd>{log.userName || readableLabel(log.userRole) || 'Not recorded'}{log.userName && <small>{readableLabel(log.userRole)}</small>}</dd></div>
              <div><dt>Date and time</dt><dd>{log.timestamp ? formatDateTime(log.timestamp) : 'Not recorded'}<small>Philippine time</small></dd></div>
              {log.entityName && <div><dt>Related record</dt><dd>{log.entityName}</dd></div>}
              {log.metadata?.entrySource === 'manual' && <>
                <div><dt>Entry method</dt><dd>Manual entry<small>Recorded by staff instead of a QR scan</small></dd></div>
                <div><dt>Reason</dt><dd>{log.metadata.justification || 'Not recorded'}</dd></div>
              </>}
            </dl>
          </section>
          {log.errorMessage && <section className="audit-detail-error"><h3>What went wrong</h3><p>{log.errorMessage}</p></section>}
          <section className="audit-detail-section">
            <h3>{kind === 'diff' ? 'What changed' : 'Recorded details'}</h3>
            <p className="audit-detail-hint">{rows.length ? kind === 'diff' ? 'Only changed fields are shown. Compare the previous and recorded values below.' : kind === 'removed' ? 'Record details saved before this action.' : 'Information saved with this activity.' : 'No field-level changes were recorded for this activity.'}</p>
            {rows.length > 0 && (kind === 'diff' ? <div className="audit-detail-changes">{rows.map(row => <article className="audit-detail-change" key={row.key}>
              <h4>{row.label}</h4><div className="audit-detail-pair"><div><span>Before</span><p>{row.before}</p></div><div><span>After</span><p>{row.after}</p></div></div>
            </article>)}</div> : <dl className="audit-detail-list">{rows.map(row => <div key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>)}
          </section>
          {metadata.length > 0 && <details className="audit-detail-extra"><summary>More information ({metadata.length})</summary><dl className="audit-detail-list">{metadata.map(row => <div key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></details>}
          <details className="audit-detail-extra"><summary>Technical references</summary><dl className="audit-detail-list">
            <div><dt>Log reference</dt><dd>{log.logId || log._id || 'Not recorded'}</dd></div>
            <div><dt>Record reference</dt><dd>{log.entityId || 'Not recorded'}</dd></div>
            <div><dt>IP address</dt><dd>{log.ipAddress || 'Not recorded'}</dd></div>
          </dl></details>
        </div>
        <ModalActions as="footer" className="audit-detail-footer"><button type="button" className="audit-detail-close" onClick={onClose}>Close details</button></ModalActions>
      </div>
    </dialog>
  );
}
