import { SearchField } from '../../ui/workspace';
import { Input as TextInput, Select } from '../../ui/input';
import { PageHeader } from '../../ui/workspace';
import { Table as DataTable } from '../../ui/table';
import React, { useEffect, useMemo, useState } from 'react';
import { Search, QrCode, Download, FileDown, Printer, Loader2, List, Grid2X2, Users, UserCheck } from 'lucide-react';
import { Modal } from '../../ui/modal';
import { memberAPI, attendanceAPI, resolveQrAssetUrl } from '../../../services/api';
import { loadDashboardRecords } from '../../../utils/attendanceDashboard';
import { directoryDate, getQrUnavailableReason, normalizeDirectoryMembers, filterDirectoryMembers, directoryCsv, directoryPrintHtml, directoryBulkPrintHtml } from '../../../utils/memberDirectory';
import { buildQrCardsPdf } from '../../../utils/qrCardsPdf';
import AttendanceMetricGrid from '../shared/AttendanceMetricGrid';
import './MemberDirectory.css';

export default function QRManagement() {
  const [members, setMembers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [barangay, setBarangay] = useState('all');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [view, setView] = useState(() => window.innerWidth < 768 ? 'grid' : 'table');
  const [selectedId, setSelectedId] = useState(null);
  const [qrState, setQrState] = useState('loading');
  const [qrAttempt, setQrAttempt] = useState(0);
  const [printing, setPrinting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [qrBusy, setQrBusy] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      loadDashboardRecords(memberAPI.getAllMembers, 'members'),
      loadDashboardRecords(attendanceAPI.getAllAttendance, 'attendance'),
    ]).then(([memberRows, attendanceRows]) => {
      if (!cancelled) { setMembers(memberRows); setAttendance(attendanceRows); }
    }).catch(() => {
      if (!cancelled) setError('Unable to load the complete directory. Retry to view current member and attendance information.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  const normalized = useMemo(() => normalizeDirectoryMembers(members, attendance), [members, attendance]);
  const filtered = useMemo(() => filterDirectoryMembers(normalized, { search, status, barangay, sort }), [normalized, search, status, barangay, sort]);
  const barangays = [...new Set(normalized.map(member => member.barangay).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const statuses = [...new Set(['active', 'inactive', 'deceased', ...normalized.map(member => member.status)])];
  const pages = Math.max(1, Math.ceil(filtered.length / limit));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * limit, currentPage * limit);
  const selectedMember = normalized.find(member => member.id === selectedId);
  // Bulk print covers every matching member with a usable QR, not just the visible page.
  const printable = useMemo(() => filtered.filter(member => !getQrUnavailableReason(member)), [filtered]);
  const printScope = [barangay !== 'all' ? `Barangay ${barangay}` : 'All barangays', status !== 'all' && status, search && `matching "${search}"`].filter(Boolean).join(' · ');
  const ready = !loading && !error;
  const hasFilters = search || status !== 'all' || barangay !== 'all' || sort !== 'name';
  const update = (setter, value) => { setter(value); setPage(1); setFeedback(null); };
  const reset = () => { setSearch(''); setStatus('all'); setBarangay('all'); setSort('name'); setPage(1); setFeedback(null); };
  const openQr = member => {
    if (!ready || qrBusy) return;
    setQrState('loading'); setQrAttempt(0); setSelectedId(member.id); setFeedback(null);
  };

  const qrStatusLabel = member => !member.qrCodeGenerated ? 'Not created' : member.status === 'inactive' || member.status === 'deceased' || member.qrCodeActive === false ? 'Inactive' : 'Active';
  const runQrAction = async action => {
    if (!selectedMember || qrBusy || printing || downloadingPdf) return;
    const memberId = selectedMember.memberId;
    setQrBusy(action); setFeedback(null);
    try {
      const actions = { create: memberAPI.generateMemberQR, regenerate: memberAPI.regenerateMemberQR, deactivate: memberAPI.deactivateMemberQR, activate: memberAPI.reactivateMemberQR };
      const response = await actions[action](memberId);
      const updated = response.member || await memberAPI.getMemberQRStatus(memberId);
      setMembers(rows => rows.map(row => String(row.memberId || row.id) === memberId ? { ...row, ...updated } : row));
      setQrState('loading'); setQrAttempt(value => value + 1);
      const messages = { create: 'QR code created.', regenerate: 'QR code regenerated. The previous code no longer scans.', deactivate: 'QR code deactivated.', activate: 'QR code activated.' };
      setFeedback({ message: messages[action] });
    } catch (error) {
      setFeedback({ error: true, message: error.response?.data?.message || 'Unable to update the QR code. Please retry.' });
    } finally { setQrBusy(null); }
  };
  const generateMissingQr = async () => {
    if (!ready || qrBusy || printing || downloadingPdf) return;
    setQrBusy('bulk'); setFeedback(null);
    try {
      const response = await memberAPI.generateAllMissingQR();
      setReload(value => value + 1);
      setFeedback({ message: response.message || 'Missing QR codes created.' });
    } catch (error) {
      setFeedback({ error: true, message: error.response?.data?.message || 'Unable to create missing QR codes.' });
    } finally { setQrBusy(null); }
  };

  const exportDirectory = () => {
    if (!ready || !filtered.length) return;
    try {
      const url = URL.createObjectURL(new Blob([directoryCsv(filtered)], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url; link.download = `member-directory-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback({ message: `CSV download prepared with all ${filtered.length.toLocaleString()} matching members.` });
    } catch { setFeedback({ error: true, message: 'Unable to prepare the CSV. Please try again.' }); }
  };

  const printQr = member => {
    if (getQrUnavailableReason(member)) return;
    printCards(directoryPrintHtml(member, resolveQrAssetUrl(member.qrCodeUrl), `${window.location.origin}/SVPMPC-LOGO(MAIN).png`), 'QR card');
  };

  const printAllQr = () => {
    if (!printable.length) return;
    const entries = printable.map(member => ({ member, qrUrl: resolveQrAssetUrl(member.qrCodeUrl) }));
    printCards(directoryBulkPrintHtml(entries, `${window.location.origin}/SVPMPC-LOGO(MAIN).png`, printScope), `${printable.length.toLocaleString()} QR cards`);
  };

  const downloadQrPdf = async () => {
    if (!ready || qrBusy || downloadingPdf || !printable.length) return;
    setDownloadingPdf(true); setFeedback(null);
    try {
      const entries = printable.map(member => ({ member, qrUrl: resolveQrAssetUrl(member.qrCodeUrl) }));
      const doc = await buildQrCardsPdf(entries, { logoUrl: `${window.location.origin}/SVPMPC-LOGO(MAIN).png` });
      const slug = barangay !== 'all' ? barangay.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : 'all-barangays';
      doc.save(`member-qr-cards-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
      setFeedback({ message: `PDF prepared with ${printable.length.toLocaleString()} QR card${printable.length === 1 ? '' : 's'} (${printScope}).` });
    } catch {
      setFeedback({ error: true, message: 'Some QR images could not load, so the PDF was not created. Please try again.' });
    } finally { setDownloadingPdf(false); }
  };

  const printCards = async (html, label) => {
    if (!ready || qrBusy || printing) return;
    const preview = window.open('', '_blank');
    if (!preview) { setFeedback({ error: true, message: 'The print window was blocked. Allow pop-ups for this site and try again.' }); return; }
    setPrinting(true); setFeedback(null);
    try {
      preview.document.write(html);
      preview.document.close();
      await Promise.all(Array.from(preview.document.images, img => new Promise((resolve, reject) => {
        if (img.complete) { img.naturalWidth ? resolve() : reject(new Error('Image unavailable')); return; }
        const timer = setTimeout(() => { cleanup(); reject(new Error('Image load timed out')); }, 15000);
        const cleanup = () => { clearTimeout(timer); img.onload = null; img.onerror = null; };
        img.onload = () => { cleanup(); resolve(); };
        img.onerror = () => { cleanup(); reject(new Error('Image unavailable')); };
      })));
      if (preview.closed) return;
      preview.document.getElementById('print-status').textContent = `${label} ready. Use your browser’s Print command to print again.`;
      preview.focus(); preview.print();
    } catch {
      if (!preview.closed) preview.document.getElementById('print-status').textContent = `Some QR images could not load. Close this window and retry from the directory.`;
      setFeedback({ error: true, message: `The ${label} could not load completely. Please retry printing.` });
    } finally { setPrinting(false); }
  };

  const qrActions = member => {
    const reason = getQrUnavailableReason(member);
    const label = qrStatusLabel(member);
    return <div className="qrm-qr-cell">
      <span className={`qrm-qr-badge qrm-qr-${label.toLowerCase().replaceAll(' ', '-')}`}><span aria-hidden="true" />{label === 'Not created' ? 'No QR code' : `QR ${label.toLowerCase()}`}</span>
      <div className="md-row-actions">
        <button className={`md-button qrm-manage ${!member.qrCodeGenerated ? 'qrm-create' : ''}`} disabled={!ready || !!qrBusy} onClick={() => openQr(member)} aria-label={`Manage QR for ${member.name}`}><QrCode size={15} aria-hidden="true" />{member.qrCodeGenerated ? 'Manage QR' : 'Create QR'}</button>
        <button className="md-button qrm-print" disabled={printing || !!qrBusy || !!reason} onClick={() => printQr(member)} aria-label={`Print QR card for ${member.name}`} title={reason || 'Print QR card'}><Printer size={16} aria-hidden="true" /></button>
      </div>
    </div>;
  };
  const badge = member => <span className={`md-status ${member.status === 'active' ? 'md-status-active' : ''}`}>{member.status}</span>;

  return <div className="member-directory qr-management">
    <PageHeader separateBreadcrumb className="md-header"><div><p className="md-eyebrow attendance-breadcrumb"><span>Attendance management</span><span aria-hidden="true">/</span><strong>QR Management</strong></p><h1>QR Management</h1><p className="md-description">Find members, create and manage their QR codes, and print attendance QR cards.</p></div>
      <div className="md-header-actions"><button className="md-button" onClick={generateMissingQr} disabled={!ready || printing || !!qrBusy}><QrCode size={15} />{qrBusy === 'bulk' ? 'Creating...' : 'Create missing QR codes'}</button><button className="md-button md-primary" onClick={exportDirectory} disabled={!ready || !filtered.length}><Download size={15} /> Export CSV</button></div>
    </PageHeader>
    {feedback && <div role={feedback.error ? 'alert' : 'status'} className={`md-notice ${feedback.error ? 'md-error' : ''}`}>{feedback.message}</div>}
    <AttendanceMetricGrid label="QR Management overview" busy={loading} items={[
      ['Registered members', ready ? normalized.length.toLocaleString() : '—', null, Users],
      ['Active members', ready ? normalized.filter(member => member.status === 'active').length.toLocaleString() : '—', null, UserCheck],
      ['QR codes available', ready ? normalized.filter(member => !getQrUnavailableReason(member)).length.toLocaleString() : '—', null, QrCode],
    ]} />
    <section className="md-filters" aria-label="Member filters"><div className="md-filter-heading"><h2>Find a member</h2><div className="md-filter-actions"><button className="md-text-button" onClick={reset} disabled={!hasFilters}>Reset filters</button><button className="md-button" onClick={printAllQr} disabled={!ready || printing || downloadingPdf || !!qrBusy || !printable.length} title={ready ? `Print QR cards for ${printScope}` : undefined}>{printing ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />} Print QR cards{ready ? ` (${printable.length.toLocaleString()})` : ''}</button><button className="md-button" onClick={downloadQrPdf} disabled={!ready || printing || downloadingPdf || !!qrBusy || !printable.length} title={ready ? `Download QR cards for ${printScope} as PDF` : undefined}>{downloadingPdf ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} {downloadingPdf ? 'Preparing PDF…' : 'Download PDF'}</button></div></div>
      <div className="md-filter-grid">
        <label>Search members<SearchField as="div" className="md-search"><Search size={16} /><TextInput unstyled value={search} onChange={e => update(setSearch, e.target.value)} placeholder="Name, passbook, email, or phone" /></SearchField></label>
        <label>Membership status<Select value={status} onChange={e => update(setStatus, e.target.value)}><option value="all">All statuses</option>{statuses.map(value => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}</Select></label>
        <label>Barangay<Select value={barangay} onChange={e => update(setBarangay, e.target.value)}><option value="all">All barangays</option>{barangays.map(value => <option key={value}>{value}</option>)}</Select></label>
        <label>Sort by<Select value={sort} onChange={e => update(setSort, e.target.value)}><option value="name">Member name: A–Z</option><option value="passbook">Passbook number</option></Select></label>
      </div>
    </section>
    <section className="md-register" aria-labelledby="md-register-title" aria-busy={loading}>
      <div className="md-register-heading"><div><h2 id="md-register-title">Member register</h2><p>Find a member and manage their attendance QR code.</p></div><div className="md-view-switch" role="group" aria-label="Directory view"><button aria-pressed={view === 'table'} onClick={() => setView('table')}><List size={15} /> Table</button><button aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Grid2X2 size={15} /> Cards</button></div></div>
      <div className="md-scope"><span>{ready ? `${filtered.length.toLocaleString()} of ${normalized.length.toLocaleString()} members` : 'QR Management'}{status !== 'all' && ` · ${status}`}{barangay !== 'all' && ` · ${barangay}`}</span><span>Exports and printing include all matching members · Dates in PHT</span></div>
      {loading || error ? <div className="md-empty" role={error ? 'alert' : 'status'}>{loading && <Loader2 size={22} className="animate-spin" />}<strong>{loading ? 'Loading the member directory' : 'Directory unavailable'}</strong><p>{loading ? 'Gathering member records and attendance history.' : error}</p>{error && <button className="md-button" onClick={() => setReload(value => value + 1)}>Retry</button>}</div>
        : !filtered.length ? <div className="md-empty"><strong>{normalized.length ? 'No members match these filters' : 'No members recorded'}</strong><p>{normalized.length ? 'Try a different name, passbook number, status, or barangay.' : 'Members will appear here once they are added by an administrator.'}</p>{hasFilters && <button className="md-button" onClick={reset}>Reset filters</button>}</div>
          : view === 'table' ? <div className="md-table-scroll" role="region" aria-label="Member register" tabIndex={0}><DataTable className="qrm-table">
            <colgroup><col className="qrm-col-member" /><col className="qrm-col-contact" /><col className="qrm-col-barangay" /><col className="qrm-col-status" /><col className="qrm-col-qr" /></colgroup>
            <thead><tr><th scope="col">Member</th><th scope="col">Contact details</th><th scope="col">Barangay</th><th scope="col">Membership</th><th scope="col">QR code & actions</th></tr></thead><tbody>
            {visible.map(member => <tr key={member.id}>
              <td><div className="qrm-member"><div className="qrm-member-info"><strong title={member.name}>{member.name}</strong><span className="md-secondary md-passbook" title={`Passbook: ${member.memberId}`}>Passbook <span>{member.memberId}</span></span></div></div></td>
              <td><div className="qrm-contact"><span className={!member.email ? 'qrm-muted' : ''} title={member.email || undefined}>{member.email || 'No email recorded'}</span><span className="md-secondary">{member.phone || 'No phone recorded'}</span></div></td>
              <td><span className={!member.barangay ? 'qrm-muted' : ''}>{member.barangay || 'Not recorded'}</span></td>
              <td>{badge(member)}</td>
              <td>{qrActions(member)}</td>
            </tr>)}
          </tbody></DataTable></div> : <div className="md-card-grid">{visible.map(member => <article key={member.id} className="md-member-card"><div className="md-card-heading"><div><h3>{member.name}</h3><p className="md-passbook">Passbook: {member.memberId}</p></div>{badge(member)}</div><dl><div><dt>Email</dt><dd>{member.email || 'Not recorded'}</dd></div><div><dt>Phone</dt><dd>{member.phone || 'Not recorded'}</dd></div><div><dt>Barangay</dt><dd>{member.barangay || 'Not recorded'}</dd></div></dl><footer>{qrActions(member)}</footer></article>)}</div>}
      <footer className="md-pagination"><span>{ready && filtered.length ? `${(currentPage - 1) * limit + 1}–${Math.min(currentPage * limit, filtered.length)} of ${filtered.length} members` : ready ? '0 members' : 'Records unavailable while loading'}</span><div><label>Rows<Select value={limit} onChange={e => update(setLimit, Number(e.target.value))}>{[10, 25, 50, 75, 100].map(value => <option key={value}>{value}</option>)}</Select></label><nav aria-label="Member pages"><button className="md-button" disabled={!ready || currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span aria-live="polite">{currentPage} / {pages}</span><button className="md-button" disabled={!ready || currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></nav></div></footer>
    </section>
    <p className="md-footnote">The secretary can create, activate, deactivate, regenerate, and print member QR codes. Only active QR codes belonging to eligible members can be printed or used for attendance. Filter by barangay before using Print QR cards or Download PDF to get one barangay at a time.</p>

    <Modal isOpen={Boolean(selectedMember)} onClose={() => !printing && !qrBusy && setSelectedId(null)} title="Member QR code" description="Create and manage this member's attendance code." className="qrm-member-modal" footer={selectedMember && <div className="qrm-modal-footer"><div className="md-dialog-actions"><button className="md-button" disabled={printing || !!qrBusy} onClick={() => setSelectedId(null)}>Close</button><button className="md-button md-primary" disabled={!ready || qrState !== 'ready' || printing || !!qrBusy || !!getQrUnavailableReason(selectedMember)} onClick={() => printQr(selectedMember)}>{printing ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}{printing ? 'Preparing…' : 'Print QR card'}</button></div></div>}>
      {selectedMember && <div className="md-qr-dialog"><div className="md-qr-letterhead"><img src="/SVPMPC-LOGO(MAIN).png" alt="Cooperative logo" /><div><strong>St. Vincent Parish<br />Multi-Purpose Cooperative</strong></div></div><div className="qrm-modal-member"><h3>{selectedMember.name}</h3><p className="md-qr-id">Passbook number <span>{selectedMember.memberId}</span></p></div>
        {getQrUnavailableReason(selectedMember) ? <div className="qrm-empty-preview" role="status"><QrCode size={36} aria-hidden="true" /><strong>{selectedMember.qrCodeGenerated ? 'QR code unavailable' : 'No QR code yet'}</strong><p>{getQrUnavailableReason(selectedMember)}</p></div> : <div className="md-qr-preview">
          {qrState === 'loading' && <p role="status">Loading issued QR code…</p>}
          {qrState === 'error' ? <div role="alert"><p>The QR image could not load.</p><button className="md-button" onClick={() => { setQrState('loading'); setQrAttempt(value => value + 1); }}>Retry image</button></div> : <img key={`${selectedMember.id}-${qrAttempt}`} src={resolveQrAssetUrl(selectedMember.qrCodeUrl)} alt={`Issued QR code for ${selectedMember.name}`} width={192} height={192} onLoad={() => setQrState('ready')} onError={() => setQrState('error')} style={{ display: qrState === 'ready' ? 'block' : 'none' }} />}
          {qrState === 'ready' && <p>Present this code for attendance scanning.</p>}
        </div>}
        <div className="md-qr-controls" aria-label="QR controls">
          <p className={`qrm-control-status qrm-state-${qrStatusLabel(selectedMember).toLowerCase().replaceAll(' ', '-')}`}>QR status: {qrStatusLabel(selectedMember)}</p>
          {!selectedMember.qrCodeGenerated ? <button className="md-button md-primary" disabled={!!qrBusy || printing || downloadingPdf || ['inactive', 'deceased'].includes(selectedMember.status)} onClick={() => runQrAction('create')}>{qrBusy === 'create' ? 'Creating...' : 'Create QR'}</button> : <>
            <button className="md-button" disabled={!!qrBusy || printing || downloadingPdf || ['inactive', 'deceased'].includes(selectedMember.status)} onClick={() => runQrAction('regenerate')}>{qrBusy === 'regenerate' ? 'Regenerating...' : 'Regenerate QR'}</button>
            {selectedMember.qrCodeActive !== false && !['inactive', 'deceased'].includes(selectedMember.status)
              ? <button className="md-button qrm-control-deactivate" disabled={!!qrBusy || printing || downloadingPdf} onClick={() => runQrAction('deactivate')}>{qrBusy === 'deactivate' ? 'Deactivating...' : 'Deactivate QR'}</button>
              : <button className="md-button md-primary" disabled={!!qrBusy || printing || downloadingPdf || ['inactive', 'deceased'].includes(selectedMember.status)} onClick={() => runQrAction('activate')}>{qrBusy === 'activate' ? 'Activating...' : 'Activate QR'}</button>}
          </>}
        </div>
        <dl className="md-qr-details"><div><dt>Membership status</dt><dd>{badge(selectedMember)}</dd></div><div><dt>Barangay</dt><dd>{selectedMember.barangay || 'Not recorded'}</dd></div><div><dt>Member since</dt><dd>{directoryDate(selectedMember.joinDate)}</dd></div></dl>
        {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`md-notice ${feedback.error ? 'md-error' : ''}`}>{feedback.message}</p>}


      </div>}
    </Modal>
  </div>;
}
