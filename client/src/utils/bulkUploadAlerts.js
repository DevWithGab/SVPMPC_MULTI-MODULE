import Swal from 'sweetalert2';

export function showBulkUploadAlert(options) {
  return Swal.fire({
    heightAuto: false,
    keydownListenerCapture: true,
    confirmButtonColor: '#245e32',
    confirmButtonText: 'OK',
    ...options,
  });
}

export function showBulkUploadResult({ target, imported = 0, failed = 0, duplicates = 0, successTitle, note = '', retryMessage = 'Review the errors below and preview the same file again.' }) {
  return showBulkUploadAlert({
    target,
    icon: failed ? 'warning' : imported ? 'success' : 'info',
    title: failed ? 'Some entries need retry' : imported ? successTitle : 'No new entries recorded',
    confirmButtonText: failed ? 'Review results' : 'OK',
    text: `${imported} recorded. ${duplicates} duplicates skipped (not recorded).${failed ? ` ${failed} need retry. ${retryMessage}` : ''}${note ? ` ${note}` : ''}`,
  });
}

export function showBulkUploadError(message, target) {
  return showBulkUploadAlert({ target, icon: 'error', title: 'Unable to complete upload', text: message, confirmButtonText: 'Review upload' });
}
