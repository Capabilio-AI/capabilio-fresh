/** Calendar maths for mentor slots. Everything is done in the mentor's own time zone, so a slot means the same wall-clock time all year. */

interface Zoned { key: string; minutes: number; weekday: number }

/** A moment as the calendar date ("2026-11-16") and minutes-from-midnight it falls on in `timezone`. */
export function toZoned(iso: string | Date, timezone: string): Zoned {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d).map((x) => [x.type, x.value]));
  const key = `${p.year}-${p.month}-${p.day}`;
  return { key, minutes: Number(p.hour) * 60 + Number(p.minute), weekday: new Date(`${key}T00:00:00Z`).getUTCDay() };
}

/** How far ahead of UTC the zone is at that instant, in milliseconds. */
function offsetMs(at: number, timezone: string): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)) - Math.floor(at / 1000) * 1000;
}

/** The instant at which the wall clock in `timezone` reads `dateKey` and `minutes` past midnight. */
export function zonedToUtc(dateKey: string, minutes: number, timezone: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  let utc = guess - offsetMs(guess, timezone);
  utc = guess - offsetMs(utc, timezone); // once more, in case the zone changed its offset between the guess and the answer
  return new Date(utc);
}

export interface Cell { key: string; day: number; inMonth: boolean; past: boolean; today: boolean }

/** A month as rows of seven days, Monday first, with the days of the neighbouring months that fill the first and last rows. */
export function monthGrid(year: number, month: number, timezone: string, now: Date): Cell[][] {
  const today = toZoned(now, timezone).key;
  const first = new Date(Date.UTC(year, month - 1, 1));
  const start = first.getTime() - ((first.getUTCDay() + 6) % 7) * 86_400_000;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const rows = Math.ceil((((first.getUTCDay() + 6) % 7) + days) / 7);
  return Array.from({ length: rows }, (_, r) => Array.from({ length: 7 }, (_, c) => {
    const d = new Date(start + (r * 7 + c) * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    return { key, day: d.getUTCDate(), inMonth: d.getUTCMonth() === month - 1, past: key < today, today: key === today };
  }));
}

export const DAY_FROM = 6 * 60;
export const DAY_TO = 22 * 60;

/** Start times offered for one day: from 06:00, one per session length, the last one ending by 22:00. */
export function dayStarts(sessionMinutes: number): number[] {
  const out: number[] = [];
  for (let m = DAY_FROM; m + sessionMinutes <= DAY_TO; m += sessionMinutes) out.push(m);
  return out;
}

/** "18:00" for 1080. */
export const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export const MAX_DAYS_AHEAD = 90;
export const MAX_SLOTS_PER_DAY = 12;

/** The last date, in the mentor's zone, on which slots may be opened. */
export function lastBookableDay(now: Date, timezone: string): string {
  return toZoned(new Date(now.getTime() + MAX_DAYS_AHEAD * 86_400_000), timezone).key;
}
