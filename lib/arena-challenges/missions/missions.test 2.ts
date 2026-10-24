import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/workplace/rng";
import { buildMission, orderLabs } from "./build";
import { activeControls, defaultSettings, nearestSolution, normalizeSettings } from "./grid";
import { hintFor } from "./hints";
import { labByKey, labsFor } from "./registry";
import { missionScore, MISSION_POINTS } from "./score";
import { storyIsSafe, writeStory } from "./story";
import { slotKind } from "../stream-ai/plan";

describe("missionScore", () => {
  it("gives full points for a clean finish and charges 15% a hint, never below 55%", () => {
    expect(missionScore("medium", 0, 1).total).toBe(60);
    expect(missionScore("medium", 1, 1).total).toBe(51);
    expect(missionScore("hard", 3, 1).total).toBe(Math.round(75 * 0.55));
    expect(missionScore("easy", 9, 1).hintFactor).toBe(0.55);
  });
  it("adds the experimenter bonus only for three different settings", () => {
    expect(missionScore("easy", 0, 2).bonus).toBe(0);
    expect(missionScore("easy", 0, 3)).toEqual({ base: 45, hintFactor: 1, bonus: 9, total: 54 });
    expect(missionScore("hard", 0, 5).total).toBe(MISSION_POINTS.hard + 15);
  });
});

describe("slotKind", () => {
  it("makes two of every three slots missions for branches with labs, and keeps the old mix elsewhere", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => slotKind(i, true))).toEqual(["mission", "mission", "numeric", "mission", "mission", "mcq", "mission", "mission", "numeric"]);
    expect([0, 1, 2].map((i) => slotKind(i, false))).toEqual(["numeric", "mcq", "numeric"]);
  });
});

describe("storyIsSafe", () => {
  const facts = "Load: 250 mA. Budget: ₹300. Mission: keep ripple under 1.5 V.";
  it("accepts a story that only uses numbers from the facts", () => {
    expect(storyIsSafe({ title: "Power for the night clinic", story: "A clinic in Nagpur loses mains every evening and its 250 mA monitor needs steady power from a backup supply the technician must build." }, facts, [])).toBe(true);
  });
  it("rejects invented numbers, repeated titles and answer-giving words", () => {
    expect(storyIsSafe({ title: "Power for the night clinic", story: "The clinic needs a 12 V supply built quickly by a technician with only a few parts on the bench." }, facts, [])).toBe(false);
    expect(storyIsSafe({ title: "Power for the night clinic", story: "A clinic in Nagpur loses mains every evening and the technician must build backup power for the monitors." }, facts, ["power for the night clinic"])).toBe(false);
    expect(storyIsSafe({ title: "Power for the night clinic", story: "The solution is a bigger capacitor, which the technician in Nagpur already has on the shelf at the clinic." }, facts, [])).toBe(false);
  });
});

describe("writeStory", () => {
  const lab = labByKey("led-string")!;
  const scenario = lab.makeScenario(makeRng(4), "easy");
  it("uses the lab's own story when the AI fails or invents numbers", async () => {
    const boom = await writeStory(lab, scenario, "easy", [], { llm: async () => { throw new Error("down"); } });
    expect(boom.ai).toBe(false);
    expect(boom.title.length).toBeGreaterThan(5);
    const bad = await writeStory(lab, scenario, "easy", [], { llm: async () => ({ title: "Indicator panel rescue", story: "A panel builder in Surat has 987654 LEDs to wire before the festival and nobody to help with it." }) });
    expect(bad.ai).toBe(false);
  });
  it("keeps a safe AI story", async () => {
    const good = await writeStory(lab, scenario, "easy", [], { llm: async () => ({ title: "Indicator panel rescue", story: "A panel builder in Surat has a festival deadline and her last batch of indicator lights burned out within a day, so she needs a design that lasts." }) });
    expect(good.ai).toBe(true);
  });
});

describe("hints", () => {
  const lab = labByKey("rectifier")!;
  let scenario: unknown;
  for (let seed = 1; !scenario; seed++) {
    const s = lab.makeScenario(makeRng(seed), "medium");
    if (nearestSolution(lab, s, defaultSettings(lab.controls(s)))) scenario = s;
  }
  const start = defaultSettings(lab.controls(scenario));
  it("go from a thought, to a control, to the setting, and are deterministic", () => {
    const o = lab.evaluate(scenario, start);
    const h1 = hintFor(lab, scenario, start, o, 1);
    const h2 = hintFor(lab, scenario, start, o, 2);
    const h3 = hintFor(lab, scenario, start, o, 3);
    expect(h1).toBe(o.objectives.find((x) => !x.ok)!.nudge);
    expect(h2).toMatch(/Look closely at "/);
    expect(h3).toMatch(/^Change "/);
    expect(hintFor(lab, scenario, start, o, 3)).toBe(h3);
  });
  it("following hint 3 moves the mission closer to done", () => {
    const target = nearestSolution(lab, scenario, start)!;
    expect(lab.evaluate(scenario, target).passed).toBe(true);
  });
});

describe("normalizeSettings with dependent controls", () => {
  it("ignores inactive controls when walking the grid", () => {
    const controls = [
      { kind: "choice" as const, id: "t", label: "T", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }], default: "a" },
      { kind: "number" as const, id: "n", label: "N", min: 0, max: 4, step: 1, unit: "", default: 0, when: { id: "t", value: "b" } },
    ];
    expect(activeControls(controls, { t: "a", n: 0 }).map((c) => c.id)).toEqual(["t"]);
    expect(normalizeSettings(controls, { t: "b", n: 9 }).ok).toBe(false);
  });
});

describe("buildMission", () => {
  const noAi = { llm: async () => { throw new Error("no ai in tests"); } };
  it("builds a proven mission for every family, with a story, and rotates labs", async () => {
    for (const family of ["ece", "eee", "mech", "civil"] as const) {
      const m = await buildMission({ family, difficulty: "medium", subject: null, usage: new Map(), avoidTitles: [], seed: 11 }, noAi);
      expect(m, family).not.toBeNull();
      expect(m!.winning.passing).toBeGreaterThan(0);
      expect(m!.winning.passing / m!.winning.total).toBeLessThan(0.3);
      expect(labsFor(family).map((l) => l.key)).toContain(m!.labKey);
      expect(m!.aiStory).toBe(false);
      expect(JSON.parse(JSON.stringify(m!.scenario))).toEqual(m!.scenario);
    }
  }, 120_000);
  it("prefers the lab that matches the course and the one used least", () => {
    const ece = labsFor("ece");
    expect(orderLabs(ece, "Digital Logic Design", new Map(), 1)[0].key).toBe("logic-gate");
    const usage = new Map([["rectifier", 3], ["led-string", 2], ["rc-filter", 2], ["amplifier", 1]]);
    expect(orderLabs(ece, null, usage, 1)[0].key).toBe("logic-gate");
  });
});
