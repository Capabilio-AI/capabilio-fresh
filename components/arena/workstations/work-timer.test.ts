import { describe, expect, it } from "vitest";
import { formatClock } from "./WorkTimer";

describe("ticket clock display", () => {
  it("shows minutes and seconds, and hours only when there are some", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(480)).toBe("08:00");
    expect(formatClock(3725)).toBe("1:02:05");
  });
  it("never shows a negative clock", () => {
    expect(formatClock(-30)).toBe("00:00");
  });
});
