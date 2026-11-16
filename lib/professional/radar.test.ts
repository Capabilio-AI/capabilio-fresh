import { describe, expect, it } from "vitest";
import { clip, polygonPoints, radarSkills, reach, spokePoint } from "./radar";
import type { ProSkill } from "./skills";

const sk = (name: string, level: ProSkill["level"], jobIds: string[] = []): ProSkill => ({ id: name, name, category: "Engineering", level, source: "added", jobIds });

describe("reach and radarSkills", () => {
  const jobs = [{ id: "a", start_date: "2018-01-01", end_date: "2022-01-01", period_text: null }];
  const NOW = new Date("2026-11-16T00:00:00Z");
  it("grows with level and with time used, between a quarter and the full radius", () => {
    expect(reach("learning", 0)).toBeCloseTo(0.25 + 0.5 / 3, 3);
    expect(reach("expert", 0)).toBeCloseTo(0.75, 3);
    expect(reach("expert", 120)).toBe(1);
    expect(reach("working", 60)).toBeGreaterThan(reach("working", 0));
  });
  it("puts the furthest-out skills first, then A to Z, and caps the count", () => {
    const r = radarSkills([sk("Zed", "working"), sk("Go", "expert"), sk("Java", "expert", ["a"]), sk("Ada", "working")], jobs, NOW, 3);
    expect(r.map((x) => x.name)).toEqual(["Java", "Go", "Ada"]);
  });
  it("tells apart skills of the same level by the time used", () => {
    const r = radarSkills([sk("A", "working"), sk("B", "working", ["a"])], jobs, NOW);
    expect(r[0].name).toBe("B");
    expect(r[0].value).toBeGreaterThan(r[1].value);
  });
});

describe("spokePoint", () => {
  it("starts straight up and goes clockwise", () => {
    expect(spokePoint(0, 4, 1, 100, 100, 50)).toEqual({ x: 100, y: 50 });
    expect(spokePoint(1, 4, 1, 100, 100, 50)).toEqual({ x: 150, y: 100 });
    expect(spokePoint(2, 4, 0.5, 100, 100, 50)).toEqual({ x: 100, y: 125 });
  });
  it("joins points for a polygon", () => expect(polygonPoints([{ x: 1, y: 2 }, { x: 3, y: 4 }])).toBe("1,2 3,4"));
});

describe("clip", () => {
  it("leaves short names and cuts long ones", () => {
    expect(clip("Go")).toBe("Go");
    expect(clip("Apache Kafka Streaming Platform", 12)).toBe("Apache Kafk…");
  });
});
