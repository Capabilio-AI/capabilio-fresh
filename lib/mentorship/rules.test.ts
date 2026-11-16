import { describe, expect, it } from "vitest";
import { MENTOR_MIN_MONTHS, buildIcs, mentorEligibility, overlaps, slotsSummary, validateAccept, validateMeetingUrl, validateMentorProfile, validateRating, validateRequest, validateSlots } from "./rules";

const NOW = new Date("2026-11-16T10:00:00Z");
const ID = "11111111-1111-4111-8111-111111111111";

describe("mentorEligibility", () => {
  it("opens at ten years of experience, counting dated jobs and resume wording together", () => {
    expect(MENTOR_MIN_MONTHS).toBe(120);
    const nine = [{ start_date: "2017-01-01", end_date: null, period_text: null }];
    expect(mentorEligibility(nine, NOW)).toMatchObject({ eligible: false, monthsToGo: 120 - 118 });
    const ten = [{ start_date: null, end_date: null, period_text: "2008 - 2014" }, { start_date: "2015-01-01", end_date: null, period_text: null }];
    expect(mentorEligibility(ten, NOW).eligible).toBe(true);
  });
});

describe("validateMentorProfile", () => {
  const ok = { headline: "Engineering manager, payments", bio: "I have led backend teams for ten years and enjoy coaching.", topics: ["System design", "Career growth", "system design"], audience: ["students", "graduates"], sessionMinutes: 45, timezone: "Asia/Kolkata" };
  it("accepts a complete profile and removes duplicate topics", () => expect(validateMentorProfile(ok)).toMatchObject({ ok: true, value: { topics: ["System design", "Career growth"] } }));
  it("refuses short text, no topics, bad audience, length or time zone", () => {
    expect(validateMentorProfile({ ...ok, headline: "Hi" }).ok).toBe(false);
    expect(validateMentorProfile({ ...ok, bio: "too short" }).ok).toBe(false);
    expect(validateMentorProfile({ ...ok, topics: [] }).ok).toBe(false);
    expect(validateMentorProfile({ ...ok, audience: ["everyone"] }).ok).toBe(false);
    expect(validateMentorProfile({ ...ok, sessionMinutes: 20 }).ok).toBe(false);
    expect(validateMentorProfile({ ...ok, timezone: "Mars/Base" }).ok).toBe(false);
  });
});

describe("validateSlots", () => {
  const TZ = "Asia/Kolkata";
  it("turns chosen times on a date into instants, in order, using the session length", () => {
    const r = validateSlots({ date: "2026-11-20", starts: [1140, 1080] }, 60, TZ, NOW);
    expect(r).toEqual({ ok: true, value: [{ startsAt: "2026-11-20T12:30:00.000Z", endsAt: "2026-11-20T13:30:00.000Z" }, { startsAt: "2026-11-20T13:30:00.000Z", endsAt: "2026-11-20T14:30:00.000Z" }] });
  });
  it("refuses a past date, a date too far ahead, an unoffered time and too many slots", () => {
    expect(validateSlots({ date: "2026-11-15", starts: [1080] }, 60, TZ, NOW).ok).toBe(false);
    expect(validateSlots({ date: "2027-06-01", starts: [1080] }, 60, TZ, NOW).ok).toBe(false);
    expect(validateSlots({ date: "2026-11-20", starts: [1081] }, 60, TZ, NOW).ok).toBe(false);
    expect(validateSlots({ date: "2026-11-20", starts: Array.from({ length: 13 }, (_, n) => 360 + n * 60) }, 60, TZ, NOW).ok).toBe(false);
    expect(validateSlots({ date: "not a date", starts: [] }, 60, TZ, NOW).ok).toBe(false);
  });
  it("refuses a slot that starts within 30 minutes", () => {
    expect(validateSlots({ date: "2026-11-16", starts: [900] }, 60, TZ, NOW).ok).toBe(false); // 15:30 IST is 10:00Z, the moment of NOW
  });
  it("allows opening no slots on a day (which clears the day)", () => expect(validateSlots({ date: "2026-11-20", starts: [] }, 60, TZ, NOW)).toEqual({ ok: true, value: [] }));
});

describe("validateRequest, validateAccept, validateRating", () => {
  it("checks a mentee's request", () => {
    expect(validateRequest({ mentorId: ID, slotId: ID, topic: "Moving into management", message: "I lead a small team and want to talk it through." })).toMatchObject({ ok: true });
    expect(validateRequest({ mentorId: "x", slotId: ID, topic: "abc", message: "long enough message" }).ok).toBe(false);
    expect(validateRequest({ mentorId: ID, slotId: "nope", topic: "abc", message: "long enough message" }).ok).toBe(false);
    expect(validateRequest({ mentorId: ID, slotId: ID, topic: "abc", message: "short" }).ok).toBe(false);
  });
  it("schedules a session in the future with an https link", () => {
    const start = new Date(NOW.getTime() + 86_400_000).toISOString();
    expect(validateAccept({ startsAt: start, meetingUrl: "https://meet.example/abc" }, 45, NOW)).toMatchObject({ ok: true, value: { endsAt: new Date(Date.parse(start) + 45 * 60_000).toISOString() } });
    expect(validateAccept({ startsAt: NOW.toISOString(), meetingUrl: "https://meet.example/abc" }, 30, NOW).ok).toBe(false);
    expect(validateAccept({ startsAt: start, meetingUrl: "http://meet.example/abc" }, 30, NOW).ok).toBe(false);
    expect(validateAccept({ startsAt: new Date(NOW.getTime() + 200 * 86_400_000).toISOString(), meetingUrl: "https://m.example" }, 30, NOW).ok).toBe(false);
  });
  it("rates 1 to 5", () => {
    expect(validateRating({ stars: 5, comment: " great " })).toEqual({ ok: true, value: { stars: 5, comment: "great" } });
    expect(validateRating({ stars: 6 }).ok).toBe(false);
  });
});

describe("overlaps and buildIcs", () => {
  it("treats touching sessions as not overlapping", () => {
    expect(overlaps({ startsAt: "2026-11-20T10:00:00Z", endsAt: "2026-11-20T10:30:00Z" }, { startsAt: "2026-11-20T10:30:00Z", endsAt: "2026-11-20T11:00:00Z" })).toBe(false);
    expect(overlaps({ startsAt: "2026-11-20T10:00:00Z", endsAt: "2026-11-20T10:45:00Z" }, { startsAt: "2026-11-20T10:30:00Z", endsAt: "2026-11-20T11:00:00Z" })).toBe(true);
  });
  it("writes a valid calendar file with escaped text", () => {
    const f = buildIcs({ id: ID, startsAt: "2026-11-20T10:00:00.000Z", endsAt: "2026-11-20T10:45:00.000Z", title: "Mentoring: Priya, Rahul", description: "Line one\nLine two", url: "https://meet.example/x" }, NOW);
    expect(f).toContain("DTSTART:20261120T100000Z");
    expect(f).toContain("SUMMARY:Mentoring: Priya\\, Rahul");
    expect(f).toContain("DESCRIPTION:Line one\\nLine two");
    expect(f.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});

describe("slotsSummary and validateMeetingUrl", () => {
  it("writes one line for the profile and nothing when there are no slots", () => {
    expect(slotsSummary(6, "Asia/Kolkata")).toBe("6 open slots in the next 30 days (Asia/Kolkata)");
    expect(slotsSummary(1, "UTC")).toBe("1 open slot in the next 30 days (UTC)");
    expect(slotsSummary(0, "UTC")).toBeNull();
  });
  it("needs an https meeting link", () => {
    expect(validateMeetingUrl(" https://meet.example/abc ")).toEqual({ ok: true, value: "https://meet.example/abc" });
    expect(validateMeetingUrl("http://meet.example/abc").ok).toBe(false);
    expect(validateMeetingUrl("").ok).toBe(false);
  });
});
