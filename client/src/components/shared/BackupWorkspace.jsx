import React, { useRef } from "react";
import { ArrowDownToLine, FileJson, Upload, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { BACKUP_COLLECTIONS, restoreSummaryLines } from "../../utils/moduleBackup";
import "./BackupWorkspace.css";

export default function BackupWorkspace({
  module, exports, downloadFullBackup, exporting, exportError, lastExport,
  restoreFile, pendingRestore, restoring, restoreResult, parseError,
  handleFileSelect, cancelRestore, confirmRestore, ledgerLoadError,
}) {
  const inputRef = useRef(null);
  const name = module === "attendance" ? "Attendance" : "Mortuary";
  const collections = BACKUP_COLLECTIONS[module];
  const resetFile = () => {
    cancelRestore();
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="backup-workspace">
      <header className="bw-header">
        <p className="bw-context">{name} administration <span>/</span> Data management</p>
        <h1>Backup &amp; restore</h1>
        <p>Keep a copy of your records or recover data from a saved backup.</p>
      </header>

      <div className="bw-layout">
        <div className="bw-main">
          <section className="bw-panel bw-complete" aria-labelledby={`${module}-backup-title`}>
            <div className="bw-section-label">Database backup <span>JSON</span></div>
            <h2 id={`${module}-backup-title`}>A complete copy of your {name.toLowerCase()} records.</h2>
            <p>Export all {collections.length} data collections in a single file. Use this file when you need to restore records.</p>
            <div className="bw-backup-action">
              <button type="button" className="bw-button bw-primary" onClick={downloadFullBackup} disabled={exporting}>
                {exporting ? <Loader2 className="bw-spin" size={16} /> : <ArrowDownToLine size={16} />}
                {exporting ? "Preparing backup…" : "Download full backup"}
              </button>
              <span>Saved to your device as .json</span>
            </div>
            {exportError && <p className="bw-error" role="alert">{exportError}</p>}
            {lastExport && <p className="bw-success" role="status"><CheckCircle2 size={15} />Backup downloaded. Keep the file in a secure location.</p>}
            <details className="bw-collections">
              <summary>Included in this backup <span>{collections.length} collections</span></summary>
              <dl>{collections.map(([key, label]) => (
                <div key={key}><dt>{label}</dt><dd>{lastExport?.[key] !== undefined ? lastExport[key].toLocaleString() : "Included"}</dd></div>
              ))}</dl>
            </details>
          </section>

          <section className="bw-panel" aria-labelledby={`${module}-exports-title`}>
            <div className="bw-panel-heading">
              <h2 id={`${module}-exports-title`}>Individual exports</h2>
              <p>CSV files for spreadsheets and reporting. Use a full backup for restoration.</p>
            </div>
            {ledgerLoadError && <p className="bw-error bw-inline-error" role="alert">{ledgerLoadError} Refresh the page to retry the ledger export.</p>}
            <div className="bw-table-scroll">
              <table className="bw-export-table">
                <thead><tr><th scope="col">Records</th><th scope="col">Available</th><th scope="col"><span className="bw-sr-only">Download</span></th></tr></thead>
                <tbody>{exports.map(({ label, description, count, download, disabled }) => (
                  <tr key={label}>
                    <th scope="row">{label}<span>{description}</span></th>
                    <td>{typeof count === "number" ? count.toLocaleString() : count}</td>
                    <td><button type="button" className="bw-export-link" onClick={download} disabled={disabled} aria-label={`Download ${label.toLowerCase()} CSV`}><ArrowDownToLine size={14} />CSV</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <p className="bw-table-note">Counts reflect records currently loaded in this view. Full backups include all server records.</p>
          </section>
          <p className="bw-storage-note"><strong>Keep a recovery copy.</strong> Download a backup after major changes and store a second copy in a secure, separate location.</p>
        </div>

        <section className="bw-panel bw-restore" aria-labelledby={`${module}-restore-title`} aria-busy={restoring}>
          <div className="bw-panel-heading">
            <div className="bw-section-label">Data recovery</div>
            <h2 id={`${module}-restore-title`}>Restore from a backup</h2>
            <p>Select a JSON backup exported from {name}, review its contents, then confirm the restore.</p>
          </div>
          <div className="bw-restore-body">
            <div className="bw-file-area">
              <FileJson size={28} strokeWidth={1.4} aria-hidden="true" />
              <strong>{restoreFile ? restoreFile.name : "Choose a backup file"}</strong>
              <span>{restoreFile ? `${(restoreFile.size / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KB · JSON backup` : "Full backup · .json format"}</span>
              <input key={restoreFile ? "selected" : "empty"} ref={inputRef} id={`${module}-restore-upload`} type="file" accept="application/json,.json" onChange={handleFileSelect} disabled={restoring} className="bw-sr-only" aria-describedby={`${module}-file-help`} />
              <label className="bw-button" htmlFor={`${module}-restore-upload`}>{restoreFile ? "Change file" : "Select file"}</label>
            </div>
            <p id={`${module}-file-help`} className="bw-file-help">Your file is reviewed before any records are changed.</p>
            {parseError && <p className="bw-error" role="alert">{parseError}</p>}

            {pendingRestore && <div className="bw-preview">
              <h3>Review backup contents</h3>
              <dl>{collections.map(([key, label]) => {
                const rows = pendingRestore[key] ?? (key === "attendanceLogs" ? pendingRestore.attendance : undefined);
                return Array.isArray(rows) ? <div key={key}><dt>{label}</dt><dd>{rows.length.toLocaleString()}</dd></div> : null;
              })}</dl>
              <div className="bw-restore-actions">
                <button type="button" className="bw-button" onClick={resetFile} disabled={restoring}>Cancel</button>
                <button type="button" className="bw-button bw-primary" onClick={confirmRestore} disabled={restoring}>
                  {restoring ? <Loader2 size={15} className="bw-spin" /> : <Upload size={15} />}
                  {restoring ? "Restoring…" : "Confirm restore"}
                </button>
              </div>
            </div>}

            <div className="bw-restore-notice">
              <AlertTriangle size={16} aria-hidden="true" />
              <div><h3>Before you restore</h3><p>Matching records are updated and missing records are added. Other records are kept. Overwritten fields cannot be undone; download a fresh backup first.</p></div>
            </div>
            <details className="bw-member-rules"><summary>How member records are handled</summary><p>For existing members, only {module === "attendance" ? "QR details" : "beneficiary fields"} are restored. Shared profiles, status, {module === "attendance" ? "beneficiaries" : "QR details"}, and module assignments are preserved. Missing members are enrolled in both Attendance and Mortuary.</p></details>

            {restoreResult?.summary && <div className="bw-result" role="status"><h3><CheckCircle2 size={16} />Restore complete</h3>{restoreSummaryLines(restoreResult.summary, module).map(([label, text]) => <p key={label}><strong>{label}:</strong> {text}</p>)}</div>}
            {restoreResult?.error && <p className="bw-error" role="alert">{restoreResult.error}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
