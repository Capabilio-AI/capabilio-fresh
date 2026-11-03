import { describe, expect, it } from "vitest";
import { postTypeAllowed } from "./post-types";

describe("postTypeAllowed", () => {
  it("lets a college post events and announcements only", () => {
    expect(postTypeAllowed(false, "event")).toBe(true);
    expect(postTypeAllowed(false, "announcement")).toBe(true);
    for (const t of ["update", "hiring", "milestone", "x"]) expect(postTypeAllowed(false, t)).toBe(false);
  });
  it("lets a company post updates, hiring, milestones and events only", () => {
    for (const t of ["update", "hiring", "milestone", "event"]) expect(postTypeAllowed(true, t)).toBe(true);
    expect(postTypeAllowed(true, "announcement")).toBe(false);
  });
});
