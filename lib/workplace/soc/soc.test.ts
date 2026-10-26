import { describe, expect, it } from "vitest";
import { buildShift } from "./generator";
import { gradeShift, solutionFor } from "./checks";
import { SOC_TEMPLATES } from "./templates";
import { ACTIONS, TECHNIQUES, type FamilyKey, type SocField } from "./types";

const ALL_FIELDS: SocField[] = ["disposition", "severity", "technique", "action", "escalate", "evidence"];
const FAMILY_KEYS: FamilyKey[] = ["brute_force", "phishing_macro", "impossible_travel", "port_scan", "dns_exfil", "beacon"];
const SEEDS = [1, 7, 42, 1234, 99999];

const allPass = (checks: { passed: boolean }[]) => checks.length > 0 && checks.every((c) => c.passed);

describe("SOC shift generator", () => {
  it("is deterministic: the same seed rebuilds the same shift and key", () => {
    expect(buildShift(5, ["brute_force", "beacon"], ALL_FIELDS)).toEqual(buildShift(5, ["brute_force", "beacon"], ALL_FIELDS));
    expect(buildShift(5, ["brute_force"], ALL_FIELDS).content.logs).not.toEqual(buildShift(6, ["brute_force"], ALL_FIELDS).content.logs);
  });

  it("produces a few hundred time-ordered lines with unique ids and one alert per family", () => {
    const { content, key } = buildShift(3, FAMILY_KEYS, ALL_FIELDS);
    expect(content.logs.length).toBeGreaterThan(250);
    expect(content.logs.length).toBeLessThan(500);
    expect(new Set(content.logs.map((l) => l.id)).size).toBe(content.logs.length);
    expect(content.logs.map((l) => l.ts)).toEqual([...content.logs.map((l) => l.ts)].sort());
    expect(content.alerts).toHaveLength(FAMILY_KEYS.length);
    expect(new Set(content.alerts.map((a) => a.id)).size).toBe(FAMILY_KEYS.length);
    expect(Object.keys(key.alerts).sort()).toEqual(content.alerts.map((a) => a.id).sort());
  });

  it("every evidence id exists in the logs and belongs to its alert's chain", () => {
    for (const seed of SEEDS) {
      const { content, key } = buildShift(seed, FAMILY_KEYS, ALL_FIELDS);
      const ids = new Set(content.logs.map((l) => l.id));
      for (const k of Object.values(key.alerts)) {
        expect(k.evidence.every((g) => g.length > 0)).toBe(true);
        for (const id of k.evidence.flat()) {
          expect(ids.has(id)).toBe(true);
          expect(k.related).toContain(id);
        }
        expect(k.techniques.every((t) => TECHNIQUES.some((x) => x.id === t))).toBe(true);
        expect(k.actions.every((a) => ACTIONS.some((x) => x.key === a))).toBe(true);
      }
    }
  });

  it("never leaks the answer key into what the student sees", () => {
    const { content } = buildShift(11, FAMILY_KEYS, ALL_FIELDS);
    const shown = JSON.stringify(content);
    for (const word of ["true_positive", "false_positive", "benign_true_positive", "related", "evidence\":"]) expect(shown).not.toContain(word);
  });

  it("uses only private and documentation IP ranges and reserved domains", () => {
    for (const seed of SEEDS) {
      const text = JSON.stringify(buildShift(seed, FAMILY_KEYS, ALL_FIELDS).content);
      for (const ip of text.match(/\b\d{1,3}(\.\d{1,3}){3}\b/g) ?? []) expect(ip).toMatch(/^(10\.|192\.0\.2\.|198\.51\.100\.|203\.0\.113\.)/);
      for (const host of text.match(/(?:https?:\/\/|q=|@)[a-z0-9.-]+\.[a-z]+/gi) ?? []) expect(host).toMatch(/\.(example|test)$/i);
    }
  });
});

describe("SOC grading", () => {
  it.each(FAMILY_KEYS)("the solution for a %s shift passes every check", (family) => {
    for (const seed of SEEDS) {
      const { content, key } = buildShift(seed, [family], ALL_FIELDS);
      expect(allPass(gradeShift(content, key, solutionFor(key)))).toBe(true);
    }
  });

  it.each(SOC_TEMPLATES.map((t) => [t.id, t] as const))("template %s: the solution passes, an empty or careless submission fails", (_id, t) => {
    for (const seed of SEEDS) {
      const { content, key } = buildShift(seed, t.families, t.ask);
      expect(allPass(gradeShift(content, key, solutionFor(key)))).toBe(true);
      expect(gradeShift(content, key, { alerts: {} }).some((c) => c.passed)).toBe(false);
      // "everything is malicious, escalate it all" must not pass
      const panic = { alerts: Object.fromEntries(content.alerts.map((a) => [a.id, { disposition: "true_positive", severity: "critical", technique: "T1046", action: "isolate_host", escalate: true, evidence: content.logs.map((l) => l.id) }])) };
      expect(allPass(gradeShift(content, key, panic))).toBe(false);
    }
  });

  it("gives a severity one level off a 'close' label, and still fails it", () => {
    const { content, key } = buildShift(2, ["impossible_travel"], ["severity"]);
    const sol = solutionFor(key);
    const id = content.alerts[0].id;
    const close = gradeShift(content, key, { alerts: { [id]: { ...sol.alerts[id], severity: "medium" } } });
    expect(close.find((c) => c.label.includes("severity"))).toEqual({ label: `${id}: severity (close, one level off)`, passed: false });
    const far = gradeShift(content, key, { alerts: { [id]: { ...sol.alerts[id], severity: "critical" } } });
    expect(far.find((c) => c.label.includes("severity"))).toEqual({ label: `${id}: severity`, passed: false });
  });

  it("rejects evidence that misses a group, and evidence padded with unrelated lines", () => {
    const { content, key } = buildShift(4, ["beacon"], ["evidence"]);
    const id = content.alerts[0].id;
    const k = key.alerts[id];
    const ev = (evidence: string[]) => gradeShift(content, key, { alerts: { [id]: { disposition: k.disposition, evidence } } })[1].passed;
    expect(ev(k.evidence.map((g) => g[0]))).toBe(true);
    expect(ev([k.evidence[0][0]])).toBe(false);
    const unrelated = content.logs.map((l) => l.id).filter((x) => !k.related.includes(x));
    expect(ev([...k.evidence.map((g) => g[0]), ...unrelated.slice(0, 2)])).toBe(true);
    expect(ev([...k.evidence.map((g) => g[0]), ...unrelated.slice(0, 3)])).toBe(false);
  });

  it("checks the technique only for true positives", () => {
    const { content, key } = buildShift(9, ["port_scan"], ["technique"]);
    expect(gradeShift(content, key, solutionFor(key)).map((c) => c.label)).toEqual([`${content.alerts[0].id}: disposition`]);
  });
});

describe("SOC templates", () => {
  it("cover at least four areas, each with an easy fresher ticket", () => {
    const areas = new Set(SOC_TEMPLATES.flatMap((t) => t.areas));
    expect(areas.size).toBeGreaterThanOrEqual(4);
    for (const a of areas) expect(SOC_TEMPLATES.some((t) => t.areas.includes(a) && t.difficulty === "easy" && t.minLevel === "fresher")).toBe(true);
    expect(SOC_TEMPLATES.length).toBeGreaterThanOrEqual(6);
    expect(SOC_TEMPLATES.some((t) => t.difficulty === "medium")).toBe(true);
    expect(new Set(SOC_TEMPLATES.map((t) => t.id)).size).toBe(SOC_TEMPLATES.length);
  });
});
