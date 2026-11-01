/** When a college's day starts. Visit dates are plain dates the college typed in India, so "today" is the Indian date, whatever the server clock says. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Pure. Today's date (YYYY-MM-DD) in India. */
export const istToday = (now: Date): string => new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/** Pure. The date after `date` (YYYY-MM-DD). */
export const nextDay = (date: string): string => new Date(Date.parse(`${date}T00:00:00Z`) + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export type ReminderWindow = "tomorrow" | "today";

/**
 * Pure. The date registration for a visit effectively closes: the deadline the college set, else the visit day itself (the apply route keeps
 * registration open until then, so the visit day is the real last chance).
 */
export const closesOn = (visit: { deadline: string | null; drive_date: string | null }): string | null => visit.deadline ?? visit.drive_date;

/** Pure. Which reminder is due: the day before closing, and the day it closes. Anything else (earlier, already closed, no date) is not due. */
export function reminderWindow(closes: string | null, today: string): ReminderWindow | null {
  if (!closes) return null;
  if (closes === today) return "today";
  if (closes === nextDay(today)) return "tomorrow";
  return null;
}

export function reminderCopy(company: string, role: string, window: ReminderWindow): { title: string; body: string } {
  return {
    title: window === "today" ? `Last day to register: ${company}` : `Registration closes tomorrow: ${company}`,
    body: `${role}. Register in Launchpad before it closes.`,
  };
}
