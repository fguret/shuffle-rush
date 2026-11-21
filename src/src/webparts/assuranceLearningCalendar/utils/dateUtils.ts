export const MONTH_NAMES: string[] = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTH_SHORT: string[] = MONTH_NAMES.map((m) => m.substring(0, 3).toUpperCase());

export const WEEKDAY_NAMES: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/** Parses YYYY-MM-DD as a local calendar date. */
export function parseIsoDate(iso: string): Date {
  const parts: number[] = iso.split('-').map((p) => parseInt(p, 10));
  return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
}

export function toIsoDate(date: Date): string {
  const m: string = String(date.getMonth() + 1).padStart(2, '0');
  const d: string = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** "22-01-2026" (Excel export format) to "2026-01-22". */
export function ddmmyyyyToIso(value: string): string {
  const parts: string[] = value.trim().split(/[-/.]/);
  if (parts.length !== 3) {
    return '';
  }
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

/** "2026-01-22" to "22-01-2026" (Excel export format). */
export function isoToDdmmyyyy(iso: string): string {
  const p: string[] = iso.split('-');
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : iso;
}

/** "January 22, 2026" */
export function formatLongDate(iso: string): string {
  if (!iso) {
    return '';
  }
  const d: Date = parseIsoDate(iso);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "1/22/2026" */
export function formatShortDate(iso: string): string {
  if (!iso) {
    return '';
  }
  const d: Date = parseIsoDate(iso);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** Monday of the week that contains the date. */
export function startOfWeekMonday(date: Date): Date {
  const offset: number = (date.getDay() + 6) % 7;
  return addDays(date, -offset);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** Whole calendar days from a to b (b - a). */
export function dayDiff(aIso: string, bIso: string): number {
  const a: Date = parseIsoDate(aIso);
  const b: Date = parseIsoDate(bIso);
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
    Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
}

/** "01:00 PM" to minutes after midnight, for sorting. */
export function timeToMinutes(time: string): number {
  const match: RegExpMatchArray | null = /(\d{1,2}):(\d{2})\s*([AP]M)?/i.exec(time);
  if (!match) {
    return 0;
  }
  let hours: number = parseInt(match[1], 10) % 12;
  if (match[3] && match[3].toUpperCase() === 'PM') {
    hours += 12;
  }
  return hours * 60 + parseInt(match[2], 10);
}
