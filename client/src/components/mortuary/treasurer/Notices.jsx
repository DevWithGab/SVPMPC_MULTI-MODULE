import { Button as ActionButton } from '../../ui/button';
import { Select } from '../../ui/input';
import { FormField } from '../../ui/workspace';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { Printer, Download, Loader2, FileText, RefreshCw } from 'lucide-react';
import { getBarangay } from '../../../utils/helpers';
import { getNoticeLevel, NOTICE_LEVEL_LABELS, printBalanceNoticesBulk, downloadBalanceNoticesBulkPDF, DEFAULT_NOTICE_THRESHOLDS } from '../../../utils/balanceNotice';
import { treasurerAPI } from '../../../services/api';
import './Notices.css';

/* Pag lagpas dito, server background job na ang gagawa ng batch PDF
imbes na sa browser agad - mabilis naman kasi yung text rendering kaya
ok lang sa maliliit na batch (tignan sa balanceNotice.js), pero pag sobrang
dami (100s to 1000+), baka ma-stuck o mag-timeout yung tab ng Treasurer. */
const LARGE_BATCH_THRESHOLD = 100;
const BATCH_POLL_INTERVAL_MS = 4000;
const noticeAlert = Swal.mixin({
  confirmButtonColor: '#245e32',
  cancelButtonColor: '#647069',
});

export default function Notices({ members, user, noticeThresholds, onRefresh, refreshing = false }) {
  const [printingLevel, setPrintingLevel] = useState(null);
  const [downloadingLevel, setDownloadingLevel] = useState(null);
  const [noticeBarangay, setNoticeBarangay] = useState('All');
  const [readyDownload, setReadyDownload] = useState(null);
  /* { jobId, level } kapag may background batch na ginagawa sa server;
  null kung wala. Iba ito sa downloadingLevel, na para lang sa instant
  na client-side na paraan, yung bago pa umabot sa large-batch threshold. */
  const [batchJob, setBatchJob] = useState(null);
  const batchPollRef = useRef(null);
  const noticeActionInFlight = useRef(false);

  // notice scope covers all eligible members in the selected barangay
  const noticeTargetMembers = useMemo(
    () => (noticeBarangay === 'All' ? members : members.filter((m) => getBarangay(m) === noticeBarangay)),
    [members, noticeBarangay]
  );
  const barangayLabel = noticeBarangay === 'All' ? '' : ` in ${noticeBarangay}`;
  const noticeBusy = printingLevel !== null || downloadingLevel !== null || batchJob !== null;
  const thresholds = noticeThresholds || DEFAULT_NOTICE_THRESHOLDS;
  const peso = (value) => `₱${value.toLocaleString('en-PH')}`;
  const noticeRanges = {
    1: `${peso(thresholds.notice1Min)} – ${peso(thresholds.notice1Max)}`,
    2: `${peso(thresholds.notice2Min)} – ${peso(thresholds.notice2Max)}`,
    3: `Below ${peso(thresholds.notice2Min)}`,
  };

  // count every eligible member in the selected barangay, per batch
  const noticeLevelCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0 };
    noticeTargetMembers.forEach((m) => {
      const level = getNoticeLevel(m.balance, noticeThresholds);
      if (level) counts[level] += 1;
    });
    return counts;
  }, [noticeTargetMembers, noticeThresholds]);

  const handleBulkPrint = async (level) => {
    const count = noticeLevelCounts[level];
    if (count === 0 || noticeBusy || noticeActionInFlight.current) return;
    noticeActionInFlight.current = true;
    setPrintingLevel(level);
    try {
      const confirmation = await noticeAlert.fire({
        icon: 'question',
        title: 'Print member notices?',
        text: `Print ${NOTICE_LEVEL_LABELS[level]} for ${count} member${count === 1 ? '' : 's'}${barangayLabel}? Each member gets two copies on one Letter-size sheet.`,
        showCancelButton: true,
        confirmButtonText: 'Yes, open print window',
        cancelButtonText: 'Cancel',
        focusCancel: true,
        // Open directly inside the confirmation click to preserve popup permission.
        preConfirm: () => {
          try {
            return { printed: printBalanceNoticesBulk(noticeTargetMembers, level, user?.name, noticeThresholds) };
          } catch (error) {
            console.error('Error preparing notices for printing:', error);
            return { error: true };
          }
        },
      });
      if (!confirmation.isConfirmed) return;
      const { printed, error } = confirmation.value;
      if (error) {
        await noticeAlert.fire({ icon: 'error', title: 'Could not prepare notices', text: 'Unable to prepare the notices for printing. Please try again.' });
        return;
      }
      if (printed === 0) {
        await noticeAlert.fire({ icon: 'error', title: 'Print window blocked', text: 'Your browser blocked the print window. Please allow pop-ups for this site and try again.' });
      } else {
        await noticeAlert.fire({ icon: 'success', title: 'Notices ready for printing', text: `Prepared ${printed} ${NOTICE_LEVEL_LABELS[level]} letter${printed === 1 ? '' : 's'}${barangayLabel}. Complete printing in the print window.` });
      }
    } finally {
      noticeActionInFlight.current = false;
      setPrintingLevel(null);
    }
  };

  // Starts the server-side background job for a batch too large to build
  // instantly in the browser. Polling (below) picks up the result.
  const handleBulkDownloadBackground = async (level) => {
    setDownloadingLevel(level);
    try {
      const response = await treasurerAPI.startNoticeBatch(level, noticeBarangay === 'All' ? undefined : noticeBarangay);
      setBatchJob({ jobId: response.jobId, level });
    } catch (error) {
      console.error('Error starting notice batch job:', error);
      await noticeAlert.fire({ icon: 'error', title: 'Could not prepare notices', text: 'Unable to start generating the notices. Please try again.' });
    } finally {
      setDownloadingLevel(null);
    }
  };

  const handleBulkDownload = async (level) => {
    const count = noticeLevelCounts[level];
    if (count === 0 || noticeBusy || noticeActionInFlight.current) return;
    noticeActionInFlight.current = true;
    try {
      const confirmation = await noticeAlert.fire({
        icon: 'question',
        title: 'Download notice PDF?',
        text: `Prepare ${NOTICE_LEVEL_LABELS[level]} for ${count} member${count === 1 ? '' : 's'}${barangayLabel} as one PDF?`,
        showCancelButton: true,
        confirmButtonText: 'Yes, prepare PDF',
        cancelButtonText: 'Cancel',
        focusCancel: true,
      });
      if (!confirmation.isConfirmed) return;
      if (count >= LARGE_BATCH_THRESHOLD) {
        await handleBulkDownloadBackground(level);
        return;
      }

      setDownloadingLevel(level);
      const downloaded = await downloadBalanceNoticesBulkPDF(noticeTargetMembers, level, user?.name, noticeThresholds);
      await noticeAlert.fire({ icon: 'success', title: 'Notice PDF generated', text: `Prepared ${downloaded} ${NOTICE_LEVEL_LABELS[level]} letter${downloaded === 1 ? '' : 's'}${barangayLabel}. Your PDF download has started.` });
    } catch (error) {
      console.error('Error downloading notices PDF:', error);
      await noticeAlert.fire({ icon: 'error', title: 'Could not generate PDF', text: 'Unable to generate the notices PDF. Please try again.' });
    } finally {
      noticeActionInFlight.current = false;
      setDownloadingLevel(null);
    }
  };

  /* Chine-check paulit-ulit yung status ng background job habang tumatakbo,
  dina-download yung tapos na PDF, tapos kinaclear yung job pag ready na
  (o nire-report na nag-fail). */
  useEffect(() => {
    if (!batchJob) return undefined;

    const poll = async () => {
      try {
        const status = await treasurerAPI.getNoticeBatchStatus(batchJob.jobId);
        if (status.status === 'completed') {
          clearInterval(batchPollRef.current);
          /* May auth na ngayon yung PDF, kaya kailangan kunin gamit yung
          naka-login na client (hindi lang basta static URL) at gawing
          blob URL para magamit ng <a download> link. */
          let url;
          try {
            url = await treasurerAPI.downloadNoticeBatchPdf(batchJob.jobId);
          } catch (downloadError) {
            console.error('Error fetching notice batch PDF:', downloadError);
          }
          if (!url) {
            void noticeAlert.fire({ icon: 'error', title: 'PDF unavailable', text: 'The PDF download link is unavailable. Please try again.' });
            setBatchJob(null);
            return;
          }
          setReadyDownload({ url, level: batchJob.level, count: status.totalMembers, barangay: status.barangay });
          void noticeAlert.fire({ icon: 'success', title: 'Notice PDF ready', text: `${status.totalMembers} ${NOTICE_LEVEL_LABELS[batchJob.level]} letters are ready. Select Download ready PDF in the notice panel to open your PDF.` });
          setBatchJob(null);
        } else if (status.status === 'failed') {
          clearInterval(batchPollRef.current);
          void noticeAlert.fire({ icon: 'error', title: 'Could not generate PDF', text: 'Generating the notices failed. Please try again.' });
          setBatchJob(null);
        }
      } catch (error) {
        console.error('Error polling notice batch status:', error);
      }
    };

    poll();
    batchPollRef.current = setInterval(poll, BATCH_POLL_INTERVAL_MS);
    return () => clearInterval(batchPollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchJob?.jobId]);

  /* blob: URL yung readyDownload.url (tignan sa downloadNoticeBatchPdf) -
  i-release pag napalitan na ng bago o pag na-unmount na, para hindi
  humawak ng memory yung PDF kahit tapos na gamitin ng Treasurer. */
  useEffect(() => {
    const url = readyDownload?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [readyDownload?.url]);

  const uniqueBarangays = ['All', ...Array.from(new Set(members.map(getBarangay)))].sort();

  const totalEligibleMembers = Object.values(noticeLevelCounts).reduce((sum, count) => sum + count, 0);
  const noticeDescriptions = {
    1: 'Higher balance, early reminder.',
    2: 'Medium balance, follow up.',
    3: 'Lowest balance, final reminder.',
  };

  return (
    <div className="member-balances member-notices treasurer-notices" aria-busy={refreshing}>
      <p className="tn-eyebrow">Mortuary management <span aria-hidden="true">/</span> <strong>Notices</strong></p>
      <header className="tn-header">
        <div><h1>Notices</h1><p>Prepare member balance letters by barangay and notice level.</p></div>
        <ActionButton variant="outline" className="tn-button" onClick={onRefresh} disabled={refreshing || noticeBusy}><RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />{refreshing ? 'Refreshing...' : 'Refresh'}</ActionButton>
      </header>
      <section aria-labelledby="notice-panel-title" className="tn-workspace">
        <h2 id="notice-panel-title" className="sr-only">Member notices</h2>
        <div className="tn-filter-panel">
        <div className="tn-filter-copy"><h2>Prepare balance notices</h2><p>Select a barangay, then download or print a notice level below.</p></div>
        <div className="tn-filter-controls"><FormField className="tn-filter">
          <label htmlFor="notice-barangay">Barangay for notices</label>
          <Select id="notice-barangay" value={noticeBarangay} onChange={e => setNoticeBarangay(e.target.value)} disabled={noticeBusy} aria-describedby="notice-scope-help">
            {uniqueBarangays.map(b => <option key={b} value={b}>{b === 'All' ? 'All barangays' : b}</option>)}
          </Select>
        </FormField>
        <p id="notice-scope-help" className="tn-scope">Includes all eligible members in {noticeBarangay === 'All' ? 'all barangays' : noticeBarangay}.</p>
        </div>
        <div className="tn-eligible-summary"><strong>{totalEligibleMembers.toLocaleString()}</strong><span>eligible {totalEligibleMembers === 1 ? 'member' : 'members'}</span></div>
        </div>
        <div className="tn-levels">
          <div className="tn-column-head" aria-hidden="true"><span>Notice level</span><span className="tn-range-heading">Current balance</span><span>Members</span><span>Actions</span></div>
          {[1, 2, 3].map(level => {
            const count = noticeLevelCounts[level];
            const preparing = downloadingLevel === level || batchJob?.level === level;
            return (
              <section key={level} role="group" aria-labelledby={'notice-level-' + level} className="tn-notice-row">
                <div className="tn-level"><span className="tn-level-icon"><FileText size={22} aria-hidden="true" /></span><div><h3 id={'notice-level-' + level}>{NOTICE_LEVEL_LABELS[level]}</h3><p>{noticeDescriptions[level]}</p></div></div>
                <div className="tn-range"><span className="tn-cell-label">Current balance</span><strong>{noticeRanges[level]}</strong></div>
                <div className="tn-count"><span className="tn-cell-label">Members</span><strong>{count.toLocaleString()}</strong><p>{count === 0 ? 'No members need this notice.' : `eligible ${count === 1 ? 'member' : 'members'}`}</p></div>
                <div className="tn-actions">
                  <button onClick={() => handleBulkDownload(level)} disabled={count === 0 || noticeBusy} aria-label={'Download ' + NOTICE_LEVEL_LABELS[level] + ' PDF for ' + count + ' members'} className="tn-button tn-primary">
                    {preparing ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <Download size={20} aria-hidden="true" />}
                    {preparing ? 'Preparing...' : 'Download PDF'}
                  </button>
                  <button onClick={() => handleBulkPrint(level)} disabled={count === 0 || noticeBusy} aria-label={'Print ' + NOTICE_LEVEL_LABELS[level] + ' for ' + count + ' members'} className="tn-button tn-print"><Printer size={20} aria-hidden="true" />Print</button>
                </div>
              </section>
            );
          })}
        </div>
        <div role="status" aria-live="polite" aria-atomic="true" className="tn-status">
          {noticeBusy && <p><Loader2 size={18} className="animate-spin" aria-hidden="true" />Preparing {NOTICE_LEVEL_LABELS[batchJob?.level || downloadingLevel || printingLevel]}. {batchJob ? 'Large batches may take a few moments. Keep this page open.' : 'Please wait...'}</p>}
          {!noticeBusy && readyDownload && <p className="sr-only">Your notice PDF is ready. Use the Download ready PDF link.</p>}
        </div>
        {readyDownload && <div className="tn-ready"><p>{NOTICE_LEVEL_LABELS[readyDownload.level]} is ready &middot; {readyDownload.count} members &middot; {readyDownload.barangay || 'All barangays'}</p><a href={readyDownload.url} target="_blank" rel="noopener noreferrer" className="tn-button tn-primary"><Download size={20} aria-hidden="true" />Download ready PDF</a></div>}
      </section>
    </div>
  );
}
