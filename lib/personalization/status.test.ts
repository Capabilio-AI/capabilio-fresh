import { describe, expect, it } from "vitest";
import { arenaPart, assessmentPart, isSettled, pathwayPart } from "./status";

describe("personalization status", () => {
  it("reports the assessment questions as ready only once the pool covers a session", () => {
    expect(assessmentPart(21, 22).state).toBe("preparing");
    expect(assessmentPart(22, 22).state).toBe("ready");
  });

  it("maps each roadmap run state to what is really happening", () => {
    expect(pathwayPart("READY")).toMatchObject({ state: "ready", label: expect.stringContaining("ready") });
    expect(pathwayPart("RUNNING").state).toBe("preparing");
    expect(pathwayPart("FAILED").state).toBe("retry");
    expect(pathwayPart("IDLE").state).toBe("idle");
  });

  it("says Arena practice is being developed for a role without tasks, and makes no claim when it does not know", () => {
    expect(arenaPart({ state: "ready" }, "Data Analyst")).toMatchObject({ state: "ready" });
    expect(arenaPart({ state: "building", careerName: "Embedded Systems Engineer" }, "Embedded Systems Engineer")).toMatchObject({ state: "unavailable", label: "Arena practice for Embedded Systems Engineer is being developed" });
    expect(arenaPart({ state: "unknown" }, "Anything")).toBeNull();
  });

  it("is settled only when nothing is still being prepared; a retry or an unavailable Arena does not keep polling", () => {
    expect(isSettled([pathwayPart("RUNNING")])).toBe(false);
    expect(isSettled([pathwayPart("FAILED"), arenaPart({ state: "building", careerName: "X" }, "X")!, assessmentPart(30, 22)])).toBe(true);
  });
});
