import { describe, expect, it } from "vitest";
import { cursorOf, parseCursor } from "./followers";
import { followedOn, matchFollowers } from "@/components/org/FollowersList";
import type { Follower } from "./followers";

const UUID = "3f2b8c1e-5a6d-4e7f-9b0a-1c2d3e4f5a6b";

describe("parseCursor", () => {
  it("round-trips the cursor a page produces", () => {
    const row = { followed_at: "2026-10-24T08:15:30.123456+00:00", user_id: UUID };
    expect(parseCursor(cursorOf(row))).toEqual({ at: row.followed_at, userId: UUID });
  });
  it("accepts a Z timestamp and an upper-case id, and normalises the id", () => {
    expect(parseCursor(`2026-10-24T08:15:30Z|${UUID.toUpperCase()}`)).toEqual({ at: "2026-10-24T08:15:30Z", userId: UUID });
  });
  it("refuses anything else, so nothing but a time and an id can reach a query", () => {
    for (const bad of [null, undefined, "", "abc", `2026-10-24|${UUID}`, `2026-10-24T08:15:30Z|not-a-uuid`, `2026-10-24T08:15:30Z|${UUID},user_id.gt.0`, `x),or(user_id.neq.0|${UUID}`, `2026-10-24T08:15:30Z|${UUID}|extra`]) {
      expect(parseCursor(bad as string), String(bad)).toBeNull();
    }
  });
});

describe("matchFollowers", () => {
  const person = (over: Partial<Follower>): Follower => ({ id: Math.random().toString(), name: null, avatarUrl: null, headline: null, role: "student", following: false, isMe: false, fromThisCollege: false, followedAt: "2026-10-24T00:00:00Z", ...over });
  const people = [
    person({ name: "Asha Rao", tagline: "Aspiring Data Analyst", detail: "CSE · Class of 2027" }),
    person({ name: "Ravi Kumar", headline: "Faculty @ Amrita Sai Institute", detail: "ECE" }),
    person({ name: null, headline: "Student" }),
  ];
  it("returns everyone for an empty search", () => {
    expect(matchFollowers(people, "").length).toBe(3);
    expect(matchFollowers(people, "   ").length).toBe(3);
  });
  it("finds people by name, without caring about case or spaces around it", () => {
    expect(matchFollowers(people, "asha").map((p) => p.name)).toEqual(["Asha Rao"]);
    expect(matchFollowers(people, "  KUMAR ").map((p) => p.name)).toEqual(["Ravi Kumar"]);
    expect(matchFollowers(people, "a").map((p) => p.name)).toEqual(["Asha Rao", "Ravi Kumar"]);
  });
  it("looks at names only, because the list shows names only: goals, roles and classes are not searched", () => {
    expect(matchFollowers(people, "data analyst")).toEqual([]);
    expect(matchFollowers(people, "faculty")).toEqual([]);
    expect(matchFollowers(people, "class of 2027")).toEqual([]);
  });
  it("survives people with no name", () => {
    expect(matchFollowers(people, "zzz")).toEqual([]);
    expect(matchFollowers([person({ name: null })], "x")).toEqual([]);
  });
});

describe("followedOn", () => {
  it("writes the date the way Indian readers expect, in Indian time", () => {
    expect(followedOn("2026-10-20T10:05:00+00:00")).toBe("20 Oct 2026");
    // 19:00 UTC on the 20th is already the 21st in India
    expect(followedOn("2026-10-20T19:00:00Z")).toBe("21 Oct 2026");
  });
  it("gives nothing for a date it cannot read, rather than 'Invalid Date'", () => {
    expect(followedOn("not a date")).toBeNull();
    expect(followedOn("")).toBeNull();
  });
});

import { readFileSync } from "node:fs";

describe("the followers dialog stays above the page", () => {
  // The college header is its own stacking layer (relative z-10) and the tab bar after it has the same level, so a dialog drawn inside the header was
  // painted under the tabs. It must be drawn at the top level of the college theme (not where the button is, and not in <body>: the colours live on .org-theme).
  const source = readFileSync("components/org/FollowersList.tsx", "utf8");
  it("is rendered through a portal into the nearest college theme element", () => {
    expect(source).toMatch(/createPortal\(<FollowersDialog/);
    expect(source).toMatch(/closest\("\.org-theme"\)/);
  });
});
