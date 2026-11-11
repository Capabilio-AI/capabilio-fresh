import { describe, expect, it } from "vitest";
import { DEDUPE_MS, DEFAULT_POLICY, applyViolation, blockedKey, initialExamState, isDuplicateSwitch, noticeFor, parseStrikes } from "./exam-rules";

describe("applyViolation", () => {
  it("counts each kind on its own and ends the test at the limit", () => {
    let s = initialExamState;
    s = applyViolation(s, "fullscreen_exit", DEFAULT_POLICY);
    s = applyViolation(s, "tab_switch", DEFAULT_POLICY);
    expect(s).toMatchObject({ fullscreenExits: 1, tabSwitches: 1, terminated: null });
    s = applyViolation(applyViolation(s, "fullscreen_exit", DEFAULT_POLICY), "fullscreen_exit", DEFAULT_POLICY);
    expect(s.fullscreenExits).toBe(3);
    expect(s.terminated).toBe("fullscreen_exit");
  });
  it("does not change a test that has already ended", () => {
    const ended = { fullscreenExits: 3, tabSwitches: 0, terminated: "fullscreen_exit" as const };
    expect(applyViolation(ended, "tab_switch", DEFAULT_POLICY)).toBe(ended);
  });
  it("honours a stricter policy", () => {
    expect(applyViolation(initialExamState, "tab_switch", { maxFullscreenExits: 3, maxTabSwitches: 1 }).terminated).toBe("tab_switch");
  });
});

describe("noticeFor", () => {
  it("says how many strikes are used and how many are left", () => {
    const s = applyViolation(initialExamState, "fullscreen_exit", DEFAULT_POLICY);
    expect(noticeFor(s, "fullscreen_exit", DEFAULT_POLICY)).toMatchObject({ title: "Fullscreen exit recorded", count: 1, limit: 3, remaining: 2, ends: false, action: "Return to Fullscreen" });
    expect(noticeFor(s, "fullscreen_exit", DEFAULT_POLICY).detail).toBe("2 more exits will end your test.");
  });
  it("uses the singular for the last strike and says the test is over at the limit", () => {
    const two = applyViolation(applyViolation(initialExamState, "tab_switch", DEFAULT_POLICY), "tab_switch", DEFAULT_POLICY);
    expect(noticeFor(two, "tab_switch", DEFAULT_POLICY)).toMatchObject({ title: "Tab switch recorded", remaining: 1, detail: "1 more switch will end your test." });
    const three = applyViolation(two, "tab_switch", DEFAULT_POLICY);
    expect(noticeFor(three, "tab_switch", DEFAULT_POLICY)).toMatchObject({ ends: true, remaining: 0 });
    expect(noticeFor(three, "tab_switch", DEFAULT_POLICY).detail).toMatch(/ended/i);
  });
});

describe("isDuplicateSwitch", () => {
  it("ignores a blur that comes straight after a fullscreen exit, since one action raises both", () => {
    expect(isDuplicateSwitch(1000, 1000 + DEDUPE_MS - 1)).toBe(true);
    expect(isDuplicateSwitch(1000, 1000 + DEDUPE_MS + 1)).toBe(false);
    expect(isDuplicateSwitch(null, 5000)).toBe(false);
  });
});

describe("blockedKey", () => {
  const k = (key: string, o: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }> = {}) => blockedKey({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...o });
  it("catches the ways of opening developer tools", () => {
    expect(k("F12")).toBe("devtools");
    expect(k("I", { ctrlKey: true, shiftKey: true })).toBe("devtools");
    expect(k("j", { ctrlKey: true, shiftKey: true })).toBe("devtools");
    expect(k("c", { metaKey: true, altKey: true })).toBe("devtools");
    expect(k("i", { metaKey: true, altKey: true })).toBe("devtools");
  });
  it("catches view-source, print and save", () => {
    expect(k("u", { ctrlKey: true })).toBe("view_source");
    expect(k("p", { metaKey: true })).toBe("print");
    expect(k("s", { ctrlKey: true })).toBe("save");
  });
  it("leaves normal typing alone", () => {
    expect(k("a")).toBeNull();
    expect(k("i", { shiftKey: true })).toBeNull();
    expect(k("Enter", { ctrlKey: true })).toBeNull();
    expect(k("c", { ctrlKey: true })).toBeNull(); // copy is handled by the copy event itself
  });
});

describe("parseStrikes", () => {
  it("restores what was saved, so a refresh keeps the count", () => {
    const saved = JSON.stringify({ fullscreenExits: 2, tabSwitches: 1, terminated: null });
    expect(parseStrikes(saved)).toEqual({ fullscreenExits: 2, tabSwitches: 1, terminated: null });
    expect(parseStrikes(JSON.stringify({ fullscreenExits: 3, tabSwitches: 0, terminated: "fullscreen_exit" })).terminated).toBe("fullscreen_exit");
  });
  it("reads anything unusable as no strikes", () => {
    for (const bad of [null, "", "not json", "[]", '{"fullscreenExits":-5,"tabSwitches":"x","terminated":"nope"}']) expect(parseStrikes(bad)).toEqual(initialExamState);
  });
});
