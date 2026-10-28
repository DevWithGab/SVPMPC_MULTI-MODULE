import React, { useId } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import './design-system.css';

export function PageHeader({ title, eyebrow, description, actions, children, className = '', separateBreadcrumb = false, ...props }) {
  let nodes = React.Children.toArray(children);
  let breadcrumb = null;
  const isBreadcrumb = node => React.isValidElement(node) && node.type === 'p' && /eyebrow|breadcrumb/.test(node.props.className || '');
  if (separateBreadcrumb) {
    nodes = nodes.flatMap(node => {
      if (isBreadcrumb(node)) { breadcrumb = node; return []; }
      if (React.isValidElement(node) && node.type === 'div') {
        const nested = React.Children.toArray(node.props.children);
        const found = nested.find(isBreadcrumb);
        if (found) {
          breadcrumb = found;
          return [React.cloneElement(node, {}, nested.filter(child => child !== found))];
        }
      }
      return [node];
    });
    if (breadcrumb) breadcrumb = React.cloneElement(breadcrumb, { className: cn(breadcrumb.props.className, 'attendance-page-breadcrumb') });
  }
  const directTitle = nodes.some(node => React.isValidElement(node) && node.type === 'h1');
  const isTitleNode = node => React.isValidElement(node) && (node.type === 'h1' || node.type === 'p');
  const content = directTitle ? <><div>{nodes.filter(isTitleNode)}</div>{nodes.filter(node => !isTitleNode(node))}</> : nodes.length ? nodes : null;
  return <>{breadcrumb}<header className={cn('ui-page-header', className)} data-ui-page-header {...props}>
    {content || <><div>{eyebrow && <p className="ui-page-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="ui-page-description">{description}</p>}</div>{actions && <div className="ui-page-actions">{actions}</div>}</>}
  </header></>;
}

export const Panel = React.forwardRef(function Panel({ as: elementType = 'section', className = '', ...props }, ref) {
  const Element = elementType;
  return <Element ref={ref} className={cn('ui-panel', className)} data-ui-panel {...props} />;
});

export const PanelHeader = React.forwardRef(function PanelHeader({ as: elementType = 'div', className = '', children, ...props }, ref) {
  const Element = elementType;
  const nodes = React.Children.toArray(children);
  const hasHeading = nodes.some(node => React.isValidElement(node) && ['h2', 'h3'].includes(node.type));
  const hasDescription = nodes.some(node => React.isValidElement(node) && node.type === 'p');
  const isTitleNode = node => React.isValidElement(node) && ['h2', 'h3', 'p'].includes(node.type);
  return <Element ref={ref} className={cn('ui-panel-heading', className)} data-ui-panel-heading {...props}>
    {hasHeading && hasDescription ? <><div>{nodes.filter(isTitleNode)}</div>{nodes.filter(node => !isTitleNode(node))}</> : children}
  </Element>;
});

export function ModalActions({ as: elementType = 'div', className = '', ...props }) {
  const Element = elementType;
  return <Element className={cn('ui-modal-actions', className)} data-ui-modal-actions {...props} />;
}

export function DialogHeader({ title, titleId, description, descriptionId, eyebrow, onClose, busy = false, closeLabel = 'Close dialog' }) {
  return <div className="ui-dialog-header"><div>{eyebrow && <p>{eyebrow}</p>}<h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>
    <button type="button" className="ui-dialog-close" onClick={onClose} disabled={busy} aria-label={closeLabel}><X size={18} aria-hidden="true" /></button>
  </div>;
}

// Existing fields can keep their children; matching a single label and control
// also repairs missing label associations without changing their change handlers.
export function FormField({ id, label, hint, error, required, children, className = '', ...props }) {
  const generatedId = useId();
  const items = React.Children.toArray(children);
  const controls = items.filter(child => React.isValidElement(child) && (
    ['input', 'select', 'textarea'].includes(child.type) || ['Input', 'Textarea', 'Select'].includes(child.type?.displayName || child.type?.name || child.type?.render?.name)
  ));
  const control = controls.length === 1 ? controls[0] : null;
  const existingLabel = items.find(child => React.isValidElement(child) && child.type === 'label');
  const controlId = control?.props.id || id || existingLabel?.props.htmlFor || `field-${generatedId}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [control?.props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined;
  return <div className={cn('ui-field', className)} {...props}>
    {label && <label htmlFor={controlId}>{label}{required && <span className="ui-field-required"> *</span>}</label>}
    {items.map(child => {
      if (child === existingLabel && control) return React.cloneElement(child, { htmlFor: controlId });
      if (child !== control) return child;
      return React.cloneElement(child, { id: controlId, 'aria-describedby': describedBy,
        ...(error ? { 'aria-invalid': true } : {}), ...(required === undefined ? {} : { required }) });
    })}
    {hint && <p id={hintId} className="ui-field-hint">{hint}</p>}
    {error && <p id={errorId} className="ui-field-error" role="alert">{error}</p>}
  </div>;
}
export function SearchField({ as: elementType = 'span', className = '', ...props }) {
  const Element = elementType;
  return <Element className={cn('ui-search-control', className)} data-ui-search {...props} />;
}