import { describe, expect, it } from "vitest";
import { visitOpenCopy } from "./visit-open";

describe("visitOpenCopy", () => {
  it("tells a student who can register where and by when", () => {
    const c = visitOpenCopy("Capabilio AI", "Data Analyst", "2026-11-10", true);
    expect(c.title).toBe("Capabilio AI is visiting your college");
    expect(c.body).toBe("Data Analyst · register by 2026-11-10. Register in Launchpad.");
  });

  it("leaves the deadline out when there is none", () => {
    expect(visitOpenCopy("Capabilio AI", "Data Analyst", null, true).body).toBe("Data Analyst. Register in Launchpad.");
  });

  it("tells an earlier-year student it is for final years, not to go register", () => {
    const c = visitOpenCopy("Capabilio AI", "Data Analyst", "2026-11-10", false);
    expect(c.body).toContain("final-year");
    expect(c.body).not.toContain("Register in Launchpad");
    expect(c.body).not.toContain("register by");
  });
});
