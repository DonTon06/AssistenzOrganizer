// Calendar dates as ISO strings (YYYY-MM-DD). Deadlines and months are
// calendar days in Europe/Berlin, like in the database (berlin_today()).
// Date-only strings are handled in UTC so no time zone shifts the day.

const TIME_ZONE = "Europe/Berlin";

/** Today in Germany, e.g. "2026-10-27". */
export function berlinToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

function toUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** First day of the month the date is in. */
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** First day of the month `count` months after the date's month. */
export function addMonths(iso: string, count: number): string {
  const d = toUtc(monthStart(iso));
  d.setUTCMonth(d.getUTCMonth() + count);
  return toIso(d);
}

export function addDays(iso: string, count: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + count);
  return toIso(d);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

/** Every day of the month, as ISO strings. */
export function daysOfMonth(month: string): string[] {
  const start = monthStart(month);
  const end = addMonths(start, 1);
  const days: string[] = [];
  for (let d = start; d < end; d = addDays(d, 1)) days.push(d);
  return days;
}

/** Monday = 0 … Sunday = 6. */
export function weekdayIndex(iso: string): number {
  return (toUtc(iso).getUTCDay() + 6) % 7;
}

function format(iso: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", ...options }).format(toUtc(iso));
}

/** "November 2026" */
export function formatMonth(iso: string): string {
  return format(iso, { month: "long", year: "numeric" });
}

/** "November" */
export function formatMonthName(iso: string): string {
  return format(iso, { month: "long" });
}

/** "Sa., 15. November" */
export function formatDayShort(iso: string): string {
  return format(iso, { weekday: "short", day: "numeric", month: "long" });
}

/** "Samstag, 15. November" */
export function formatDayLong(iso: string): string {
  return format(iso, { weekday: "long", day: "numeric", month: "long" });
}

/** "2026-11" for a month in a URL. */
export function monthParam(iso: string): string {
  return iso.slice(0, 7);
}

/** Parses "2026-11" from a URL into "2026-11-01", or null. */
export function parseMonthParam(value: string | undefined): string | null {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? `${value}-01` : null;
}

/** "12 Std." with German decimals: "1,5 Std." */
export function formatHours(hours: number): string {
  return `${hours.toLocaleString("de-DE", { maximumFractionDigits: 2 })} Std.`;
}
