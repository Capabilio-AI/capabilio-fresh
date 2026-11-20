import { describe, expect, it } from "vitest";
import { isSwitchPending, switchCompletion, type SwitchRow } from "./role-switch";

const A = "career-a";
const B = "career-b";
const NOW = "2026-11-17T10:00:00.000Z";
const row = (over: Partial<SwitchRow> = {}): SwitchRow => ({ primary_career_id: A, secondary_career_id: B, plan_b_kind: "change_role", plan_b_decided_at: null, ...over });

describe("role switch", () => {
  it("is pending only between confirming the new role and finishing its assessment", () => {
    expect(isSwitchPending(row())).toBe(true);
    expect(isSwitchPending(row({ plan_b_decided_at: NOW }))).toBe(false);
    expect(isSwitchPending(row({ plan_b_kind: "same_role" }))).toBe(false);
    expect(isSwitchPending(row({ secondary_career_id: null }))).toBe(false);
    expect(isSwitchPending(null)).toBe(false);
  });

  it("makes the new role the main role and keeps the old one when its assessment completes", () => {
    expect(switchCompletion(row(), B, NOW)).toEqual({ primary_career_id: B, secondary_career_id: A, plan_b_decided_at: NOW, last_updated: NOW });
  });

  it("changes nothing for another role, a retake of the old role, or a switch that already finished", () => {
    expect(switchCompletion(row(), A, NOW)).toBeNull();
    expect(switchCompletion(row(), "career-c", NOW)).toBeNull();
    expect(switchCompletion(row({ plan_b_decided_at: NOW }), B, NOW)).toBeNull();
    expect(switchCompletion(null, B, NOW)).toBeNull();
    expect(switchCompletion(row(), null, NOW)).toBeNull();
  });
});
