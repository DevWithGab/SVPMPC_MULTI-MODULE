// Publish results only after every page succeeds, so totals never use a partial list.
export async function loadAllPages(fetchPage) {
  const records = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await fetchPage(page);
    if (!response?.success || !Array.isArray(response.data)) throw new Error('Unable to load complete records');
    records.push(...response.data);
    totalPages = response.pagination?.totalPages || 1;
    page += 1;
  } while (page <= totalPages);
  return records;
}
