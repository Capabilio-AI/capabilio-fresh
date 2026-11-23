import { describe, expect, it } from "vitest";
import { Script, createContext } from "node:vm";
import { parseHTML } from "linkedom";
import { browserChallenge } from "./javascript/browser-challenge";
import { judgePage } from "./html-judge";

/**
 * Runs the REFERENCE page (our own, trusted code; a student's code is never run on the server) in a DOM and clicks Add, to prove that code meeting the
 * requirements really behaves as the task describes.
 */
function runReference() {
  const { document, window } = parseHTML(browserChallenge.reference);
  const store = new Map<string, string>();
  const localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  const ctx = createContext({ document, localStorage, JSON, console });
  new Script(document.querySelector("script")!.textContent ?? "").runInContext(ctx);
  const input = document.querySelector("#task") as unknown as { value: string };
  const click = () => document.querySelector("#add")!.dispatchEvent(new (window as unknown as { Event: typeof Event }).Event("click"));
  return { document, store, input, click, localStorage, window };
}

describe("the task-list problem", () => {
  it("the reference page meets every requirement", () => {
    const r = judgePage(browserChallenge, browserChallenge.reference);
    expect(r.results.filter((x) => !x.passed).map((x) => x.text)).toEqual([]);
  });
  it("the reference really adds tasks, counts them, clears the box, skips blanks and saves", () => {
    const { document, store, input, click } = runReference();
    input.value = "  Learn SQL  "; click();
    input.value = "   "; click();
    input.value = "<b>bold</b>"; click();
    const items = [...document.querySelectorAll("#list li")].map((li) => li.textContent);
    expect(items).toEqual(["Learn SQL", "<b>bold</b>"]);
    expect(document.querySelector("#count")!.textContent).toBe("2 tasks");
    expect(input.value).toBe("");
    expect(JSON.parse(store.get("tasks")!)).toEqual(["Learn SQL", "<b>bold</b>"]);
    expect(document.querySelector("#list b")).toBeNull();
  });
  it("the starter and every common mistake fail at least one requirement", () => {
    expect(judgePage(browserChallenge, browserChallenge.starter).passed).toBe(false);
    for (const wrong of browserChallenge.commonMistakes) expect(judgePage(browserChallenge, wrong).passed, wrong.slice(0, 200)).toBe(false);
  });
  it("each requirement is failed by at least one realistic wrong page", () => {
    const failed = new Set<number>();
    for (const page of browserChallenge.commonMistakes) for (const r of judgePage(browserChallenge, page).results) if (!r.passed) failed.add(r.index);
    expect(browserChallenge.requirements.map((r, i) => (failed.has(i) ? null : r.text)).filter(Boolean)).toEqual([]);
  });
  it("a differently written correct solution also passes", () => {
    const alt = browserChallenge.reference.replace('document.querySelector("#add")', 'document.getElementById("add")').replace("list.append(li);", "list.appendChild(li);").replace("input.value.trim()", "String(input.value).trim()");
    expect(judgePage(browserChallenge, alt).results.filter((r) => !r.passed).map((r) => r.text)).toEqual([]);
  });
});
