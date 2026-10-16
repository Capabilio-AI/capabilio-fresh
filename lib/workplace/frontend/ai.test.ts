import { describe, expect, it } from "vitest";
import type { z } from "zod";
import type { GenerationContext } from "@/lib/arena-workstations/types";
import { generateAiFrontend, type Deps } from "./ai";

const ctx = (areaKey = "accessibility"): GenerationContext => ({ roleName: "Frontend Developer", parentSkill: "Frontend Development", areaName: areaKey, areaKey, difficulty: "medium", avoidTitles: [], ticketSeed: 8, level: "junior" });

const starter = '<!doctype html>\n<html>\n<head><meta charset="utf-8"><title>Fest</title></head>\n<body>\n<main>\n  <h1>Tech fest</h1>\n  <img src="poster.jpg">\n  <button><svg width="12" height="12"></svg></button>\n</main>\n</body>\n</html>\n';
const solution = '<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Fest</title></head>\n<body>\n<main>\n  <h1>Tech fest</h1>\n  <img src="poster.jpg" alt="Fest poster">\n  <button aria-label="Open schedule"><svg width="12" height="12"></svg></button>\n</main>\n</body>\n</html>\n';
const check = (label: string, selector: string, op: string, extra: object = {}) => ({ kind: "html", label, file: "index.html", selector, op, ...extra });
const good = {
  title: "Make the fest page work for screen readers",
  requester_name: "Asha Verma", requester_title: "Web Lead",
  scenario: "Hi, volunteers using screen readers cannot use the fest page: the poster has no description and the schedule button is read as just button.",
  deliverable: "Edit index.html so the page is accessible to screen reader users.",
  skill_tags: ["Accessibility", "HTML"],
  files: [{ name: "index.html", language: "html", starter, solution }],
  checks: [
    check("The page declares its language with a lang attribute", "html", "attr_exists", { attr: "lang" }),
    check("Every image has an alt attribute", "img:not([alt])", "not_exists"),
    check("The icon-only button has an aria-label", "button[aria-label]", "exists"),
    check("The page still has a main element", "main", "exists"),
    check("The page still has exactly one h1", "h1", "count_equals", { value: 1 }),
  ],
};
const solverRight = { files: [{ name: "index.html", content: solution }] };
const fake = (gen: unknown, solver: unknown): Deps => {
  let n = 0;
  return { llm: async <T,>(_p: string, _s: string, schema: z.ZodType<T>) => schema.parse(n++ === 0 ? gen : solver) };
};
const run = (gen: unknown, solver: unknown = solverRight, c = ctx()) => generateAiFrontend(c, fake(gen, solver));

describe("AI-written frontend exercise", () => {
  it("accepts an exercise whose solution passes its checks and which an independent solver can pass too", async () => {
    const d = await run(good);
    expect(d.content.requirements).toHaveLength(5);
    expect(JSON.stringify(d.content)).not.toContain("Fest poster");
  });
  it("rejects when the solution fails its own check, or the starter already passes", async () => {
    await expect(run({ ...good, files: [{ ...good.files[0], solution: starter }] })).rejects.toThrow(/fails its own check/);
    await expect(run({ ...good, files: [{ ...good.files[0], starter: solution }] })).rejects.toThrow(/already meets/);
  });
  it("rejects when an independent solver cannot satisfy the checks, meaning the task is under-explained", async () => {
    await expect(run(good, { files: [{ name: "index.html", content: starter }] })).rejects.toThrow(/independent solver/);
  });
  it("rejects checks on the wrong kind of file, unparsable CSS and a debugging task whose starter is entirely wrong", async () => {
    await expect(run({ ...good, files: [{ name: "index.html", language: "html", starter, solution }, { name: "style.css", language: "css", starter: "a { color: red; }", solution: "a { color: blue; }" }], checks: [...good.checks.slice(1), { kind: "css", label: "A css check on the html file", file: "index.html", property: "color", op: "exists" }] })).rejects.toThrow(/css check was used/);
    await expect(run({ ...good, files: [{ name: "index.html", language: "html", starter, solution }, { name: "style.css", language: "css", starter: "a { color: ", solution: "a { color: " }] })).rejects.toThrow(/does not parse/);
    const bare = '<!doctype html>\n<html>\n<head><title>x</title></head>\n<body><p>nothing here</p></body>\n</html>\n';
    const full = '<!doctype html>\n<html lang="en">\n<head><title>x</title></head>\n<body><main><h1>Hi</h1><button aria-label="Go">+</button></main><footer>f</footer></body>\n</html>\n';
    const allWrong = { ...good, files: [{ name: "index.html", language: "html", starter: bare, solution: full }], checks: [check("The page declares its language with a lang attribute", "html", "attr_exists", { attr: "lang" }), check("The page has a main element", "main", "exists"), check("The page has exactly one h1", "h1", "count_equals", { value: 1 }), check("The button has an aria-label", "button[aria-label]", "exists"), check("The page has a footer", "footer", "exists")] };
    await expect(run(allWrong, { files: [{ name: "index.html", content: full }] }, ctx("frontend-debugging"))).rejects.toThrow(/partly right/);
    await expect(run(allWrong, { files: [{ name: "index.html", content: full }] }, ctx("accessibility"))).resolves.toBeDefined();
  });
});
