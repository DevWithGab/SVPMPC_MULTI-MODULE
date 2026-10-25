import React from 'react';
import { Modal as SharedModal } from '../../ui/modal';

export default function Modal({ maxWidth = 'max-w-md', ...props }) {
  return <SharedModal maxWidth={maxWidth} {...props} />;
}