import { untyped } from "@/lib/org/db";
import { createServiceClient } from "@/lib/supabase/service";
import { getMyMentorProfile, saveMentorApplication, setAccepting, type MyMentorProfile } from "@/lib/pulse/mentors";
import { loadPeople } from "@/lib/pulse/people";
import { toStage } from "@/lib/stage/stage";
import { experienceMonths } from "@/lib/professional/experience";
import { slotsSummary, mentorEligibility, overlaps, validateAccept, validateMeetingUrl, type Audience, type Eligibility, type MentorProfileValue, type RequestValue, type SlotInput } from "./rules";
import { toZoned, zonedToUtc } from "./grid";
import { notify } from "./notify";

const service = () => createServiceClient();
const db = () => untyped(service());

export type RequestStatus = "requested" | "accepted" | "declined" | "cancelled" | "completed";
export type MenteePath = "student" | "graduate" | "professional";
export interface MenteeCard { id: string; name: string; avatarUrl: string | null; path: MenteePath }
export interface RequestView {
  id: string;
  mentee: MenteeCard;
  topic: string;
  message: string;
  preferred: string | null;
  status: RequestStatus;
  startsAt: string | null;
  endsAt: string | null;
  meetingUrl: string | null;
  declineNote: string | null;
  createdAt: string;
  rating: { stars: number; comment: string | null } | null;
}
export interface SlotView { id: string; startsAt: string; endsAt: string; status: "open" | "requested" | "booked"; requestId: string | null; label: string | null }
export interface MentorState {
  eligibility: Eligibility;
  profile: MyMentorProfile | null;
  extras: { audience: Audience[]; sessionMinutes: 30 | 45 | 60; timezone: string } | null;
  /** Slots from now on, each with the request waiting on it or the session booked in it. */
  slots: SlotView[];
  requests: RequestView[];
  rating: { average: number | null; count: number; recent: { stars: number; comment: string | null; createdAt: string }[] };
}

interface RequestRow {
  id: string; mentor_id: string; mentee_id: string; mentee_path: MenteePath; topic: string; message: string; preferred: string | null; status: RequestStatus;
  starts_at: string | null; ends_at: string | null; meeting_url: string | null; decline_note: string | null; created_at: string; slot_id: string | null;
}
const REQUEST_COLUMNS = "id, mentor_id, mentee_id, mentee_path, topic, message, preferred, status, starts_at, ends_at, meeting_url, decline_note, created_at, slot_id";

async function proExperience(userId: string): Promise<{ rows: { start_date: string | null; end_date: string | null; period_text: string | null }[]; employer: string | null; title: string | null }> {
  const [jobs, profile] = await Promise.all([
    db().from("pro_employment").select("start_date, end_date, period_text").eq("user_id", userId),
    db().from("pro_profiles").select("employer_name, job_title").eq("user_id", userId).maybeSingle(),
  ]);
  const p = profile.data as { employer_name: string | null; job_title: string | null } | null;
  return { rows: (jobs.data ?? []) as { start_date: string | null; end_date: string | null; period_text: string | null }[], employer: p?.employer_name ?? null, title: p?.job_title ?? null };
}

async function withRatings(rows: RequestRow[]): Promise<Map<string, { stars: number; comment: string | null }>> {
  if (!rows.length) return new Map();
  const { data } = await db().from("mentor_ratings").select("request_id, stars, comment").in("request_id", rows.map((r) => r.id));
  return new Map(((data ?? []) as { request_id: string; stars: number; comment: string | null }[]).map((r) => [r.request_id, { stars: r.stars, comment: r.comment }]));
}

export async function getMentorState(userId: string): Promise<MentorState> {
  const exp = await proExperience(userId);
  const [profile, extras, slotRows, requests, ratings] = await Promise.all([
    getMyMentorProfile(service(), userId),
    db().from("pro_mentor_profiles").select("audience, session_minutes, timezone").eq("user_id", userId).maybeSingle(),
    db().from("pro_mentor_slots").select("id, starts_at, ends_at, status").eq("mentor_id", userId).gt("ends_at", new Date().toISOString()).order("starts_at").limit(400),
    db().from("mentor_requests").select(REQUEST_COLUMNS).eq("mentor_id", userId).order("created_at", { ascending: false }).limit(100),
    db().from("mentor_ratings").select("stars, comment, created_at").eq("mentor_id", userId).order("created_at", { ascending: false }).limit(200),
  ]);
  const reqRows = (requests.data ?? []) as RequestRow[];
  const [people, rated] = await Promise.all([loadPeople(service(), reqRows.map((r) => r.mentee_id)), withRatings(reqRows)]);
  const x = extras.data as { audience: Audience[]; session_minutes: 30 | 45 | 60; timezone: string } | null;
  const rs = (ratings.data ?? []) as { stars: number; comment: string | null; created_at: string }[];
  return {
    eligibility: mentorEligibility(exp.rows),
    profile,
    extras: x ? { audience: x.audience, sessionMinutes: x.session_minutes, timezone: x.timezone } : null,
    slots: ((slotRows.data ?? []) as { id: string; starts_at: string; ends_at: string; status: SlotView["status"] }[]).map((sl) => {
      const req = reqRows.find((r) => r.status !== "declined" && r.status !== "cancelled" && r.slot_id === sl.id);
      return { id: sl.id, startsAt: sl.starts_at, endsAt: sl.ends_at, status: sl.status, requestId: req?.id ?? null, label: req ? `${req.topic} with ${people.get(req.mentee_id)?.name?.trim() || "a member"}` : null };
    }),
    requests: reqRows.map((r) => ({
      id: r.id,
      mentee: { id: r.mentee_id, name: people.get(r.mentee_id)?.name?.trim() || "A member", avatarUrl: people.get(r.mentee_id)?.avatarUrl ?? null, path: r.mentee_path },
      topic: r.topic, message: r.message, preferred: r.preferred, status: r.status, startsAt: r.starts_at, endsAt: r.ends_at, meetingUrl: r.meeting_url, declineNote: r.decline_note, createdAt: r.created_at, rating: rated.get(r.id) ?? null,
    })),
    rating: { average: rs.length ? Math.round((rs.reduce((n, r) => n + r.stars, 0) / rs.length) * 10) / 10 : null, count: rs.length, recent: rs.slice(0, 5).map((r) => ({ stars: r.stars, comment: r.comment, createdAt: r.created_at })) },
  };
}

export type Result = { ok: true } | { ok: false; status: number; message: string };
const fail = (status: number, message: string): Result => ({ ok: false, status, message });

/**
 * Opt in, or edit. Needs ten years of experience. The public profile goes through the same review the existing Mentors tab uses, so students
 * and graduates only ever see approved professionals.
 */
export async function saveMentorProfile(userId: string, v: MentorProfileValue): Promise<Result> {
  const exp = await proExperience(userId);
  const el = mentorEligibility(exp.rows);
  if (!el.eligible) return fail(403, "Mentoring opens at ten years of experience.");
  const summary = await availabilityLine(userId, v.timezone);
  const saved = await saveMentorApplication(service(), userId, { headline: v.headline, bio: v.bio, expertise: v.topics, company: exp.employer ?? undefined, roleTitle: exp.title ?? undefined, yearsExperience: Math.min(60, Math.floor(experienceMonths(exp.rows) / 12)), availability: summary ?? undefined });
  if (!saved.ok) return fail(saved.status, saved.message);
  const { error } = await db().from("pro_mentor_profiles").upsert({ user_id: userId, audience: v.audience, session_minutes: v.sessionMinutes, timezone: v.timezone, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  return error ? fail(500, "Your profile was saved but your preferences were not. Try again.") : { ok: true };
}

async function availabilityLine(userId: string, timezone: string): Promise<string | null> {
  const now = new Date();
  const { count } = await db().from("pro_mentor_slots").select("id", { count: "exact", head: true }).eq("mentor_id", userId).eq("status", "open").gt("starts_at", now.toISOString()).lt("starts_at", new Date(now.getTime() + 30 * 86_400_000).toISOString());
  return slotsSummary(count ?? 0, timezone);
}

async function refreshAvailability(userId: string, timezone: string): Promise<void> {
  await db().from("mentor_profiles").update({ availability: await availabilityLine(userId, timezone), updated_at: new Date().toISOString() }).eq("user_id", userId);
}

/** The mentor's own session length and time zone, which the slot rules need. Null before they have set up a profile. */
export async function mentorSettings(userId: string): Promise<{ sessionMinutes: number; timezone: string } | null> {
  const { data } = await db().from("pro_mentor_profiles").select("session_minutes, timezone").eq("user_id", userId).maybeSingle();
  const x = data as { session_minutes: number; timezone: string } | null;
  return x ? { sessionMinutes: x.session_minutes, timezone: x.timezone } : null;
}

/**
 * Sets the open slots for one date: the slots listed are open, any other open slot that day is removed. A slot a mentee has asked for, or
 * that is booked, is never touched here; the mentor answers or cancels that request first.
 */
export async function setDaySlots(userId: string, dateKey: string, wanted: SlotInput[], timezone: string): Promise<Result> {
  const dayStart = zonedToUtc(dateKey, 0, timezone);
  const next = new Date(`${dateKey}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const dayEnd = zonedToUtc(next.toISOString().slice(0, 10), 0, timezone);
  const { data, error } = await db().from("pro_mentor_slots").select("id, starts_at, ends_at, status").eq("mentor_id", userId).gte("starts_at", dayStart.toISOString()).lt("starts_at", dayEnd.toISOString());
  if (error) return fail(500, "That did not save. Try again.");
  const have = (data ?? []) as { id: string; starts_at: string; ends_at: string; status: string }[];
  const taken = have.filter((h) => h.status !== "open");
  const want = new Set(wanted.map((w) => w.startsAt));
  const clash = wanted.find((w) => taken.some((t) => overlaps({ startsAt: w.startsAt, endsAt: w.endsAt }, { startsAt: t.starts_at, endsAt: t.ends_at })));
  if (clash) return fail(409, "One of those times overlaps a session that is waiting for your answer or already booked.");
  const toRemove = have.filter((h) => h.status === "open" && !want.has(h.starts_at)).map((h) => h.id);
  const existing = new Set(have.map((h) => new Date(h.starts_at).toISOString()));
  const toAdd = wanted.filter((w) => !existing.has(new Date(w.startsAt).toISOString()));
  if (toRemove.length) {
    const del = await db().from("pro_mentor_slots").delete().in("id", toRemove).eq("mentor_id", userId).eq("status", "open");
    if (del.error) return fail(500, "That did not save. Try again.");
  }
  if (toAdd.length) {
    const ins = await db().from("pro_mentor_slots").insert(toAdd.map((w) => ({ mentor_id: userId, starts_at: w.startsAt, ends_at: w.endsAt })));
    if (ins.error) return fail(500, "That did not save. Try again.");
  }
  await refreshAvailability(userId, timezone);
  return { ok: true };
}

export interface OpenSlot { id: string; startsAt: string; endsAt: string }

/** Open slots a mentee can ask for: the next 60 days, only for an approved mentor who is taking requests, and only for a mentee in their audience. */
export async function openSlotsFor(menteeId: string, mentorId: string): Promise<{ slots: OpenSlot[]; timezone: string; sessionMinutes: number } | null> {
  if (menteeId === mentorId) return null;
  const [mentor, extras, me] = await Promise.all([
    db().from("mentor_profiles").select("status, is_accepting").eq("user_id", mentorId).maybeSingle(),
    db().from("pro_mentor_profiles").select("audience, session_minutes, timezone").eq("user_id", mentorId).maybeSingle(),
    db().from("profiles").select("student_status").eq("id", menteeId).maybeSingle(),
  ]);
  const m = mentor.data as { status: string; is_accepting: boolean } | null;
  const x = extras.data as { audience: Audience[]; session_minutes: number; timezone: string } | null;
  if (!m || m.status !== "approved" || !m.is_accepting || !x) return null;
  const path = toStage((me.data as { student_status: string } | null)?.student_status) as MenteePath;
  if (!x.audience.includes(AUDIENCE_OF[path])) return null;
  const now = new Date();
  const { data } = await db().from("pro_mentor_slots").select("id, starts_at, ends_at").eq("mentor_id", mentorId).eq("status", "open").gt("starts_at", new Date(now.getTime() + 30 * 60_000).toISOString()).lt("starts_at", new Date(now.getTime() + 60 * 86_400_000).toISOString()).order("starts_at").limit(150);
  return { slots: ((data ?? []) as { id: string; starts_at: string; ends_at: string }[]).map((r) => ({ id: r.id, startsAt: r.starts_at, endsAt: r.ends_at })), timezone: x.timezone, sessionMinutes: x.session_minutes };
}

export const setMentorAccepting = (userId: string, accepting: boolean) => setAccepting(service(), userId, accepting);

const AUDIENCE_OF: Record<MenteePath, Audience> = { student: "students", graduate: "graduates", professional: "professionals" };
const MAX_OPEN_REQUESTS = 3;

const PATH_LABEL: Record<MenteePath, string> = { student: "student", graduate: "recently graduated", professional: "professional" };
const when = (iso: string, timezone: string) => new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(iso));

/** Puts a slot back on offer, if it has not started yet. */
async function releaseSlot(slotId: string | null): Promise<void> {
  if (slotId) await db().from("pro_mentor_slots").update({ status: "open" }).eq("id", slotId).gt("starts_at", new Date().toISOString());
}

/** A mentee (student, graduate or professional) asks for one open slot. The slot is held for them until the mentor answers. */
export async function createRequest(menteeId: string, v: RequestValue): Promise<Result> {
  if (v.mentorId === menteeId) return fail(400, "You cannot request a session with yourself.");
  const [me, mentor, extras, open] = await Promise.all([
    db().from("profiles").select("student_status").eq("id", menteeId).maybeSingle(),
    db().from("mentor_profiles").select("status, is_accepting").eq("user_id", v.mentorId).maybeSingle(),
    db().from("pro_mentor_profiles").select("audience, timezone").eq("user_id", v.mentorId).maybeSingle(),
    db().from("mentor_requests").select("id", { count: "exact", head: true }).eq("mentee_id", menteeId).in("status", ["requested", "accepted"]),
  ]);
  const m = mentor.data as { status: string; is_accepting: boolean } | null;
  if (!m || m.status !== "approved") return fail(404, "That mentor is not available.");
  if (!m.is_accepting) return fail(409, "This mentor is not taking new requests right now.");
  const path = toStage((me.data as { student_status: string } | null)?.student_status) as MenteePath;
  const x = extras.data as { audience: Audience[]; timezone: string } | null;
  if (!(x?.audience ?? ["students", "graduates"]).includes(AUDIENCE_OF[path])) return fail(403, "This mentor is not mentoring your group at the moment.");
  if ((open.count ?? 0) >= MAX_OPEN_REQUESTS) return fail(409, `You have ${MAX_OPEN_REQUESTS} open requests. Wait for an answer or cancel one first.`);

  // Hold the slot first, and only if it is still open, so two mentees cannot take the same time.
  const held = await db().from("pro_mentor_slots").update({ status: "requested" }).eq("id", v.slotId).eq("mentor_id", v.mentorId).eq("status", "open").gt("starts_at", new Date(Date.now() + 30 * 60_000).toISOString()).select("id, starts_at, ends_at");
  const slot = ((held.data ?? []) as { id: string; starts_at: string; ends_at: string }[])[0];
  if (held.error) return fail(500, "Could not send your request. Try again.");
  if (!slot) return fail(409, "That time is no longer open. Choose another.");

  const { error } = await db().from("mentor_requests").insert({ mentor_id: v.mentorId, mentee_id: menteeId, mentee_path: path, topic: v.topic, message: v.message, slot_id: slot.id, starts_at: slot.starts_at, ends_at: slot.ends_at });
  if (error) {
    await releaseSlot(slot.id);
    return error.code === "23505" ? fail(409, "You already have an open request with this mentor.") : fail(500, "Could not send your request. Try again.");
  }
  const who = (await loadPeople(service(), [menteeId])).get(menteeId)?.name?.trim() || "A member";
  await notify(v.mentorId, "mentor_request", "New session request", `${who} (${PATH_LABEL[path]}) asked for ${when(slot.starts_at, x?.timezone ?? "Asia/Kolkata")}: ${v.topic}`, "/professional/mentor");
  return { ok: true };
}

export type MentorAction = { action: "accept"; meetingUrl: unknown; startsAt?: unknown } | { action: "decline"; note: string | null } | { action: "complete" } | { action: "cancel" };

/** The mentor's answer to a request, moving it only along the allowed steps. Approving a slot request needs only a meeting link. */
export async function respond(mentorId: string, requestId: string, a: MentorAction): Promise<Result> {
  const { data } = await db().from("mentor_requests").select("id, status, starts_at, ends_at, slot_id").eq("id", requestId).eq("mentor_id", mentorId).maybeSingle();
  const r = data as { id: string; status: RequestStatus; starts_at: string | null; ends_at: string | null; slot_id: string | null } | null;
  if (!r) return fail(404, "That request was not found.");
  const now = new Date().toISOString();
  const apply = async (patch: Record<string, unknown>, from: RequestStatus[]): Promise<Result> => {
    if (!from.includes(r.status)) return fail(409, "That request has already moved on.");
    const { data: done, error } = await db().from("mentor_requests").update({ ...patch, updated_at: now }).eq("id", requestId).eq("mentor_id", mentorId).in("status", from).select("id");
    if (error) return fail(500, "That did not save. Try again.");
    return (done ?? []).length ? { ok: true } : fail(409, "That request has already moved on.");
  };
  if (a.action === "accept") {
    if (r.slot_id && r.starts_at && r.ends_at) {
      const url = validateMeetingUrl(a.meetingUrl);
      if (!url.ok) return fail(400, url.error);
      if (Date.parse(r.starts_at) < Date.now()) return fail(409, "That time has already passed. Decline the request instead.");
      const out = await apply({ status: "accepted", meeting_url: url.value, decline_note: null }, ["requested"]);
      if (out.ok) await db().from("pro_mentor_slots").update({ status: "booked" }).eq("id", r.slot_id).eq("mentor_id", mentorId);
      return out;
    }
    const settings = await mentorSettings(mentorId);
    const v = validateAccept({ startsAt: a.startsAt, meetingUrl: a.meetingUrl }, settings?.sessionMinutes ?? 30);
    if (!v.ok) return fail(400, v.error);
    const { data: booked } = await db().from("mentor_requests").select("starts_at, ends_at").eq("mentor_id", mentorId).eq("status", "accepted").gt("ends_at", now);
    if (((booked ?? []) as { starts_at: string; ends_at: string }[]).some((b) => overlaps({ startsAt: v.value.startsAt, endsAt: v.value.endsAt }, { startsAt: b.starts_at, endsAt: b.ends_at }))) return fail(409, "You already have a session at that time.");
    return apply({ status: "accepted", starts_at: v.value.startsAt, ends_at: v.value.endsAt, meeting_url: v.value.meetingUrl, decline_note: null }, ["requested"]);
  }
  if (a.action === "decline") {
    const out = await apply({ status: "declined", decline_note: a.note }, ["requested"]);
    if (out.ok) await releaseSlot(r.slot_id);
    return out;
  }
  if (a.action === "cancel") {
    const out = await apply({ status: "cancelled" }, ["requested", "accepted"]);
    if (out.ok) await releaseSlot(r.slot_id);
    return out;
  }
  if (!r.starts_at || Date.parse(r.starts_at) > Date.now()) return fail(409, "You can mark a session complete once it has started.");
  return apply({ status: "completed" }, ["accepted"]);
}

/** A mentee's own requests, newest first, with the mentor's name and any rating they gave. */
export async function listMyRequests(menteeId: string): Promise<(Omit<RequestView, "mentee"> & { mentor: { id: string; name: string } })[]> {
  const { data } = await db().from("mentor_requests").select(REQUEST_COLUMNS).eq("mentee_id", menteeId).order("created_at", { ascending: false }).limit(50);
  const rows = (data ?? []) as RequestRow[];
  const [people, rated] = await Promise.all([loadPeople(service(), rows.map((r) => r.mentor_id)), withRatings(rows)]);
  return rows.map((r) => ({ id: r.id, mentor: { id: r.mentor_id, name: people.get(r.mentor_id)?.name?.trim() || "A mentor" }, topic: r.topic, message: r.message, preferred: r.preferred, status: r.status, startsAt: r.starts_at, endsAt: r.ends_at, meetingUrl: r.meeting_url, declineNote: r.decline_note, createdAt: r.created_at, rating: rated.get(r.id) ?? null }));
}

export async function cancelMyRequest(menteeId: string, requestId: string): Promise<Result> {
  const { data, error } = await db().from("mentor_requests").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", requestId).eq("mentee_id", menteeId).in("status", ["requested", "accepted"]).select("mentor_id, slot_id, topic, starts_at");
  if (error) return fail(500, "That did not save. Try again.");
  const r = ((data ?? []) as { mentor_id: string; slot_id: string | null; topic: string; starts_at: string | null }[])[0];
  if (!r) return fail(404, "That request cannot be cancelled.");
  await releaseSlot(r.slot_id);
  const who = (await loadPeople(service(), [menteeId])).get(menteeId)?.name?.trim() || "A member";
  await notify(r.mentor_id, "mentor_cancelled", "A session request was cancelled", `${who} cancelled: ${r.topic}`, "/professional/mentor");
  return { ok: true };
}

/** The mentee rates a completed session, once. */
export async function rateRequest(menteeId: string, requestId: string, r: { stars: number; comment: string | null }): Promise<Result> {
  const { data } = await db().from("mentor_requests").select("mentor_id, status").eq("id", requestId).eq("mentee_id", menteeId).maybeSingle();
  const row = data as { mentor_id: string; status: RequestStatus } | null;
  if (!row) return fail(404, "That session was not found.");
  if (row.status !== "completed") return fail(409, "You can rate a session once it is completed.");
  const { error } = await db().from("mentor_ratings").insert({ request_id: requestId, mentor_id: row.mentor_id, mentee_id: menteeId, stars: r.stars, comment: r.comment });
  if (error?.code === "23505") return fail(409, "You have already rated this session.");
  return error ? fail(500, "That did not save. Try again.") : { ok: true };
}

/** The mentor's confirmed session as a calendar entry; null unless the caller is the mentor or the mentee. */
export async function sessionForIcs(userId: string, requestId: string): Promise<{ id: string; startsAt: string; endsAt: string; topic: string; meetingUrl: string; mentorName: string; menteeName: string } | null> {
  const { data } = await db().from("mentor_requests").select(REQUEST_COLUMNS).eq("id", requestId).eq("status", "accepted").maybeSingle();
  const r = data as RequestRow | null;
  if (!r || !r.starts_at || !r.ends_at || !r.meeting_url || (r.mentor_id !== userId && r.mentee_id !== userId)) return null;
  const people = await loadPeople(service(), [r.mentor_id, r.mentee_id]);
  return { id: r.id, startsAt: r.starts_at, endsAt: r.ends_at, topic: r.topic, meetingUrl: r.meeting_url, mentorName: people.get(r.mentor_id)?.name ?? "Mentor", menteeName: people.get(r.mentee_id)?.name ?? "Mentee" };
}

export interface MentorCardPro { id: string; name: string; avatarUrl: string | null; headline: string; bio: string; expertise: string[]; company: string | null; roleTitle: string | null; yearsExperience: number | null; availability: string | null }

/** Approved mentors who are taking requests from working professionals, for a professional to browse. */
export async function listMentorsForProfessional(viewerId: string, q?: string): Promise<MentorCardPro[]> {
  const [{ data: profiles }, { data: extras }] = await Promise.all([
    db().from("mentor_profiles").select("user_id, headline, bio, expertise, company, role_title, years_experience, availability").eq("status", "approved").eq("is_accepting", true).neq("user_id", viewerId).order("updated_at", { ascending: false }).limit(120),
    db().from("pro_mentor_profiles").select("user_id, audience"),
  ]);
  const open = new Set(((extras ?? []) as { user_id: string; audience: Audience[] }[]).filter((x) => x.audience.includes("professionals")).map((x) => x.user_id));
  const rows = ((profiles ?? []) as { user_id: string; headline: string; bio: string; expertise: string[]; company: string | null; role_title: string | null; years_experience: number | null; availability: string | null }[]).filter((r) => open.has(r.user_id));
  const people = await loadPeople(service(), rows.map((r) => r.user_id));
  const term = q?.trim().toLowerCase();
  return rows.flatMap((r) => {
    const p = people.get(r.user_id);
    if (!p) return [];
    if (term && ![p.name, r.headline, r.company, ...r.expertise].join(" ").toLowerCase().includes(term)) return [];
    return [{ id: r.user_id, name: p.name?.trim() || "A mentor", avatarUrl: p.avatarUrl, headline: r.headline, bio: r.bio, expertise: r.expertise, company: r.company, roleTitle: r.role_title, yearsExperience: r.years_experience, availability: r.availability }];
  });
}
