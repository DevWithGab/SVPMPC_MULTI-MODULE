// Keep server and browser date interpretation in sync; csvDate tests cover both.
function parseCsvDate(value, dateOrder = 'auto') {
  if (!['auto', 'mdy', 'dmy'].includes(dateOrder)) return { error: 'Choose a valid date order: automatic, month/day/year, or day/month/year.' };
  const text = String(value ?? '').trim();
  let year, month, day;
  let match = /^(\d{4})([-/.])(\d{1,2})\2(\d{1,2})$/.exec(text);
  if (match) [, year, , month, day] = match;
  else if ((match = /^(\d{1,2})([-/.])(\d{1,2})\2(\d{4})$/.exec(text))) {
    const a = Number(match[1]), b = Number(match[3]); year = match[4];
    if (dateOrder === 'auto' && a <= 12 && b <= 12 && a !== b) return { error: 'Ambiguous date "' + text + '". Choose Month/Day/Year or Day/Month/Year, then preview again.' };
    const dayFirst = dateOrder === 'dmy' || (dateOrder === 'auto' && a > 12);
    month = dayFirst ? b : a; day = dayFirst ? a : b;
  } else {
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const named = /^(?:(\d{1,2})[ -]+([a-z]+)|([a-z]+)[ -]+(\d{1,2})),?[ -]+(\d{4})$/i.exec(text);
    if (!named) return { error: 'Unsupported date "' + text + '". Use YYYY-MM-DD, a named month (4 Mar 2026), or numeric dates with a four-digit year.' };
    const name = (named[2] || named[3]).toLowerCase();
    month = months.findIndex(m => m === name || m.slice(0, 3) === name) + 1;
    day = named[1] || named[4]; year = named[5];
  }
  const iso = String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  const date = new Date(iso + 'T00:00:00.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso || Number(year) < 1) return { error: 'Invalid date "' + text + '". Check the day, month, and year; this date does not exist.' };
  return { value: iso };
}

export { parseCsvDate };
