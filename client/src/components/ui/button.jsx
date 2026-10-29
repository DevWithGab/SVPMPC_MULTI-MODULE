import React from 'react';
import { cn } from '../../lib/utils';
import './design-system.css';
import { Tooltip } from './tooltip';

const buttonVariants = {
  default: 'bg-coop-green text-white hover:bg-coop-darkGreen',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  link: 'text-primary underline-offset-4 hover:underline',
};

const buttonSizes = {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 rounded-md px-3',
  lg: 'h-11 rounded-md px-8',
  icon: 'h-10 w-10',
};

const Button = React.forwardRef(({ 
  className = '', 
  variant = 'default', 
  size = 'default', 
  tooltip,
  ...props 
}, ref) => {
  const button = (
    <button
      ref={ref}
      data-ui-button
      data-ui-size={size}
      className={cn(
        'ui-button inline-flex items-center justify-center border border-transparent rounded-md text-sm font-medium ring-offset-background transition-colors duration-150 focus-visible:outline-none disabled:opacity-50',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    />
  );
  return tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button;
});
Button.displayName = 'Button';

export { Button };
