import Swal from 'sweetalert2';

export function showClaimAlert(options) {
  return Swal.fire({
    confirmButtonColor: '#245e32',
    cancelButtonColor: '#647069',
    // Native modal dialogs make content outside them inert, regardless of z-index.
    target: document.querySelector('dialog.mc-dialog[open]') || document.body,
    keydownListenerCapture: true,
    heightAuto: false,
    ...options,
  });
}
