import React, { useEffect, useMemo, useState } from 'react';
import { Search, QrCode, Download, Printer, RefreshCw, Loader2, List, Grid2X2, Users, UserCheck } from 'lucide-react';
import { Modal } from '../../ui/modal';
import { memberAPI, attendanceAPI, resolveQrAssetUrl } from '../../../services/api';
import { loadDashboardRecords } from '../../../utils/attendanceDashboard';
import { directoryDate, getQrUnavailableReason, normalizeDirectoryMembers, filterDirectoryMembers, directoryCsv, directoryPrintHtml } from '../../../utils/memberDirectory';
import AttendanceMetricGrid from '../shared/AttendanceMetricGrid';
import './MemberDirectory.css';

export default function MemberDirectory() {
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
  const [limit, setLimit] = useState(10);
  const [view, setView] = useState('table');
  const [selectedId, setSelectedId] = useState(null);
  const [qrState, setQrState] = useState('loading');
  const [qrAttempt, setQrAttempt] = useState(0);
  const [printing, setPrinting] = useState(false);
  const [feedback, setFeedback] = useState(null);

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
  const ready = !loading && !error;
  const hasFilters = search || status !== 'all' || barangay !== 'all' || sort !== 'name';
  const update = (setter, value) => { setter(value); setPage(1); setFeedback(null); };
  const reset = () => { setSearch(''); setStatus('all'); setBarangay('all'); setSort('name'); setPage(1); setFeedback(null); };
  const openQr = member => {
    if (!ready || getQrUnavailableReason(member)) return;
    setQrState('loading'); setQrAttempt(0); setSelectedId(member.id); setFeedback(null);
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

  const printQr = async member => {
    if (!ready || printing || getQrUnavailableReason(member)) return;
    const preview = window.open('', '_blank');
    if (!preview) { setFeedback({ error: true, message: 'The print window was blocked. Allow pop-ups for this site and try again.' }); return; }
    setPrinting(true); setFeedback(null);
    try {
      preview.document.write(directoryPrintHtml(member, resolveQrAssetUrl(member.qrCodeUrl), `${window.location.origin}/SVPMPC-LOGO(MAIN).png`));
      preview.document.close();
      await Promise.all(Array.from(preview.document.images, img => new Promise((resolve, reject) => {
        if (img.complete) { img.naturalWidth ? resolve() : reject(new Error('Image unavailable')); return; }
        const timer = setTimeout(() => { cleanup(); reject(new Error('Image load timed out')); }, 15000);
        const cleanup = () => { clearTimeout(timer); img.onload = null; img.onerror = null; };
        img.onload = () => { cleanup(); resolve(); };
        img.onerror = () => { cleanup(); reject(new Error('Image unavailable')); };
      })));
      if (preview.closed) return;
      preview.document.getElementById('print-status').textContent = 'QR card ready. Use your browser’s Print command to print again.';
      preview.focus(); preview.print();
    } catch {
      if (!preview.closed) preview.document.getElementById('print-status').textContent = 'The QR card could not load. Close this window and retry from the directory.';
      setFeedback({ error: true, message: 'The QR card could not load completely. Please retry printing.' });
    } finally { setPrinting(false); }
  };

  const qrActions = member => {
    const reason = getQrUnavailableReason(member);
    return reason ? <span className="md-qr-unavailable">{reason}</span> : <div className="md-row-actions">
      <button className="md-button" onClick={() => openQr(member)} aria-label={`View QR code for ${member.name}`}><QrCode size={14} /> View QR</button>
      <button className="md-button" disabled={printing} onClick={() => printQr(member)} aria-label={`Print QR card for ${member.name}`}><Printer size={14} /> Print</button>
    </div>;
  };
  const badge = member => <span className={`md-status ${member.status === 'active' ? 'md-status-active' : ''}`}>{member.status}</span>;

  return <div className="member-directory">
    <header className="md-header"><div><p className="md-eyebrow">Attendance management / Members</p><h1>Member directory</h1><p className="md-description">Find member details, check attendance history, and access issued QR codes.</p></div>
      <div className="md-header-actions"><button className="md-button" onClick={() => setReload(value => value + 1)} disabled={loading || printing}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button><button className="md-button md-primary" onClick={exportDirectory} disabled={!ready || !filtered.length}><Download size={15} /> Export CSV</button></div>
    </header>
    {feedback && <div role={feedback.error ? 'alert' : 'status'} className={`md-notice ${feedback.error ? 'md-error' : ''}`}>{feedback.message}</div>}
    <AttendanceMetricGrid label="Directory overview" busy={loading} items={[
      ['Registered members', ready ? normalized.length.toLocaleString() : '—', null, Users],
      ['Active members', ready ? normalized.filter(member => member.status === 'active').length.toLocaleString() : '—', null, UserCheck],
      ['QR codes available', ready ? normalized.filter(member => !getQrUnavailableReason(member)).length.toLocaleString() : '—', null, QrCode],
    ]} />
    <section className="md-filters" aria-label="Member filters"><div className="md-filter-heading"><h2>Find a member</h2><button className="md-text-button" onClick={reset} disabled={!hasFilters}>Reset filters</button></div>
      <div className="md-filter-grid">
        <label>Search members<div className="md-search"><Search size={16} /><input value={search} onChange={e => update(setSearch, e.target.value)} placeholder="Name, passbook, email, or phone" /></div></label>
        <label>Membership status<select value={status} onChange={e => update(setStatus, e.target.value)}><option value="all">All statuses</option>{statuses.map(value => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}</select></label>
        <label>Barangay<select value={barangay} onChange={e => update(setBarangay, e.target.value)}><option value="all">All barangays</option>{barangays.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Sort by<select value={sort} onChange={e => update(setSort, e.target.value)}><option value="name">Member name: A–Z</option><option value="passbook">Passbook number</option><option value="attendance">Latest attendance</option></select></label>
      </div>
    </section>
    <section className="md-register" aria-labelledby="md-register-title" aria-busy={loading}>
      <div className="md-register-heading"><div><h2 id="md-register-title">Member register</h2><p>Membership and contact details, with the latest recorded attendance.</p></div><div className="md-view-switch" role="group" aria-label="Directory view"><button aria-pressed={view === 'table'} onClick={() => setView('table')}><List size={15} /> Table</button><button aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Grid2X2 size={15} /> Cards</button></div></div>
      <div className="md-scope"><span>{ready ? `${filtered.length.toLocaleString()} of ${normalized.length.toLocaleString()} members` : 'Member directory'}{status !== 'all' && ` · ${status}`}{barangay !== 'all' && ` · ${barangay}`}</span><span>CSV includes all matching members · Dates in PHT</span></div>
      {loading || error ? <div className="md-empty" role={error ? 'alert' : 'status'}>{loading && <Loader2 size={22} className="animate-spin" />}<strong>{loading ? 'Loading the member directory' : 'Directory unavailable'}</strong><p>{loading ? 'Gathering member records and attendance history.' : error}</p>{error && <button className="md-button" onClick={() => setReload(value => value + 1)}>Retry</button>}</div>
        : !filtered.length ? <div className="md-empty"><strong>{normalized.length ? 'No members match these filters' : 'No members recorded'}</strong><p>{normalized.length ? 'Try a different name, passbook number, status, or barangay.' : 'Members will appear here once they are added by an administrator.'}</p>{hasFilters && <button className="md-button" onClick={reset}>Reset filters</button>}</div>
          : view === 'table' ? <div className="md-table-scroll" role="region" aria-label="Member register" tabIndex={0}><table><thead><tr><th scope="col">Member / Passbook</th><th scope="col">Contact</th><th scope="col">Barangay</th><th scope="col">Status</th><th scope="col">Last attendance (PHT)</th><th scope="col">QR code</th></tr></thead><tbody>
            {visible.map(member => <tr key={member.id}><td><strong>{member.name}</strong><span className="md-secondary md-passbook">{member.memberId}</span></td><td><span>{member.email || 'Email not recorded'}</span><span className="md-secondary">{member.phone || 'Phone not recorded'}</span></td><td>{member.barangay || 'Not recorded'}</td><td>{badge(member)}</td><td>{directoryDate(member.lastAttendance, true)}</td><td>{qrActions(member)}</td></tr>)}
          </tbody></table></div> : <div className="md-card-grid">{visible.map(member => <article key={member.id} className="md-member-card"><div className="md-card-heading"><div><h3>{member.name}</h3><p className="md-passbook">Passbook: {member.memberId}</p></div>{badge(member)}</div><dl><div><dt>Email</dt><dd>{member.email || 'Not recorded'}</dd></div><div><dt>Phone</dt><dd>{member.phone || 'Not recorded'}</dd></div><div><dt>Barangay</dt><dd>{member.barangay || 'Not recorded'}</dd></div><div><dt>Last attendance</dt><dd>{directoryDate(member.lastAttendance, true)}</dd></div></dl><footer>{qrActions(member)}</footer></article>)}</div>}
      <footer className="md-pagination"><span>{ready && filtered.length ? `${(currentPage - 1) * limit + 1}–${Math.min(currentPage * limit, filtered.length)} of ${filtered.length} members` : ready ? '0 members' : 'Records unavailable while loading'}</span><div><label>Rows<select value={limit} onChange={e => update(setLimit, Number(e.target.value))}>{[10, 25, 50].map(value => <option key={value}>{value}</option>)}</select></label><nav aria-label="Member pages"><button className="md-button" disabled={!ready || currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span aria-live="polite">{currentPage} / {pages}</span><button className="md-button" disabled={!ready || currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></nav></div></footer>
    </section>
    <p className="md-footnote">QR codes are issued and managed by the attendance administrator. Deactivated codes and codes belonging to deceased members are unavailable here.</p>

    <Modal isOpen={Boolean(selectedMember)} onClose={() => !printing && setSelectedId(null)} title="Member QR code" className="max-w-md">
      {selectedMember && <div className="md-qr-dialog"><div className="md-qr-letterhead"><img src="/SVPMPC-LOGO(MAIN).png" alt="Cooperative logo" /><div><strong>St. Vincent Parish<br />Multi-Purpose Cooperative</strong><span>Member identification</span></div></div><h3>{selectedMember.name}</h3><p className="md-qr-id">Passbook number: {selectedMember.memberId}</p>
        {getQrUnavailableReason(selectedMember) ? <p role="status" className="md-notice">{getQrUnavailableReason(selectedMember)}</p> : <div className="md-qr-preview">
          {qrState === 'loading' && <p role="status">Loading issued QR code…</p>}
          {qrState === 'error' ? <div role="alert"><p>The QR image could not load.</p><button className="md-button" onClick={() => { setQrState('loading'); setQrAttempt(value => value + 1); }}>Retry image</button></div> : <img key={`${selectedMember.id}-${qrAttempt}`} src={resolveQrAssetUrl(selectedMember.qrCodeUrl)} alt={`Issued QR code for ${selectedMember.name}`} width={192} height={192} onLoad={() => setQrState('ready')} onError={() => setQrState('error')} style={{ display: qrState === 'ready' ? 'block' : 'none' }} />}
          {qrState === 'ready' && <p>Present this code for attendance scanning.</p>}
        </div>}
        <dl className="md-qr-details"><div><dt>Membership status</dt><dd>{badge(selectedMember)}</dd></div><div><dt>Barangay</dt><dd>{selectedMember.barangay || 'Not recorded'}</dd></div><div><dt>Member since</dt><dd>{directoryDate(selectedMember.joinDate)}</dd></div></dl>
        {feedback?.error && <p role="alert" className="md-notice md-error">{feedback.message}</p>}
        <div className="md-dialog-actions"><button className="md-button" disabled={printing} onClick={() => setSelectedId(null)}>Close</button><button className="md-button md-primary" disabled={!ready || qrState !== 'ready' || printing || !!getQrUnavailableReason(selectedMember)} onClick={() => printQr(selectedMember)}>{printing ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}{printing ? 'Preparing…' : 'Print QR card'}</button></div>
      </div>}
    </Modal>
  </div>;
}
