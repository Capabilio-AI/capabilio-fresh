import { describe, expect, it } from "vitest";
import { inviteHref, joinDecisionCopy, joinRequestCopy } from "./group-invite";

describe("group invite", () => {
  it("points the link at the project page, opened on the group", () => {
    expect(inviteHref("p1", "g1")).toBe("/arena/projects/p1?group=g1");
  });
  it("words the request and both decisions", () => {
    expect(joinRequestCopy("Asha", "Cookie").title).toBe("Asha wants to join Cookie");
    expect(joinDecisionCopy("Cookie", true).title).toContain("You're in");
    expect(joinDecisionCopy("Cookie", false).title).toContain("declined");
  });
});
