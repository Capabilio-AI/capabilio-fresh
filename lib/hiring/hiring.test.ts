import { describe, expect, it } from "vitest";
import { interviewToLines, isAccepting, jobPostingJsonLd, linesToList, paragraphs, parseInterviewLines, postedLabel, safeJsonLd, slugify } from "./format";
import { ApplySchema, OpeningInputSchema } from "./schema";
import { toColumns, toOpening } from "./openings";
import type { Opening } from "./types";

const OPENING: Opening = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "founding-engineer",
  title: "Founding Engineer",
  team: "Engineering",
  location: "Hyderabad",
  workMode: "hybrid",
  employmentType: "full_time",
  summary: "Build the evidence engine.",
  about: "You will own the engine that turns work into proof.",
  responsibilities: ["Ship"],
  requirements: [],
  niceToHave: [],
  proofBrief: null,
  dayToDay: null,
  firstMonths: [],
  interview: [],
  compensation: null,
  status: "open",
  publishedAt: "2026-11-01T00:00:00.000Z",
  closesOn: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};

describe("slugify", () => {
  it("makes a link name from a title", () => {
    expect(slugify("Founding Engineer (Backend)!")).toBe("founding-engineer-backend");
    expect(slugify("  Café  Ops ")).toBe("cafe-ops");
  });
});

describe("postedLabel", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  it("reads naturally at each scale", () => {
    expect(postedLabel("2026-11-10T01:00:00Z", now)).toBe("Posted today");
    expect(postedLabel("2026-11-09T01:00:00Z", now)).toBe("Posted yesterday");
    expect(postedLabel("2026-11-05T12:00:00Z", now)).toBe("Posted 5 days ago");
    expect(postedLabel("2026-10-13T12:00:00Z", now)).toBe("Posted 4 weeks ago");
    expect(postedLabel(null, now)).toBeNull();
  });
});

describe("isAccepting", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  it("needs open status and an unpassed closing date (the closing day itself still counts)", () => {
    expect(isAccepting({ status: "open", closesOn: null }, now)).toBe(true);
    expect(isAccepting({ status: "open", closesOn: "2026-11-10" }, now)).toBe(true);
    expect(isAccepting({ status: "open", closesOn: "2026-11-09" }, now)).toBe(false);
    expect(isAccepting({ status: "closed", closesOn: null }, now)).toBe(false);
    expect(isAccepting({ status: "draft", closesOn: null }, now)).toBe(false);
    expect(isAccepting({ status: "soon", closesOn: null }, now)).toBe(false);
  });
});

describe("text helpers", () => {
  it("splits paragraphs on blank lines and lists on lines, dropping bullets", () => {
    expect(paragraphs("One.\n\n\nTwo.\nStill two.")).toEqual(["One.", "Two.\nStill two."]);
    expect(linesToList("- a\n* b\n\n  c  ")).toEqual(["a", "b", "c"]);
  });
  it("keeps a title from closing the JSON-LD script tag", () => {
    expect(safeJsonLd({ t: "</script><b>" })).not.toContain("</script>");
  });
});

describe("jobPostingJsonLd", () => {
  it("describes an on-site role with a place, and a remote role without one", () => {
    const hybrid = jobPostingJsonLd(OPENING, "https://x.test");
    expect(hybrid.employmentType).toBe("FULL_TIME");
    expect(hybrid.url).toBe("https://x.test/careers/founding-engineer");
    expect(hybrid.jobLocation).toBeDefined();
    const remote = jobPostingJsonLd({ ...OPENING, workMode: "remote", employmentType: "internship" }, "https://x.test");
    expect(remote.jobLocationType).toBe("TELECOMMUTE");
    expect(remote.jobLocation).toBeUndefined();
    expect(remote.employmentType).toBe("INTERN");
  });
});

describe("ApplySchema", () => {
  const ok = { openingId: null, fullName: "Asha Rao", email: "asha@example.com", workUrl: "https://github.com/asha/thing", proofNote: "I built a scheduler that cut our queue time and I would test it earlier next time." };
  it("accepts a complete application", () => expect(ApplySchema.safeParse(ok).success).toBe(true));
  it("rejects a work link that is not http(s), a short note, and a filled honeypot", () => {
    expect(ApplySchema.safeParse({ ...ok, workUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(ApplySchema.safeParse({ ...ok, proofNote: "too short" }).success).toBe(false);
    expect(ApplySchema.safeParse({ ...ok, website: "spam" }).success).toBe(false);
  });
});

describe("opening mapping", () => {
  it("round-trips the columns the admin form sends", () => {
    const parsed = OpeningInputSchema.parse({
      title: "Founding Engineer",
      team: "Engineering",
      location: "Hyderabad",
      workMode: "hybrid",
      employmentType: "full_time",
      summary: "Build the evidence engine.",
      about: "You will own the engine that turns work into proof.",
      responsibilities: ["Ship"],
      requirements: [],
      niceToHave: [],
      proofBrief: null,
      dayToDay: null,
      firstMonths: [],
      interview: [],
      compensation: null,
      status: "draft",
      closesOn: null,
    });
    const cols = toColumns(parsed);
    expect(cols.work_mode).toBe("hybrid");
    expect(cols.slug).toBeUndefined();
    expect(toColumns({ status: "closed" })).toEqual({ status: "closed" });
    const row = { ...cols, id: OPENING.id, slug: OPENING.slug, published_at: null, created_at: OPENING.createdAt, updated_at: OPENING.updatedAt } as unknown as Parameters<typeof toOpening>[0];
    expect(toOpening(row).workMode).toBe("hybrid");
  });
});

describe("interview steps", () => {
  it("round-trips Title: details lines, and keeps colons inside the details", () => {
    const steps = parseInterviewLines("Send proof: a link to work\nTalk: time: 30 minutes\nDecide");
    expect(steps).toEqual([
      { title: "Send proof", body: "a link to work" },
      { title: "Talk", body: "time: 30 minutes" },
      { title: "Decide", body: "" },
    ]);
    expect(parseInterviewLines(interviewToLines(steps))).toEqual(steps);
  });
});
