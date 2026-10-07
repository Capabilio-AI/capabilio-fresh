import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ResourceSpec, linkWorks } from "./resource-import";
import { safeUrl } from "./resources";

describe("resources", () => {
  const file = JSON.parse(readFileSync("content/resources/learning.v1.json", "utf8")) as { items: unknown[] };
  it("every authored resource is well-formed, https, and tagged free or premium", () => {
    for (const i of file.items) expect(ResourceSpec.safeParse(i).success, JSON.stringify(i)).toBe(true);
    expect(new Set((file.items as { url: string }[]).map((i) => i.url)).size).toBe(file.items.length);
  });
  it("rejects a non-https link and an inverted level range", () => {
    const ok = { title: "Docs", provider: "Somebody", url: "https://example.org/x", type: "OFFICIAL", tier: "FREE", hours: 2, levelFrom: 0, levelTo: 50, skills: ["SQL"] };
    expect(ResourceSpec.safeParse(ok).success).toBe(true);
    expect(ResourceSpec.safeParse({ ...ok, url: "http://example.org" }).success).toBe(false);
    expect(ResourceSpec.safeParse({ ...ok, levelFrom: 60 }).success).toBe(false);
  });
  it("only counts a link that really loads", async () => {
    expect(await linkWorks("https://x.test", async () => new Response("", { status: 200 }))).toBe(true);
    expect(await linkWorks("https://x.test", async () => new Response("", { status: 404 }))).toBe(false);
    expect(await linkWorks("https://x.test", async () => { throw new Error("down"); })).toBe(false);
  });
  it("never links out to anything but https", () => {
    expect(safeUrl("https://a.org/x")).toBe("https://a.org/x");
    for (const bad of ["http://a.org", "javascript:alert(1)", "//a.org", null, "https://a b"]) expect(safeUrl(bad)).toBeNull();
  });
});
