const manilaDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
export const recordTime = record => record.scanTime || record.timestamp || record.createdAt;
export const eventTime = event => event.eventDate || event.date;
export const validTimestamp = value => value && Number.isFinite(new Date(value).getTime());

export async function loadDashboardRecords(fetchPage, key) {
  const records = [];
  let page = 1, totalPages = 1;
  do {
    const response = await fetchPage({ page, limit: 100 });
    if (response?.success === false) throw new Error('Unable to load complete records.');
    const list = Array.isArray(response) ? response
      : response?.[key] || (Array.isArray(response?.data) ? response.data : response?.data?.[key]);
    if (!Array.isArray(list)) throw new Error('Unable to load complete records.');
    records.push(...list);
    totalPages = response?.pagination?.totalPages || response?.data?.pagination?.totalPages || 1;
    page++;
  } while (page <= totalPages);
  return records;
}

export function summarizeDashboard(events, records, now = new Date()) {
  const today = manilaDay.format(now);
  const counts = events.reduce((result, event) => {
    const status = event.status || 'unknown';
    result[status] = (result[status] || 0) + 1;
    return result;
  }, {});
  const agenda = events.filter(event => ['active', 'upcoming'].includes(event.status))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      const aTime = validTimestamp(eventTime(a)) ? new Date(eventTime(a)).getTime() : Infinity;
      const bTime = validTimestamp(eventTime(b)) ? new Date(eventTime(b)).getTime() : Infinity;
      return aTime - bTime;
    });
  const latest = [...records].sort((a, b) =>
    (validTimestamp(recordTime(b)) ? new Date(recordTime(b)).getTime() : 0) -
    (validTimestamp(recordTime(a)) ? new Date(recordTime(a)).getTime() : 0));
  return {
    counts, agenda, latest,
    todayAttendance: records.filter(record => validTimestamp(recordTime(record)) && manilaDay.format(new Date(recordTime(record))) === today).length,
  };
}
