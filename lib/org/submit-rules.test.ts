import { describe, expect, it } from "vitest";
import { submitState } from "./submit-rules";

describe("submitState", () => {
  it("lets any member of a full or already-submitted group submit", () => {
    expect(submitState({ status: "active" }, false)).toBe("ready");
    expect(submitState({ status: "submitted" }, false)).toBe("ready");
  });
  it("lets only the lead submit a group that is still forming", () => {
    expect(submitState({ status: "forming" }, true)).toBe("small-lead");
    expect(submitState({ status: "forming" }, false)).toBe("small-wait");
  });
  it("locks a graded group", () => {
    expect(submitState({ status: "graded" }, true)).toBe("graded");
  });
});
