import React, { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { BACKUP_COLLECTIONS, restoreSummaryLines } from "../../utils/moduleBackup";
import "./BackupWorkspace.css";

export default function BackupWorkspace({
  module, exports, downloadFullBackup, exporting, exportError, lastExport,
  restoreFile, pendingRestore, restoring, restoreResult, parseError,
  handleFileSelect, cancelRestore, confirmRestore, individualExportError,
}) {
  const inputRef = useRef(null);
  const name = module === "attendance" ? "Attendance" : "Mortuary";
  const collections = BACKUP_COLLECTIONS[module];
  useEffect(() => {
    if (!restoreFile && inputRef.current) inputRef.current.value = "";
  }, [restoreFile]);
  const resetFile = () => {
    cancelRestore();
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="backup-workspace">
      <header className="bw-header">
        <h1>Database backup</h1>
        <p>{name} / Backup and restore</p>
      </header>

      <div className="bw-settings">
        <section className="bw-setting" aria-labelledby={`${module}-backup-title`}>
          <div className="bw-setting-label">
            <h2 id={`${module}-backup-title`}>Full backup</h2>
            <p>Save a restorable copy of this module's data.</p>
          </div>
          <div className="bw-setting-content">
            <div className="bw-download-row">
              <div><h3>{name} database</h3><p>All records, reports and settings in one JSON file.</p></div>
              <button type="button" className="bw-button bw-primary" onClick={downloadFullBackup} disabled={exporting}>
                {exporting && <Loader2 className="bw-spin" size={14} aria-hidden="true" />}
                {exporting ? "Preparing..." : "Download backup"}
              </button>
            </div>
            {exportError && <p className="bw-error" role="alert">{exportError}</p>}
            {lastExport && <p className="bw-success" role="status">Backup downloaded. Save a copy in a secure location.</p>}
            <details className="bw-collections">
              <summary>View included records</summary>
              <dl>{collections.map(([key, label]) => (
                <div key={key}><dt>{label}</dt><dd>{lastExport?.[key] !== undefined ? lastExport[key].toLocaleString() : "Included"}</dd></div>
              ))}</dl>
            </details>
          </div>
        </section>

        <section className="bw-setting" aria-labelledby={`${module}-exports-title`}>
          <div className="bw-setting-label">
            <h2 id={`${module}-exports-title`}>Individual backups</h2>
            <p>Save a JSON backup of a specific dataset.</p>
          </div>
          <div className="bw-setting-content">
            {individualExportError && <p className="bw-error" role="alert">{individualExportError}</p>}
            <div className="bw-table-scroll">
              <table className="bw-export-table">
                <thead><tr><th scope="col">Dataset</th><th scope="col">Records</th><th scope="col">Export</th></tr></thead>
                <tbody>{exports.map(({ label, count, download, disabled, loading }) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td>{typeof count === "number" ? count.toLocaleString() : count}</td>
                    <td><button type="button" className="bw-export-link" onClick={download} disabled={disabled} aria-label={`Download ${label.toLowerCase()} JSON`} aria-busy={loading || undefined}>{loading ? "Preparing..." : "Download JSON"}</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <p className="bw-help">Downloads include all server records in the selected dataset. Counts reflect loaded records until export. Restore an individual file below; related member and event records must already exist.</p>
          </div>
        </section>

        <section className="bw-setting" aria-labelledby={`${module}-restore-title`} aria-busy={restoring}>
          <div className="bw-setting-label">
            <h2 id={`${module}-restore-title`}>Restore data</h2>
            <p>Import records from a previously saved backup.</p>
          </div>
          <div className="bw-setting-content">
            <label className="bw-file-label" htmlFor={`${module}-restore-upload`}>Backup file</label>
            <input ref={inputRef} id={`${module}-restore-upload`} type="file" accept="application/json,.json" onChange={handleFileSelect} disabled={restoring} className="bw-file-input" aria-describedby={`${module}-file-help`} />
            <p id={`${module}-file-help`} className="bw-help">Select a .json backup exported from {name}. Review the records below before restoring.</p>
            {parseError && <p className="bw-error" role="alert">{parseError}</p>}

            {pendingRestore && <div className="bw-preview">
              <h3>Backup contents{restoreFile && <span> / {restoreFile.name}</span>}</h3>
              <dl>{collections.map(([key, label]) => {
                const rows = pendingRestore[key] ?? (key === "attendanceLogs" ? pendingRestore.attendance : undefined);
                return Array.isArray(rows) ? <div key={key}><dt>{label}</dt><dd>{rows.length.toLocaleString()}</dd></div> : null;
              })}</dl>
            </div>}

            <p className="bw-restore-notice"><strong>Existing records may be updated.</strong> Matching records are overwritten and missing records are added. Other records are kept. Download a current backup first; overwritten fields cannot be recovered automatically.</p>
            <details className="bw-member-rules"><summary>Member restore rules</summary><p>For existing members, only {module === "attendance" ? "QR details" : "beneficiary fields"} are restored. Shared profiles, status, {module === "attendance" ? "beneficiaries" : "QR details"}, and module assignments are preserved. Missing members are enrolled in both Attendance and Mortuary.</p></details>

            <div className="bw-restore-actions">
              <button type="button" className="bw-button" onClick={confirmRestore} disabled={!pendingRestore || restoring}>
                {restoring && <Loader2 size={14} className="bw-spin" aria-hidden="true" />}
                {restoring ? "Restoring..." : "Restore backup"}
              </button>
              {(restoreFile || pendingRestore) && <button type="button" className="bw-text-button" onClick={resetFile} disabled={restoring}>Clear selection</button>}
            </div>
            {restoreResult?.summary && <div className="bw-result" role="status"><h3>Restore complete</h3>{restoreSummaryLines(restoreResult.summary, module).map(([label, text]) => <p key={label}><strong>{label}:</strong> {text}</p>)}</div>}
            {restoreResult?.error && <p className="bw-error" role="alert">{restoreResult.error}</p>}
          </div>
        </section>
      </div>
      <p className="bw-footer">Backup files are downloaded to your device. Keep a separate copy in secure storage.</p>
    </div>
  );
}
