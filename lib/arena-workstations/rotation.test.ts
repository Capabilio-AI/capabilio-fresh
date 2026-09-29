import { describe, expect, it } from "vitest";
import { cryptoRandomIndex, newCycleBag, reconcileRotation, shuffle, type RandomIndex, type RotationSnapshot } from "./rotation";

const AREAS = ["sql", "spreadsheet", "dashboard", "statistics", "data_cleaning"];
const EMPTY: RotationSnapshot = { cycleNumber: 0, remaining: [], served: [], lastServed: null };

/** Mirrors commit_rotation_attempt: pop the head, record it as served. */
function serve(state: RotationSnapshot): { state: RotationSnapshot; area: string } {
  const [area, ...rest] = state.remaining;
  return { area, state: { ...state, remaining: rest, served: [...state.served, area], lastServed: area } };
}

function draw(state: RotationSnapshot, active: string[], rng: RandomIndex = cryptoRandomIndex) {
  return serve(reconcileRotation(state, active, rng).next);
}

function seeded(seed: number): RandomIndex {
  let s = seed;
  return (max) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s % max;
  };
}

describe("rotation", () => {
  it("serves every active area exactly once per cycle", () => {
    let state = EMPTY;
    for (let cycle = 1; cycle <= 50; cycle++) {
      const seen: string[] = [];
      for (let i = 0; i < AREAS.length; i++) {
        const out = draw(state, AREAS);
        state = out.state;
        seen.push(out.area);
      }
      expect(state.cycleNumber).toBe(cycle);
      expect([...seen].sort()).toEqual([...AREAS].sort());
    }
  });

  it("never repeats an area immediately across a cycle boundary", () => {
    let state = EMPTY;
    let previous: string | null = null;
    for (let i = 0; i < AREAS.length * 400; i++) {
      const out = draw(state, AREAS);
      expect(out.area).not.toBe(previous);
      previous = out.area;
      state = out.state;
    }
  });

  it("produces different orders across cycles (shuffled, not fixed)", () => {
    const orders = new Set<string>();
    let state = EMPTY;
    for (let cycle = 0; cycle < 30; cycle++) {
      const seen: string[] = [];
      for (let i = 0; i < AREAS.length; i++) {
        const out = draw(state, AREAS);
        state = out.state;
        seen.push(out.area);
      }
      orders.add(seen.join(","));
    }
    expect(orders.size).toBeGreaterThan(5);
  });

  it("does not consume the head when reconciling (a failed generation retries the same area)", () => {
    const first = reconcileRotation(EMPTY, AREAS, seeded(7)).next;
    const again = reconcileRotation(first, AREAS, seeded(99));
    expect(again.changed).toBe(false);
    expect(again.next.remaining[0]).toBe(first.remaining[0]);
  });

  it("drops a disabled area from the current cycle", () => {
    const state: RotationSnapshot = { cycleNumber: 1, remaining: ["dashboard", "sql", "statistics"], served: ["spreadsheet", "data_cleaning"], lastServed: "data_cleaning" };
    const { next } = reconcileRotation(state, ["sql", "spreadsheet", "statistics", "data_cleaning"], seeded(1));
    expect(next.remaining).toEqual(["sql", "statistics"]);
  });

  it("adds a newly enabled area to the current cycle unless it was already served", () => {
    const state: RotationSnapshot = { cycleNumber: 1, remaining: ["sql"], served: ["spreadsheet"], lastServed: "spreadsheet" };
    const { next } = reconcileRotation(state, ["sql", "spreadsheet", "python"], seeded(3));
    expect([...next.remaining].sort()).toEqual(["python", "sql"]);
  });

  it("starts the next cycle when every remaining area was removed", () => {
    const state: RotationSnapshot = { cycleNumber: 2, remaining: ["python"], served: ["sql", "statistics"], lastServed: "statistics" };
    const { next } = reconcileRotation(state, ["sql", "statistics"], seeded(5));
    expect(next.cycleNumber).toBe(3);
    expect(next.remaining[0]).toBe("sql");
    expect(next.served).toEqual([]);
  });

  it("keeps serving the only area of a one-skill role", () => {
    let state = EMPTY;
    for (let i = 0; i < 5; i++) {
      const out = draw(state, ["sql"]);
      expect(out.area).toBe("sql");
      state = out.state;
    }
    expect(state.cycleNumber).toBe(5);
  });

  it("alternates a two-skill role without back-to-back repeats", () => {
    let state = EMPTY;
    let previous: string | null = null;
    for (let i = 0; i < 40; i++) {
      const out = draw(state, ["sql", "statistics"]);
      expect(out.area).not.toBe(previous);
      previous = out.area;
      state = out.state;
    }
  });

  it("throws when a role has no enabled areas", () => {
    expect(() => reconcileRotation(EMPTY, [], seeded(1))).toThrow(/No enabled skill areas/);
  });

  it("newCycleBag swaps away a first element equal to the previous last", () => {
    const alwaysZero: RandomIndex = () => 0;
    const bag = newCycleBag(["a", "b", "c"], shuffle(["a", "b", "c"], alwaysZero)[0], alwaysZero);
    expect(bag[0]).not.toBe(shuffle(["a", "b", "c"], alwaysZero)[0]);
    expect([...bag].sort()).toEqual(["a", "b", "c"]);
  });
});
