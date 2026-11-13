/** Shared rainfall date rules. Stored dates are ISO; user-facing dates are DD/MM/YYYY. */
export function rainfallToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit' }).format(now);
}
export function validRainfallDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === date;
}
export function rainfallDateError(date: string, today = rainfallToday()) {
  if (!validRainfallDate(date)) return 'Enter a valid calendar date.';
  if (date > today) return 'Rainfall readings cannot be dated in the future (India time).';
  return '';
}
export function rainfallDateLabel(date: string) {
  return validRainfallDate(date) ? date.split('-').reverse().join('/') : date;
}
/** Excel date cells are read as Date values; text dates use day/month/year explicitly. */
export function parseRainfallImportDate(raw: unknown) {
  let date = '';
  if (raw instanceof Date && Number.isFinite(raw.getTime())) {
    date = `${raw.getFullYear()}-${String(raw.getMonth()+1).padStart(2,'0')}-${String(raw.getDate()).padStart(2,'0')}`;
  } else if (typeof raw === 'string') {
    const text = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) date = text;
    else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
      const [day,month,year] = text.split('/');
      date = `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
    }
  }
  return validRainfallDate(date) ? date : '';
}
export function rainfallReadingSummary<T extends {date: string}>(rows: T[], today = rainfallToday()) {
  const current = rows.filter(row => validRainfallDate(row.date) && row.date <= today);
  const future = rows.filter(row => validRainfallDate(row.date) && row.date > today);
  const latest = current.reduce((latest,row) => row.date > latest ? row.date : latest, '');
  return { current, future, latest };
}
