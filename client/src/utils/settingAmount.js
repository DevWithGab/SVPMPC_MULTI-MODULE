// Keep invalid characters visible so validation can explain the error.
export function formatSettingAmountInput(value) {
  const text = String(value);
  if (!/^[\d,]+(?:\.\d{0,2})?$/.test(text)) return text;
  const [whole, decimals] = text.replaceAll(',', '').split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (decimals === undefined ? '' : `.${decimals}`);
}

export function parseSettingAmount(value) {
  const text = String(value).trim();
  if (!/^(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) return NaN;
  const amount = Number(text.replaceAll(',', ''));
  return Number.isFinite(amount) && amount > 0 ? amount : NaN;
}

export function displaySettingAmount(value) {
  if (value === null || value === undefined || value === '') return '—';
  const amount = Number(String(value).replaceAll(',', ''));
  return Number.isFinite(amount) ? amount.toLocaleString('en-PH', { maximumFractionDigits: 2 }) : '—';
}
