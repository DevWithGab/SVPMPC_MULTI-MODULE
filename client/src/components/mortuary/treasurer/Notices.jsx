import React, { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { Printer, Download, Loader2, FileText, RefreshCw } from 'lucide-react';
import { getBarangay } from '../../../utils/helpers';
import { getNoticeLevel, NOTICE_LEVEL_LABELS, printBalanceNoticesBulk, downloadBalanceNoticesBulkPDF, DEFAULT_NOTICE_THRESHOLDS } from '../../../utils/balanceNotice';
import { treasurerAPI } from '../../../services/api';
import './MemberBalances.css';

// Above this, generating the batch PDF is handed off to a background server
// job instead of built instantly in the browser — native text rendering is
// fast enough that smaller batches still feel instant client-side (see
// balanceNotice.js), but a very large run (hundreds to 1,000+) shouldn't tie
// up the Treasurer's tab or risk a request timeout regardless of how fast
// the per-page work is.
const LARGE_BATCH_THRESHOLD = 100;
const BATCH_POLL_INTERVAL_MS = 4000;
const noticeAlert = Swal.mixin({
  confirmButtonColor: '#245e32',
  cancelButtonColor: '#647069',
});

export default function Notices({ members, user, noticeThresholds, showToast, onRefresh, refreshing = false }) {
  const [printingLevel, setPrintingLevel] = useState(null);
  const [downloadingLevel, setDownloadingLevel] = useState(null);
  const [noticeBarangay, setNoticeBarangay] = useState('All');
  const [readyDownload, setReadyDownload] = useState(null);
  // { jobId, level } while a background batch is generating server-side;
  // null otherwise. Distinct from downloadingLevel, which is only for the
  // instant client-side path below the large-batch threshold.
  const [batchJob, setBatchJob] = useState(null);
  const batchPollRef = useRef(null);
  const downloadInFlight = useRef(false);

  // Notice scope covers all eligible members in the selected barangay.
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

  // Count every eligible member in the selected barangay for each batch.
  const noticeLevelCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0 };
    noticeTargetMembers.forEach((m) => {
      const level = getNoticeLevel(m.balance, noticeThresholds);
      if (level) counts[level] += 1;
    });
    return counts;
  }, [noticeTargetMembers, noticeThresholds]);

  const handleBulkPrint = (level) => {
    const count = noticeLevelCounts[level];
    if (count === 0 || noticeBusy) return;
    if (!window.confirm(`Print ${NOTICE_LEVEL_LABELS[level]} for ${count} member${count === 1 ? '' : 's'}${barangayLabel}? Each will print as a separate page in one job.`)) {
      return;
    }
    setPrintingLevel(level);
    try {
      const printed = printBalanceNoticesBulk(noticeTargetMembers, level, user?.name, noticeThresholds);
      if (printed === 0) {
        showToast?.('Your browser blocked the print window. Please allow pop-ups and try again.', 'error');
      } else {
        showToast?.(`Queued ${printed} ${NOTICE_LEVEL_LABELS[level]} letter${printed === 1 ? '' : 's'}${barangayLabel} for printing.`, 'success');
      }
    } finally {
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
    if (count === 0 || noticeBusy || downloadInFlight.current) return;
    downloadInFlight.current = true;
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
      downloadInFlight.current = false;
      setDownloadingLevel(null);
    }
  };

  // Polls the background job's status while one is running, downloading the
  // finished PDF and clearing the job once it's ready (or reporting failure).
  useEffect(() => {
    if (!batchJob) return undefined;

    const poll = async () => {
      try {
        const status = await treasurerAPI.getNoticeBatchStatus(batchJob.jobId);
        if (status.status === 'completed') {
          clearInterval(batchPollRef.current);
          // The PDF is behind auth now, so it has to be fetched through the
          // authenticated client (not just resolved to a static URL) and
          // turned into a blob URL the <a download> link can point to.
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

  // readyDownload.url is a blob: URL (see downloadNoticeBatchPdf) — release it
  // once replaced by a newer one or on unmount, so the PDF's memory isn't
  // held onto after the Treasurer is done with it.
  useEffect(() => {
    const url = readyDownload?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [readyDownload?.url]);

  const uniqueBarangays = ['All', ...Array.from(new Set(members.map(getBarangay)))].sort();

  return (
    <div className="member-balances member-notices">
      <header className="mb-header">
        <div><p className="mb-eyebrow">Mortuary management / Notices</p><h1>Notices</h1><p className="mb-description">Prepare and download member balance notices by level and barangay.</p></div>
        <button className="mb-button" onClick={onRefresh} disabled={refreshing || noticeBusy}><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />{refreshing ? 'Refreshing...' : 'Refresh'}</button>
      </header>
      <section aria-labelledby="notice-panel-title" className="mb-panel mb-notices">
        <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-md bg-emerald-50 text-emerald-700"><FileText className="w-5 h-5" aria-hidden="true" /></div>
            <div>
              <h3 id="notice-panel-title" className="text-base font-semibold text-slate-900">Member notices</h3>
              <p className="text-sm text-slate-500 mt-1">Download one PDF per notice level, or print a letter for each member.</p>
            </div>
          </div>
          <div className="w-full lg:w-56 shrink-0">
            <label htmlFor="notice-barangay" className="block text-xs font-semibold text-slate-600 mb-1.5">Barangay for notices</label>
            <select id="notice-barangay" value={noticeBarangay} onChange={e => setNoticeBarangay(e.target.value)} disabled={noticeBusy} aria-describedby="notice-scope-help" className="w-full h-11 px-3 text-sm rounded-md border border-slate-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60">
              {uniqueBarangays.map(b => <option key={b} value={b}>{b === 'All' ? 'All barangays' : b}</option>)}
            </select>
          </div>
        </div>
        <div className="p-5">
          <p id="notice-scope-help" className="text-xs text-slate-500 mb-4">Includes all eligible members in {noticeBarangay === 'All' ? 'all barangays' : noticeBarangay}.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[1, 2, 3].map(level => {
              const count = noticeLevelCounts[level];
              const preparing = downloadingLevel === level || batchJob?.level === level;
              const tone = level === 3 ? 'bg-red-50 text-red-700 border-red-100' : level === 2 ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-amber-50 text-amber-700 border-amber-100';
              return (
                <div key={level} role="group" aria-labelledby={'notice-level-' + level} className="rounded-md border border-slate-200 p-4 flex flex-col">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 id={'notice-level-' + level} className={'rounded-md border px-2 py-1 text-xs font-bold ' + tone}>{NOTICE_LEVEL_LABELS[level]}</h4>
                    <span className="text-xs font-medium text-slate-500 tabular-nums">{count} {count === 1 ? 'member' : 'members'}</span>
                  </div>
                  <p className="text-lg font-semibold text-slate-900 mt-4 tabular-nums">{noticeRanges[level]}</p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">{count === 0 ? 'No members need this notice.' : 'Current member balance'}</p>
                  <div className="flex flex-wrap gap-2 mt-auto">
                    <button onClick={() => handleBulkDownload(level)} disabled={count === 0 || noticeBusy} aria-label={'Download ' + NOTICE_LEVEL_LABELS[level] + ' PDF for ' + count + ' members'} className="flex-1 inline-flex items-center justify-center gap-2 min-h-11 px-3 rounded-md bg-[#245e32] text-white text-sm font-semibold hover:bg-[#163a1e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
                      {preparing ? <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" /> : <Download className="w-4 h-4 shrink-0" aria-hidden="true" />}
                      {preparing ? 'Preparing...' : 'Download PDF'}
                    </button>
                    <button onClick={() => handleBulkPrint(level)} disabled={count === 0 || noticeBusy} aria-label={'Print ' + NOTICE_LEVEL_LABELS[level] + ' for ' + count + ' members'} className="inline-flex items-center justify-center gap-2 min-h-11 px-3 rounded-md border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
                      <Printer className="w-4 h-4" aria-hidden="true" /> Print
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div role="status" aria-live="polite" aria-atomic="true">
            {noticeBusy && <p className="flex items-center gap-2 mt-4 text-sm text-emerald-700"><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />Preparing {NOTICE_LEVEL_LABELS[batchJob?.level || downloadingLevel || printingLevel]}. {batchJob ? 'Large batches may take a few moments. Keep this page open.' : 'Please wait...'}</p>}
            {!noticeBusy && readyDownload && <p className="sr-only">Your notice PDF is ready. Use the Download ready PDF link.</p>}
          </div>
          {readyDownload && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm text-emerald-900">{NOTICE_LEVEL_LABELS[readyDownload.level]} is ready &middot; {readyDownload.count} members &middot; {readyDownload.barangay || 'All barangays'}</p>
              <a href={readyDownload.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 min-h-11 px-3 rounded-md bg-[#245e32] text-white text-sm font-semibold hover:bg-[#163a1e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 shrink-0"><Download className="w-4 h-4" aria-hidden="true" />Download ready PDF</a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
