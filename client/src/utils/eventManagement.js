export const eventStatusLabels = {
  draft: 'Draft', pending_approval: 'Pending approval', upcoming: 'Upcoming',
  active: 'Active', closed: 'Closed', completed: 'Completed', rejected: 'Needs revision', cancelled: 'Cancelled',
};

export function validateEventForm(form) {
  if (!form.name.trim()) return 'Enter an event name.';
  if (!form.location.trim()) return 'Enter the event location.';
  if (!form.date || !form.startTime || !form.endTime) return 'Choose a date, start time, and end time.';
  if (form.endTime <= form.startTime) return 'End time must be later than start time on the same day.';
  if (!Number.isFinite(new Date(`${form.date}T${form.startTime}:00+08:00`).getTime())) return 'Enter a valid event date and time.';
  return '';
}

export async function loadSecretaryEvents(getPage) {
  const records = [];
  let page = 1, totalPages = 1;
  do {
    const response = await getPage({ page, limit: 100 });
    if (!response.success) throw new Error(response.message || 'Unable to load events.');
    const data = response.data;
    records.push(...(Array.isArray(data?.events) ? data.events : Array.isArray(data) ? data : []));
    totalPages = response.pagination?.totalPages || data?.pagination?.totalPages || 1;
    page++;
  } while (page <= totalPages);
  return records;
}
