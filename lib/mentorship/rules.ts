import { experienceMonths, type ExperienceRow } from "@/lib/professional/experience";
import { MAX_SLOTS_PER_DAY, dayStarts, lastBookableDay, toZoned, zonedToUtc } from "./grid";

/** Ten years of experience opens mentoring. */
export const MENTOR_MIN_MONTHS = 120;

export interface Eligibility { eligible: boolean; months: number; monthsToGo: number }

export function mentorEligibility(rows: readonly ExperienceRow[], now: Date = new Date()): Eligibility {
  const months = experienceMonths(rows, now);
  return { eligible: months >= MENTOR_MIN_MONTHS, months, monthsToGo: Math.max(0, MENTOR_MIN_MONTHS - months) };
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };
export const AUDIENCES = ["students", "graduates", "professionals"] as const;
export type Audience = (typeof AUDIENCES)[number];
export const AUDIENCE_LABEL: Record<Audience, string> = { students: "Students", graduates: "Recently graduated", professionals: "Working professionals" };
export const SESSION_MINUTES = [30, 45, 60] as const;

const text = (v: unknown) => (typeof v === "string" ? v.replace(/[ \t]+/g, " ").trim() : "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

const validZone = (z: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: z });
    return true;
  } catch {
    return false;
  }
};

export interface MentorProfileValue { headline: string; bio: string; topics: string[]; audience: Audience[]; sessionMinutes: 30 | 45 | 60; timezone: string }

/** What a mentor says about themselves. The limits match the review queue, so a profile that passes here can be reviewed. */
export function validateMentorProfile(input: unknown): Checked<MentorProfileValue> {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const headline = text(i.headline);
  const bio = text(i.bio);
  if (headline.length < 5 || headline.length > 120) return { ok: false, error: "The headline needs 5 to 120 characters." };
  if (bio.length < 20 || bio.length > 800) return { ok: false, error: "The bio needs 20 to 800 characters." };
  const seen = new Set<string>();
  const topics = (Array.isArray(i.topics) ? i.topics : []).map(text).filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()));
  if (topics.length < 1 || topics.length > 8) return { ok: false, error: "Add 1 to 8 topics you can help with." };
  if (topics.some((t) => t.length > 40)) return { ok: false, error: "Keep each topic under 40 characters." };
  const audience = [...new Set(Array.isArray(i.audience) ? i.audience : [])];
  if (audience.length < 1 || audience.some((a) => !(AUDIENCES as readonly unknown[]).includes(a))) return { ok: false, error: "Choose who you want to mentor." };
  if (!(SESSION_MINUTES as readonly unknown[]).includes(i.sessionMinutes)) return { ok: false, error: "Choose a session length." };
  const timezone = text(i.timezone) || "Asia/Kolkata";
  if (timezone.length > 60 || !validZone(timezone)) return { ok: false, error: "That time zone is not valid." };
  return { ok: true, value: { headline, bio, topics, audience: audience as Audience[], sessionMinutes: i.sessionMinutes as 30 | 45 | 60, timezone } };
}

export interface SlotInput { startsAt: string; endsAt: string }

/** Opening slots on one date: the date must be today or later (up to 90 days ahead), each start must be one of the offered times, and none may be in the past. */
export function validateSlots(input: unknown, sessionMinutes: number, timezone: string, now: Date = new Date()): Checked<SlotInput[]> {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const date = typeof i.date === "string" ? i.date : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return { ok: false, error: "Choose a date." };
  if (date < toZoned(now, timezone).key) return { ok: false, error: "Choose today or a later date." };
  if (date > lastBookableDay(now, timezone)) return { ok: false, error: "You can open slots up to 90 days ahead." };
  const starts = Array.isArray(i.starts) ? i.starts : null;
  if (!starts) return { ok: false, error: "Choose the times." };
  const allowed = new Set(dayStarts(sessionMinutes));
  const unique = [...new Set(starts)];
  if (unique.length > MAX_SLOTS_PER_DAY) return { ok: false, error: `Open up to ${MAX_SLOTS_PER_DAY} slots a day.` };
  if (unique.some((m) => !Number.isInteger(m) || !allowed.has(m as number))) return { ok: false, error: "One of those times is not offered." };
  const slots = (unique as number[]).sort((a, b) => a - b).map((m) => {
    const start = zonedToUtc(date, m, timezone);
    return { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + sessionMinutes * 60_000).toISOString() };
  });
  if (slots.some((x) => Date.parse(x.startsAt) < now.getTime() + 30 * 60_000)) return { ok: false, error: "A slot must start at least 30 minutes from now." };
  return { ok: true, value: slots };
}

export interface RequestValue { mentorId: string; slotId: string; topic: string; message: string }

/** A mentee's request for one open slot: which, about what, and a message that says why. */
export function validateRequest(input: unknown): Checked<RequestValue> {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  if (!isUuid(i.mentorId)) return { ok: false, error: "Choose a mentor." };
  if (!isUuid(i.slotId)) return { ok: false, error: "Choose one of the open times." };
  const topic = text(i.topic);
  const message = typeof i.message === "string" ? i.message.trim() : "";
  if (topic.length < 3 || topic.length > 120) return { ok: false, error: "The topic needs 3 to 120 characters." };
  if (message.length < 10 || message.length > 1000) return { ok: false, error: "Tell the mentor what you want help with (10 to 1,000 characters)." };
  return { ok: true, value: { mentorId: i.mentorId, slotId: i.slotId, topic, message } };
}

export interface AcceptValue { startsAt: string; endsAt: string; meetingUrl: string }

/** Scheduling a session: a future time within 90 days and an https meeting link. The length comes from the mentor's setting. */
export function validateAccept(input: unknown, minutes: number, now: Date = new Date()): Checked<AcceptValue> {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const t = typeof i.startsAt === "string" ? Date.parse(i.startsAt) : NaN;
  if (Number.isNaN(t)) return { ok: false, error: "Choose a date and time." };
  if (t < now.getTime() + 15 * 60_000) return { ok: false, error: "Choose a time at least 15 minutes from now." };
  if (t > now.getTime() + 90 * 86_400_000) return { ok: false, error: "Choose a time within the next 90 days." };
  const url = text(i.meetingUrl);
  let meetingUrl = "";
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") throw new Error("scheme");
    meetingUrl = u.toString();
  } catch {
    return { ok: false, error: "Add the meeting link, starting with https://." };
  }
  if (meetingUrl.length > 500) return { ok: false, error: "That link is too long." };
  return { ok: true, value: { startsAt: new Date(t).toISOString(), endsAt: new Date(t + minutes * 60_000).toISOString(), meetingUrl } };
}

/** Approving a request for an open slot only needs the meeting link; the time is the slot's. */
export function validateMeetingUrl(input: unknown): Checked<string> {
  const url = text(input);
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") throw new Error("scheme");
    return u.toString().length <= 500 ? { ok: true, value: u.toString() } : { ok: false, error: "That link is too long." };
  } catch {
    return { ok: false, error: "Add the meeting link, starting with https://." };
  }
}

export function validateRating(input: unknown): Checked<{ stars: number; comment: string | null }> {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  if (!Number.isInteger(i.stars) || (i.stars as number) < 1 || (i.stars as number) > 5) return { ok: false, error: "Choose 1 to 5 stars." };
  const comment = typeof i.comment === "string" ? i.comment.trim() : "";
  if (comment.length > 500) return { ok: false, error: "Keep the comment under 500 characters." };
  return { ok: true, value: { stars: i.stars as number, comment: comment || null } };
}

/** Whether a new session would overlap one already booked. Touching ends do not overlap. */
export const overlaps = (a: { startsAt: string; endsAt: string }, b: { startsAt: string; endsAt: string }): boolean => Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt);

const ics = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** A calendar file for one confirmed session, which opens in Google, Apple and Outlook calendars. */
export function buildIcs(e: { id: string; startsAt: string; endsAt: string; title: string; description: string; url: string }, now: Date = new Date()): string {
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Capabilio AI//Mentorship//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${e.id}@capabilio.online`, `DTSTAMP:${ics(now.toISOString())}`, `DTSTART:${ics(e.startsAt)}`, `DTEND:${ics(e.endsAt)}`,
    `SUMMARY:${esc(e.title)}`, `DESCRIPTION:${esc(e.description)}`, `URL:${e.url}`, "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n") + "\r\n";
}

/** The line on the public profile, such as "6 open slots in the next 30 days (Asia/Kolkata)". Null when there are none. */
export function slotsSummary(openCount: number, timezone: string): string | null {
  return openCount > 0 ? `${openCount} open ${openCount === 1 ? "slot" : "slots"} in the next 30 days (${timezone})` : null;
}
