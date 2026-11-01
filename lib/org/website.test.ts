import { describe, expect, it } from "vitest";
import { normalizeWebsite } from "./website";

describe("normalizeWebsite", () => {
  it("adds https to what a college types", () => {
    expect(normalizeWebsite("infosys.com")).toBe("https://infosys.com");
    expect(normalizeWebsite("www.infosys.com/careers")).toBe("https://www.infosys.com/careers");
    expect(normalizeWebsite("  https://capabilio.online  ")).toBe("https://capabilio.online");
    expect(normalizeWebsite("http://example.co.in/a?b=1")).toBe("http://example.co.in/a?b=1");
  });
  it("rejects anything that is not a plain web address", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://files.example.com", "file:///etc/passwd", "not a url", "localhost", "https://user:pw@example.com", "", "   "]) {
      expect(normalizeWebsite(bad)).toBeNull();
    }
  });
  it("rejects absurdly long values", () => {
    expect(normalizeWebsite(`https://example.com/${"a".repeat(400)}`)).toBeNull();
  });
});
