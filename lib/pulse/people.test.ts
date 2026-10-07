import { describe, expect, it } from "vitest";
import { headlineOf } from "./people";

describe("headlineOf", () => {
  it("describes a student by college, branch and batch", () => {
    expect(headlineOf({ role: "student", institution: "Amrita Sai Institute", branch: "CSE", endYear: 2027 })).toBe("Amrita Sai Institute · CSE · Class of 2027");
  });
  it("describes staff by role and college, and skips what is missing", () => {
    expect(headlineOf({ role: "hod", institution: "Amrita Sai Institute", branch: "CSE", endYear: null })).toBe("Head of Department · Amrita Sai Institute");
    expect(headlineOf({ role: "student", institution: null, branch: null, endYear: null })).toBeNull();
    expect(headlineOf(null)).toBeNull();
  });
});
