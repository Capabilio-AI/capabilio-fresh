import { describe, expect, it } from "vitest";
import { CRT_MODULES, QUESTIONS_PER_MODULE } from "../model";
import { buildBank } from "./bank";
import { SESSIONS } from "./sessions";

const bank = buildBank();

describe("CRT question bank", () => {
  it("has enough questions in every module for several cycles without repeats", () => {
    for (const m of CRT_MODULES) expect(bank.filter((q) => q.module === m).length, m).toBeGreaterThanOrEqual(QUESTIONS_PER_MODULE * 2);
  });

  it("never repeats a prompt", () => {
    expect(new Set(bank.map((q) => q.prompt)).size).toBe(bank.length);
  });

  it("builds the same bank every time", () => {
    expect(buildBank()).toEqual(bank);
  });

  it("gives every question four distinct options and one best answer", () => {
    for (const q of bank) {
      expect(q.options, q.prompt).toHaveLength(4);
      expect(new Set(q.options.map((o) => o.text)).size, q.prompt).toBe(4);
      expect(new Set(q.options.map((o) => o.key)).size).toBe(4);
      const best = Math.max(...q.options.map((o) => o.points));
      expect(q.options.filter((o) => o.points === best), q.prompt).toHaveLength(1);
      expect(q.explanation.length, q.prompt).toBeGreaterThan(10);
    }
  });

  it("scores right/wrong modules 1/0 and soft skills 3/2/1/0", () => {
    for (const q of bank) {
      const pts = q.options.map((o) => o.points).sort();
      expect(pts, q.prompt).toEqual(q.module === "soft_skills" ? [0, 1, 2, 3] : [0, 0, 0, 1]);
    }
  });

  it("computes aptitude answers correctly (spot checks)", () => {
    const right = (re: RegExp) => bank.filter((q) => re.test(q.prompt)).map((q) => q.options.find((o) => o.points === 1)!.text);
    for (const t of right(/How long does it take to cross a pole/)) expect(t).toMatch(/^\d+ seconds$/);
    for (const q of bank.filter((x) => /^What is the HCF of (\d+) and (\d+)\?$/.test(x.prompt))) {
      const [, a, b] = q.prompt.match(/HCF of (\d+) and (\d+)/)!.map(Number);
      const gcd = (x: number, y: number): number => (y ? gcd(y, x % y) : x);
      expect(Number(q.options.find((o) => o.points === 1)!.text)).toBe(gcd(a, b));
    }
    for (const q of bank.filter((x) => /remainder when \d+ is divided by 9/.test(x.prompt))) {
      const n = Number(q.prompt.match(/when (\d+) is/)![1]);
      expect(Number(q.options.find((o) => o.points === 1)!.text)).toBe(n % 9);
    }
  });
});

describe("CRT training sessions", () => {
  it("gives every learning path at least one lesson", () => {
    for (const c of ["aptitude", "reasoning", "verbal", "speaking", "soft_skills", "group_discussion", "interview", "workplace"]) expect(SESSIONS.some((s) => s.category === c), c).toBe(true);
  });

  it("covers every module in order with practice that has a valid answer", () => {
    for (const m of CRT_MODULES) {
      const of = SESSIONS.filter((s) => s.module === m);
      expect(of.length, m).toBeGreaterThanOrEqual(3);
      expect(new Set(of.map((s) => s.position)).size, m).toBe(of.length);
    }
    for (const s of SESSIONS) {
      const practice = s.content.filter((b) => b.type === "practice");
      expect(practice.length, s.title).toBeGreaterThanOrEqual(2);
      for (const p of practice) if (p.type === "practice") expect(p.answer).toBeLessThan(p.options.length);
    }
  });
});

describe("reasoning generators (recomputed from the prompt)", () => {
  const key = (re: RegExp) => bank.filter((q) => re.test(q.prompt)).map((q) => ({ q, ans: q.options.find((o) => o.points === 1)!.text }));
  it("clock angle matches the standard formula", () => {
    const rows = key(/smaller angle between the hour/);
    expect(rows.length).toBeGreaterThan(5);
    for (const { q, ans } of rows) {
      const [, h, m] = q.prompt.match(/at (\d+):(\d+)\?/)!;
      const raw = Math.abs(30 * +h - 5.5 * +m);
      expect(ans, q.prompt).toBe(`${raw > 180 ? 360 - raw : raw}°`);
    }
  });
  it("mirror time is 12:00 minus the time", () => {
    for (const { q, ans } of key(/mirror image show/)) {
      const [, h, m] = q.prompt.match(/is (\d+):(\d+)\./)!;
      const t = 720 - (+h * 60 + +m), hh = Math.floor(t / 60) || 12;
      expect(ans, q.prompt).toBe(`${hh}:${String(t % 60).padStart(2, "0")}`);
    }
  });
  it("walking distance is the hypotenuse", () => {
    for (const { q, ans } of key(/How far is .* from the starting point/)) {
      const [, a, b] = q.prompt.match(/walks (\d+) km \w+, then turns and walks (\d+) km/)!;
      expect(ans, q.prompt).toBe(`${Math.hypot(+a, +b)} km`);
    }
  });
  it("adds a few hundred new reasoning questions", () => {
    expect(bank.filter((q) => q.module === "reasoning").length).toBeGreaterThan(400);
  });
});
