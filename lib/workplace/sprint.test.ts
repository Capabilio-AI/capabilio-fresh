import { describe, expect, it } from "vitest";
import { buildBoard, pickStory, SPRINT_SLOTS, sprintWeekStart, type BoardAssignment } from "./sprint";

describe("sprintWeekStart", () => {
  it("is the Monday of the week in India time", () => {
    expect(sprintWeekStart(new Date("2026-10-15T08:00:00Z"))).toBe("2026-10-12"); // Thursday
    expect(sprintWeekStart(new Date("2026-10-12T00:30:00+05:30"))).toBe("2026-10-12"); // Monday just after midnight IST
    expect(sprintWeekStart(new Date("2026-10-18T20:00:00Z"))).toBe("2026-10-19"); // Sunday 20:00 UTC is already Monday in IST
    expect(sprintWeekStart(new Date("2026-10-18T10:00:00Z"))).toBe("2026-10-12");
  });
});

describe("pickStory", () => {
  const stories = [{ title: "A", blurb: "a" }, { title: "B", blurb: "b" }, { title: "C", blurb: "c" }];
  it("is stable for a user and week, and can differ across weeks", () => {
    expect(pickStory(stories, "u1", "2026-10-12")).toEqual(pickStory(stories, "u1", "2026-10-12"));
    const titles = new Set(["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"].map((w) => pickStory(stories, "u1", w).title));
    expect(titles.size).toBeGreaterThan(1);
  });
});

const done = (i: number): BoardAssignment => ({ id: `a${i}`, title: `Ticket ${i}`, areaName: "SQL", difficulty: "easy", kind: "update", completedAt: "2026-10-12T10:00:00Z", nextAvailableAt: "2026-10-13T10:00:00Z" });
const open = (i: number): BoardAssignment => ({ id: `a${i}`, title: `Ticket ${i}`, areaName: "Statistics", difficulty: "medium", kind: null, completedAt: null, nextAvailableAt: null });
const NOW = new Date("2026-10-13T12:00:00Z");

describe("buildBoard", () => {
  it("shows an empty sprint as one ticket ready to start and the rest locked", () => {
    const b = buildBoard({ assignments: [], now: NOW });
    expect(b.slots).toHaveLength(SPRINT_SLOTS);
    expect(b.slots.map((s) => s.state)).toEqual(["next", "locked", "locked", "locked", "locked"]);
    expect(b.completed).toBe(0);
  });

  it("marks finished tickets done, the open one active, and the following one locked", () => {
    const b = buildBoard({ assignments: [done(1), done(2), open(3)], now: NOW });
    expect(b.slots.map((s) => s.state)).toEqual(["done", "done", "active", "locked", "locked"]);
    expect(b.completed).toBe(2);
    expect(b.slots[2].title).toBe("Ticket 3");
  });

  it("shows the next ticket as cooling down until the 24 h gap has passed, then as ready", () => {
    const early = buildBoard({ assignments: [done(1)], now: new Date("2026-10-12T20:00:00Z") });
    expect(early.slots[1]).toMatchObject({ state: "cooling", availableAt: "2026-10-13T10:00:00Z" });
    expect(buildBoard({ assignments: [done(1)], now: NOW }).slots[1].state).toBe("next");
  });

  it("keeps extra tickets beyond the sprint as bonus work without breaking the board", () => {
    const b = buildBoard({ assignments: [1, 2, 3, 4, 5, 6].map(done), now: NOW });
    expect(b.slots.every((s) => s.state === "done")).toBe(true);
    expect(b.completed).toBe(6);
    expect(b.bonus).toBe(1);
  });
});
