import { describe, expect, it } from "vitest";
import { canMoveVisit } from "./visits";

describe("canMoveVisit", () => {
  it("never reopens a completed visit", () => {
    expect(canMoveVisit("completed", "registration_open")).toBe(false);
  });
  it("allows the moves the page offers", () => {
    expect(canMoveVisit("planned", "registration_open")).toBe(true);
    expect(canMoveVisit("cancelled", "registration_open")).toBe(true);
    expect(canMoveVisit("registration_open", "completed")).toBe(true);
    expect(canMoveVisit("completed", "cancelled")).toBe(true);
  });
});

import { registrationsToCsv } from "./visits";

describe("registrationsToCsv", () => {
  const row = { studentName: "Lakshmi Durga", rollNumber: "22MIC1A4501", branch: "Artificial Intelligence and Machine Learning (AI/ML)", endYear: 2027, email: "l@x.in", status: "submitted", registeredOn: "2026-11-01T05:00:00Z" };
  it("lists name, roll number, branch, class, email, status and date", () => {
    const [head, line] = registrationsToCsv([row]).split("\n");
    expect(head).toBe("S.No,Student,Roll number,Branch,Class of,Email,Status,Registered on");
    expect(line).toBe("1,Lakshmi Durga,22MIC1A4501,Artificial Intelligence and Machine Learning (AI/ML),2027,l@x.in,Registered,2026-11-01");
  });
  it("leaves a missing roll number blank and neutralises spreadsheet formulas in names", () => {
    const [, line] = registrationsToCsv([{ ...row, rollNumber: null, studentName: "=HYPERLINK(1)" }]).split("\n");
    expect(line.startsWith("1,'=HYPERLINK(1),,")).toBe(true);
  });
});
