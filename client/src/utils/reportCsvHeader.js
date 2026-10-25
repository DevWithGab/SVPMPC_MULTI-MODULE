/* Report CSVs open with the same front matter as their PDF: cooperative
letterhead, program, report title, any emphasised filter (e.g. the barangay or
event the report covers), scope, and when it was generated. A blank row then
separates it from the data table. */

const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
export const csvRows = (rows) => rows.map((row) => row.map(quote).join(',')).join('\r\n');

const generatedLabel = (date) => `${new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: true,
}).format(date)} PHT`;

/**
 * @param {{ title: string, program: string, scope?: string,
 *   highlights?: { label: string, value: string }[],
 *   metadata?: [string, string], generatedAt?: Date }} options
 * @returns {string} CSV lines, ending with the blank separator row.
 */
export function reportCsvHeader({ title, program, scope, highlights = [], metadata, generatedAt = new Date() }) {
  const rows = [
    ['SAINT VINCENT PARISH MULTI-PURPOSE COOPERATIVE'],
    ['Dupax del Sur, Nueva Vizcaya, Philippines'],
    [program],
    [],
    [String(title).toUpperCase()],
    ...highlights.filter((item) => item?.value).map((item) => [String(item.label).toUpperCase(), String(item.value)]),
    ...(scope ? [[scope]] : []),
    ['Generated', generatedLabel(generatedAt)],
    ...(metadata ? [metadata] : []),
    [],
  ];
  return `${csvRows(rows)}\r\n`;
}
