import { describe, expect, it } from "vitest";
import { cursorOf, parseCursor } from "./followers";
import { matchFollowers } from "@/components/org/FollowersList";
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
  it("matches name, goal, headline and class without caring about case", () => {
    expect(matchFollowers(people, "asha").map((p) => p.name)).toEqual(["Asha Rao"]);
    expect(matchFollowers(people, "DATA ANALYST").map((p) => p.name)).toEqual(["Asha Rao"]);
    expect(matchFollowers(people, "faculty").map((p) => p.name)).toEqual(["Ravi Kumar"]);
    expect(matchFollowers(people, "class of 2027").map((p) => p.name)).toEqual(["Asha Rao"]);
  });
  it("finds nothing for text no one has, and survives people with no name", () => {
    expect(matchFollowers(people, "zzz")).toEqual([]);
    expect(matchFollowers(people, "student")).toHaveLength(1);
  });
});
