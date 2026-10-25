import React from 'react';
import { cn } from '../../lib/utils';
import './design-system.css';

const Input = React.forwardRef(({ className = '', type = 'text', unstyled = false, ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      data-ui-input
      data-ui-unstyled={unstyled || undefined}
      className={cn(
        'ui-input flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-shadow duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
export const Textarea = React.forwardRef(function Textarea({ className = '', ...props }, ref) {
  return <textarea ref={ref} data-ui-input className={cn('ui-input', className)} {...props} />;
});

export const Select = React.forwardRef(function Select({ className = '', ...props }, ref) {
  return <select ref={ref} data-ui-input className={cn('ui-input', className)} {...props} />;
});