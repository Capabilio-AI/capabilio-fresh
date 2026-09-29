import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loginHref, parseAuthPath, verifiedNext } from "./auth-path";

describe("auth path", () => {
  it("defaults to student for anything unknown", () => {
    for (const v of [undefined, "", "admin", "principal", ["organisation"]]) expect(parseAuthPath(v as never)).toBe("student");
    expect(parseAuthPath("organisation")).toBe("organisation");
  });
  it("org links carry the path; student links stay unchanged", () => {
    expect(loginHref("student")).toBe("/login");
    expect(loginHref("organisation")).toBe("/login?path=organisation");
    expect(verifiedNext("organisation")).toBe("/verified?path=organisation");
  });
  it("org email-confirmation redirect lands on the org verified screen; confirm route only redirects same-origin", () => {
    expect(readFileSync("app/api/org/signup/route.ts", "utf8")).toContain('verifiedNext("organisation")');
    expect(readFileSync("app/auth/confirm/route.ts", "utf8")).toContain('!requestedNext.startsWith("//")');
  });
});
