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
