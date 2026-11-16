import { describe, expect, it } from "vitest";
import { KIND_LABEL, KINDS, agoLabel, extractTags, safeUrl, trendingTags, validateComment, validateNote, validatePost } from "./pulse";

describe("extractTags", () => {
  it("lower-cases, de-duplicates and stops at five", () => {
    expect(extractTags("#Backend and #backend, #Go #sql #kafka #redis #extra")).toEqual(["backend", "go", "sql", "kafka", "redis"]);
  });
  it("ignores a lone # and numbers-first tags", () => expect(extractTags("# 1 #9lives #ok1")).toEqual(["ok1"]));
});

describe("safeUrl", () => {
  it("allows http and https only", () => {
    expect(safeUrl(" https://example.com/a ")).toBe("https://example.com/a");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,x")).toBeNull();
    expect(safeUrl("example.com")).toBeNull();
    expect(safeUrl(`https://e.com/${"a".repeat(600)}`)).toBeNull();
  });
});

describe("validatePost", () => {
  it("accepts a plain update and pulls its tags", () => {
    expect(validatePost({ kind: "update", body: "Shipped the migration #payments" })).toEqual({ ok: true, value: { kind: "update", title: null, body: "Shipped the migration #payments", link: null, tags: ["payments"] } });
  });
  it("needs a title for everything but an update, and a link for a resource", () => {
    expect(validatePost({ kind: "win", body: "x" })).toMatchObject({ ok: false, error: "Give your achievement a title." });
    expect(validatePost({ kind: "project", body: "x" })).toMatchObject({ ok: false, error: "Give your project a title." });
    expect(validatePost({ kind: "ask", body: "x" })).toMatchObject({ ok: false, error: "Give your question a title." });
    expect(validatePost({ kind: "resource", title: "Guide", body: "x" })).toMatchObject({ ok: false, error: "Add the link to the resource." });
    expect(validatePost({ kind: "resource", title: "Guide", body: "x", link: "https://e.com" }).ok).toBe(true);
  });
  it("refuses a bad link even on an update", () => expect(validatePost({ kind: "update", body: "x", link: "ftp://e.com" })).toMatchObject({ ok: false }));
  it("refuses empty, over-long and unknown input", () => {
    expect(validatePost({ kind: "update", body: "   " }).ok).toBe(false);
    expect(validatePost({ kind: "update", body: "x".repeat(2001) }).ok).toBe(false);
    expect(validatePost({ kind: "story", body: "x" }).ok).toBe(false);
    expect(validatePost(null).ok).toBe(false);
  });
});

describe("validateComment", () => {
  it("trims and bounds", () => {
    expect(validateComment("  hi ")).toEqual({ ok: true, value: "hi" });
    expect(validateComment("").ok).toBe(false);
    expect(validateComment("x".repeat(801)).ok).toBe(false);
  });
});

describe("trendingTags", () => {
  const NOW = new Date("2026-11-16T00:00:00Z");
  it("counts a tag once per post, only this week, most used first", () => {
    const posts = [
      { tags: ["go", "go", "sql"], created_at: "2026-11-15T00:00:00Z" },
      { tags: ["go"], created_at: "2026-11-14T00:00:00Z" },
      { tags: ["old"], created_at: "2026-10-01T00:00:00Z" },
    ];
    expect(trendingTags(posts, NOW)).toEqual([{ tag: "go", count: 2 }, { tag: "sql", count: 1 }]);
  });
});

describe("agoLabel", () => {
  const NOW = new Date("2026-11-16T12:00:00Z");
  it("reads like a person", () => {
    expect(["2026-11-16T12:00:00Z", "2026-11-16T11:55:00Z", "2026-11-16T09:00:00Z", "2026-11-15T09:00:00Z", "2026-11-13T12:00:00Z"].map((d) => agoLabel(d, NOW))).toEqual(["now", "5 min ago", "3 h ago", "yesterday", "3 days ago"]);
  });
});

describe("kinds and notes", () => {
  it("offers five kinds, labelled the way people say them", () => {
    expect(KINDS).toEqual(["update", "project", "resource", "ask", "win"]);
    expect(KINDS.map((k) => KIND_LABEL[k])).toEqual(["Update", "Project", "Resource", "Question", "Achievement"]);
  });
  it("keeps a note to one short line", () => {
    expect(validateNote("  Hiring a data engineer  ")).toEqual({ ok: true, value: "Hiring a data engineer" });
    expect(validateNote("").ok).toBe(false);
    expect(validateNote("x".repeat(161)).ok).toBe(false);
  });
});
