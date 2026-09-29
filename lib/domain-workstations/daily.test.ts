import { describe, expect, it } from "vitest";
import { pickNextTicket, resolveDailyState, type AssignmentRow } from "./daily";

const now = new Date("2026-09-29T10:00:00Z");
const row = (over: Partial<AssignmentRow>): AssignmentRow => ({
  id: "a1",
  challenge_id: "t1",
  assigned_at: "2026-09-01T00:00:00Z",
  completed_at: null,
  next_available_at: null,
  ...over,
});

describe("resolveDailyState", () => {
  it("keeps an untouched ticket open indefinitely", () => {
    const state = resolveDailyState([row({ assigned_at: "2026-01-01T00:00:00Z" })], now);
    expect(state.kind).toBe("active");
  });

  it("is in cooldown until 24h after the last completion", () => {
    const state = resolveDailyState([row({ completed_at: "2026-09-29T08:00:00Z", next_available_at: "2026-09-30T08:00:00Z" })], now);
    expect(state).toEqual({ kind: "cooldown", nextAvailableAt: "2026-09-30T08:00:00Z" });
  });

  it("assigns the next ticket once the cooldown has passed", () => {
    const state = resolveDailyState([row({ completed_at: "2026-09-27T08:00:00Z", next_available_at: "2026-09-28T08:00:00Z" })], now);
    expect(state.kind).toBe("assign_next");
  });

  it("assigns a first ticket when there's no history", () => {
    expect(resolveDailyState([], now).kind).toBe("assign_next");
  });
});

describe("pickNextTicket", () => {
  const tickets = [
    { id: "t3", sequence: 3 },
    { id: "t1", sequence: 1 },
    { id: "t2", sequence: 2 },
  ];

  it("picks the lowest-sequence ticket not yet assigned", () => {
    expect(pickNextTicket(tickets, new Set(["t1"]))?.id).toBe("t2");
  });

  it("returns null when every ticket has been assigned", () => {
    expect(pickNextTicket(tickets, new Set(["t1", "t2", "t3"]))).toBeNull();
  });
});
