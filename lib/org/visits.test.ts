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

import { describeVisitChanges, type VisitDetails } from "./visits";

describe("describeVisitChanges", () => {
  const base: VisitDetails = { role: "Data Analyst", location: "Seminar Hall A", ctc_offered: "10 LPA", drive_date: "2026-11-12", deadline: "2026-11-10", eligible_branches: null, eligibility: "60%+" };

  it("says nothing when nothing a student cares about changed", () => {
    expect(describeVisitChanges(base, { ...base })).toEqual([]);
    expect(describeVisitChanges(base, { ...base, eligibility: "60%+, no backlogs" })).toEqual([]);
  });

  it("reports each change as was to now, in plain words", () => {
    const out = describeVisitChanges(base, { ...base, drive_date: "2026-11-15", ctc_offered: "12 LPA", location: null });
    expect(out).toEqual(["Visit date: 12 Nov → 15 Nov", "Where: Seminar Hall A → not set", "Package: 10 LPA → 12 LPA"]);
  });

  it("reports a deadline that was added or moved", () => {
    expect(describeVisitChanges({ ...base, deadline: null }, base)).toEqual(["Registration closes: not set → 10 Nov"]);
  });

  it("reports branches changing between 'all' and a list", () => {
    expect(describeVisitChanges(base, { ...base, eligible_branches: ["CSE", "ECE"] })).toEqual(["Open to: all branches → CSE, ECE"]);
    expect(describeVisitChanges({ ...base, eligible_branches: ["CSE"] }, base)).toEqual(["Open to: CSE → all branches"]);
  });
});

import { canWithdraw } from "./visits";

describe("canWithdraw", () => {
  it("lets a student withdraw while registered or shortlisted and the visit is still going", () => {
    expect(canWithdraw("submitted", "registration_open")).toBe(true);
    expect(canWithdraw("shortlisted", "registration_open")).toBe(true);
  });
  it("does not once the college has decided or the visit has finished", () => {
    expect(canWithdraw("accepted", "registration_open")).toBe(false);
    expect(canWithdraw("rejected", "registration_open")).toBe(false);
    expect(canWithdraw("submitted", "completed")).toBe(false);
    expect(canWithdraw("submitted", "cancelled")).toBe(false);
  });
});

import { hasRollNumber } from "./visits";

describe("hasRollNumber", () => {
  it("needs a real value", () => {
    expect(hasRollNumber("23AJ5A0405")).toBe(true);
    expect(hasRollNumber(null)).toBe(false);
    expect(hasRollNumber(undefined)).toBe(false);
    expect(hasRollNumber("   ")).toBe(false);
  });
});
