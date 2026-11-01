import { describe, expect, it } from "vitest";
import { closesOn, istToday, nextDay, reminderCopy, reminderWindow } from "./visit-reminders";

describe("visit reminders", () => {
  it("uses the Indian date, not the server's: 20:00 UTC on the 11th is already the 12th in India", () => {
    expect(istToday(new Date("2026-11-11T20:00:00Z"))).toBe("2026-11-12");
    expect(istToday(new Date("2026-11-11T10:00:00Z"))).toBe("2026-11-11");
  });

  it("steps over month ends", () => {
    expect(nextDay("2026-11-30")).toBe("2026-12-01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
  });

  it("is due the day before closing and the day it closes, and at no other time", () => {
    expect(reminderWindow("2026-11-12", "2026-11-11")).toBe("tomorrow");
    expect(reminderWindow("2026-11-12", "2026-11-12")).toBe("today");
    expect(reminderWindow("2026-11-12", "2026-11-10")).toBeNull();
    expect(reminderWindow("2026-11-12", "2026-11-13")).toBeNull();
    expect(reminderWindow(null, "2026-11-12")).toBeNull();
  });

  it("closes on the deadline when there is one, else on the visit day", () => {
    expect(closesOn({ deadline: "2026-11-10", drive_date: "2026-11-12" })).toBe("2026-11-10");
    expect(closesOn({ deadline: null, drive_date: "2026-11-12" })).toBe("2026-11-12");
    expect(closesOn({ deadline: null, drive_date: null })).toBeNull();
  });

  it("says what to do and by when", () => {
    expect(reminderCopy("Capabilio AI", "Data Analyst", "tomorrow").title).toBe("Registration closes tomorrow: Capabilio AI");
    expect(reminderCopy("Capabilio AI", "Data Analyst", "today").title).toBe("Last day to register: Capabilio AI");
  });
});
