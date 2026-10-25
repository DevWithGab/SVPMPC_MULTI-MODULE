import React from 'react';
import { Button as SharedButton } from '../../ui/button';

const variants = { primary: 'default', secondary: 'secondary', ghost: 'ghost', danger: 'destructive', outline: 'outline' };
const sizes = { md: 'default', sm: 'sm', lg: 'lg' };

export default function Button({ children, variant = 'primary', size = 'md', disabled = false, loading = false, icon: Icon, type = 'button', ...props }) {
  return <SharedButton type={type} variant={variants[variant] || variant} size={sizes[size] || size}
    disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {Icon && <Icon size={16} aria-hidden="true" />}{loading ? 'Loading...' : children}
  </SharedButton>;
}