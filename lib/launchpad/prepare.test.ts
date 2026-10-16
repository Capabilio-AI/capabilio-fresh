import { describe, expect, it } from "vitest";
import { matchJob } from "./match";
import { buildPreparation, TYPICAL_TICKET_MINUTES } from "./prepare";

const ids: Record<string, string> = { sql: "s1", excel: "s2", statistics: "s3", "power bi": "s4" };
const resolve = (t: string) => ids[t.trim().toLowerCase()] ?? null;
const levels = new Map<string, number>([["s1", 87], ["s2", 35]]);
const levelOf = (id: string) => levels.get(id) ?? null;
const practise = new Map([["s2", { areaKey: "spreadsheet", areaName: "Excel / Spreadsheets" }], ["s3", { areaKey: "statistics", areaName: "Statistics" }]]);
const prep = (skills: string[]) => buildPreparation(matchJob(skills, resolve, levelOf), practise);

describe("buildPreparation", () => {
  it("turns each gap into an Arena step with an honest ticket estimate, weakest first", () => {
    const p = prep(["SQL", "Excel", "Statistics"]);
    expect(p.steps.map((s) => s.skill)).toEqual(["Statistics", "Excel"]);
    // Arena adds about 25 levels per verified ticket: 60 from nothing is 3 tickets, 25 short is 1
    expect(p.steps[0]).toMatchObject({ state: "unmeasured", ticketsNeeded: 3, level: null });
    expect(p.steps[1]).toMatchObject({ state: "building", ticketsNeeded: 1, level: 35 });
    expect(p.steps[0].action).toEqual({ kind: "arena", areaKey: "statistics", areaName: "Statistics", href: "/arena/challenges/domain?focus=statistics" });
  });

  it("totals tickets, minutes and days at one ticket a day", () => {
    const p = prep(["SQL", "Excel", "Statistics"]);
    expect(p.totalTickets).toBe(4);
    expect(p.totalMinutes).toBe(4 * TYPICAL_TICKET_MINUTES);
    expect(p.days).toBe(4);
  });

  it("sends a gap Arena cannot build to SkillStudio and gives no estimate for it", () => {
    const p = prep(["Power BI"]);
    expect(p.steps[0].action).toEqual({ kind: "studio", href: "/skillstudio" });
    expect(p.steps[0].ticketsNeeded).toBe(0);
    expect(p.totalTickets).toBe(0);
  });

  it("lists skills already ready and skills it cannot place, and has no steps when the user is ready", () => {
    const p = prep(["SQL", "Quantum basket weaving"]);
    expect(p.ready.map((s) => s.text)).toEqual(["SQL"]);
    expect(p.unmapped).toEqual(["Quantum basket weaving"]);
    expect(p.steps).toEqual([]);
    expect(p.totalTickets).toBe(0);
  });
});
