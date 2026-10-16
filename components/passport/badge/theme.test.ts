import { describe, expect, it } from "vitest";
import { badgeTheme, silhouettePath, PALETTES } from "./theme";

const SKILLS = ["API Design", "Programming Fundamentals", "Error Handling and Debugging", "Object-Oriented Programming", "Problem Solving", "Algorithms", "Cloud Computing", "Computer Networks", "SQL Queries", "Data Cleaning", "Statistics", "Docker", "CI/CD Pipelines", "Git Version Control", "Web Security", "Machine Learning", "Kubernetes", "System Design", "HTML and CSS", "React", "Linux", "Data Structures", "Testing", "Performance Optimization", "Technical Writing", "Communication", "Dashboards", "REST Services", "Embedded Systems", "Mobile Development"];

describe("badge theme", () => {
  it("is deterministic: a skill always gets the same badge", () => {
    expect(badgeTheme("s1", "API Design")).toEqual(badgeTheme("s1", "API Design"));
  });
  it("gives different skills different looks", () => {
    const looks = new Set(SKILLS.map((n, i) => { const t = badgeTheme(`id-${i}`, n); return JSON.stringify([t.silhouette, t.pattern, t.palette.name]); }));
    expect(looks.size).toBeGreaterThanOrEqual(SKILLS.length - 2);
    const palettes = new Set(SKILLS.map((n, i) => badgeTheme(`id-${i}`, n).palette.name));
    expect(palettes.size).toBeGreaterThanOrEqual(7);
  });
  it("reads what a skill is about to pick its centre glyph", () => {
    const glyph = (n: string) => badgeTheme("x", n).glyph;
    expect(glyph("API Design")).toBe("api");
    expect(glyph("Error Handling and Debugging")).toBe("bug");
    expect(glyph("SQL Queries")).toBe("database");
    expect(glyph("Cloud Computing")).toBe("cloud");
    expect(glyph("Computer Networks")).toBe("network");
    expect(glyph("Programming Fundamentals")).toBe("tools");
    expect(glyph("Algorithms")).toBe("algorithm");
    expect(glyph("Quilting circle")).toMatch(/block|puzzle|layers|tools/);
  });
  it("draws every silhouette as a closed path inside the medallion", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const t = badgeTheme(`k${i}`, `Skill ${i}`);
      seen.add(t.silhouette.kind);
      const d = silhouettePath(t.silhouette, 50);
      expect(d.startsWith("M") && d.endsWith("Z")).toBe(true);
      for (const [x, y] of d.slice(1, -1).split(" L").map((p) => p.split(" ").map(Number))) {
        expect(x).toBeGreaterThan(5);
        expect(x).toBeLessThan(115);
        expect(y).toBeGreaterThan(5);
        expect(y).toBeLessThan(115);
      }
    }
    expect(seen.size).toBe(4);
  });
  it("only uses palettes that exist", () => {
    for (let i = 0; i < 50; i++) expect(PALETTES.map((p) => p.name)).toContain(badgeTheme(`p${i}`, `n${i}`).palette.name);
  });
});
