import { describe, expect, it } from "vitest";
import { detailOf, headlineOf, taglineOf } from "./people";

describe("headlineOf", () => {
  it("says Role @ College for students and staff", () => {
    expect(headlineOf({ role: "student", institution: "Amrita Sai Institute", branch: "CSE", endYear: 2027 })).toBe("Student @ Amrita Sai Institute");
    expect(headlineOf({ role: "tpo", institution: "Amrita Sai Institute", branch: null, endYear: null })).toBe("TPO @ Amrita Sai Institute");
    expect(headlineOf({ role: "principal", institution: "Amrita Sai Institute", branch: null, endYear: null })).toBe("Principal @ Amrita Sai Institute");
    expect(headlineOf({ role: "hod", institution: "Amrita Sai Institute", branch: "CSE", endYear: null })).toBe("HoD @ Amrita Sai Institute");
  });
  it("copes with missing parts", () => {
    expect(headlineOf({ role: "student", institution: null, branch: null, endYear: null })).toBe("Student");
    expect(headlineOf(null)).toBeNull();
  });
});

describe("detailOf and taglineOf", () => {
  it("gives branch and batch for students, branch for staff", () => {
    expect(detailOf({ role: "student", branch: " CSE ", endYear: 2027 })).toBe("CSE · Class of 2027");
    expect(detailOf({ role: "hod", branch: "ECE", endYear: 2030 })).toBe("ECE");
    expect(detailOf({ role: "principal", branch: null, endYear: null })).toBeNull();
  });
  it("shows a career goal as Aspiring ...", () => {
    expect(taglineOf("AI/ML Engineer")).toBe("Aspiring AI/ML Engineer");
    expect(taglineOf(null)).toBeNull();
    expect(taglineOf("  ")).toBeNull();
  });
});
