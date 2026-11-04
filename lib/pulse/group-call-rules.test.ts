import { describe, expect, it } from "vitest";
import { MAX_PARTICIPANTS, gridColumns, inviteVerdict, joinedCount, shouldEnd } from "./group-call-rules";

const p = (userId: string, status: "ringing" | "joined" | "declined" | "left" | "missed") => ({ userId, status });

describe("shouldEnd", () => {
  it("ends the call when fewer than two people would remain", () => {
    expect(shouldEnd([p("a", "joined"), p("b", "joined")], "a")).toBe(true);
    expect(shouldEnd([p("a", "joined"), p("b", "joined"), p("c", "joined")], "a")).toBe(false);
  });
  it("does not count people who are only being rung", () => {
    expect(shouldEnd([p("a", "joined"), p("b", "joined"), p("c", "ringing")], "a")).toBe(true);
    expect(joinedCount([p("a", "joined"), p("c", "ringing")])).toBe(1);
  });
});

describe("inviteVerdict", () => {
  const base = { me: "a", blocked: false, busy: false };
  it("allows a new person and lets someone who declined or left be asked again", () => {
    expect(inviteVerdict({ ...base, candidate: "x", participants: [p("a", "joined")] }).allow).toBe(true);
    expect(inviteVerdict({ ...base, candidate: "b", participants: [p("a", "joined"), p("b", "declined")] }).allow).toBe(true);
    expect(inviteVerdict({ ...base, candidate: "b", participants: [p("a", "joined"), p("b", "left")] }).allow).toBe(true);
  });
  it("refuses yourself, someone already in or ringing, a blocked or busy person, and a full call", () => {
    expect(inviteVerdict({ ...base, candidate: "a", participants: [] })).toEqual({ allow: false, reason: "self" });
    expect(inviteVerdict({ ...base, candidate: "b", participants: [p("b", "ringing")] })).toEqual({ allow: false, reason: "already_in" });
    expect(inviteVerdict({ ...base, candidate: "x", participants: [p("a", "joined")], blocked: true })).toEqual({ allow: false, reason: "blocked" });
    expect(inviteVerdict({ ...base, candidate: "x", participants: [p("a", "joined")], busy: true })).toEqual({ allow: false, reason: "busy" });
    const full = Array.from({ length: MAX_PARTICIPANTS }, (_, i) => p(`u${i}`, "joined"));
    expect(inviteVerdict({ ...base, candidate: "x", participants: full })).toEqual({ allow: false, reason: "full" });
  });
});

describe("gridColumns", () => {
  it("scales the grid with the number of people", () => {
    expect([1, 2, 4, 5, 9, 10].map(gridColumns)).toEqual([1, 2, 2, 3, 3, 4]);
  });
});
