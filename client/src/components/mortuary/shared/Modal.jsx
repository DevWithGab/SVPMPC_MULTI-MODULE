import React from 'react';
import { Modal as SharedModal } from '../../ui/modal';

// Preserve existing call sites while sharing one visual and accessible dialog.
export default function Modal({ maxWidth = 'max-w-md', ...props }) {
  return <SharedModal maxWidth={maxWidth} closeLabel="Close modal" {...props} />;
}