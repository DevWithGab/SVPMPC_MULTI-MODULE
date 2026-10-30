import { useId } from 'react';
import './CsvDateOrder.css';

const dateOrderHints = {
  auto: 'Detects the date format and asks you to choose when a date is ambiguous.',
  mdy: 'Example: 03/04/2026 means March 4, 2026.',
  dmy: 'Example: 03/04/2026 means April 3, 2026.',
};

export default function CsvDateOrder({ value, onChange, disabled }) {
  const id = useId();
  return <div className="csv-date-order">
    <label htmlFor={id}>Date order in your CSV</label>
    <select id={id} value={value} disabled={disabled} aria-describedby={`${id}-hint ${id}-formats`} onChange={event => onChange(event.target.value)}>
      <option value="auto">Automatic (detect format)</option>
      <option value="mdy">Month / Day / Year</option>
      <option value="dmy">Day / Month / Year</option>
    </select>
    <p id={`${id}-hint`} className="csv-date-order-hint">{dateOrderHints[value] || dateOrderHints.auto}</p>
    <p id={`${id}-formats`} className="csv-date-order-formats">Also accepts YYYY-MM-DD and written dates such as March 4, 2026 or 4 Mar 2026. Numeric dates can use /, - or . separators. Review the YYYY-MM-DD preview before importing.</p>
  </div>;
}
