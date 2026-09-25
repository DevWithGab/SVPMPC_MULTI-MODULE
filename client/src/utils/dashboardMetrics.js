// Payment dates are calendar dates. Keep their month independent of browser timezone.
export function contributionTrend(contributions, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).formatToParts(now);
  const year = Number(today.find(part => part.type === 'year').value);
  const month = Number(today.find(part => part.type === 'month').value) - 1;
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 5 + index, 1));
    return {
      fullKey: date.toISOString().slice(0, 7),
      month: date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }),
      contributions: 0,
      count: 0,
    };
  });
  for (const contribution of contributions) {
    if (contribution.status && contribution.status !== 'paid') continue;
    const key = String(contribution.payment_date || contribution.paymentDate || '').slice(0, 7);
    const row = months.find(item => item.fullKey === key);
    const amount = Number(contribution.amount);
    if (!row || !Number.isFinite(amount)) continue;
    row.contributions += amount;
    row.count += 1;
  }
  let cumulative = 0;
  return months.map(row => ({ ...row, cumulative: cumulative += row.contributions }));
}

export function memberBalanceCoverage(stats) {
  const active = Number(stats?.activeMembers) || 0;
  if (active <= 0) return null;
  const low = Math.min(active, Math.max(0, Number(stats?.lowBalanceMembers) || 0));
  return Math.round(((active - low) / active) * 100);
}

export function contributionGrowth(rows) {
  if (rows.length < 2) return null;
  const previous = rows[rows.length - 2].contributions;
  return previous > 0 ? ((rows[rows.length - 1].contributions - previous) / previous) * 100 : null;
}
