import { describe, expect, it } from "vitest";
import { askableMentors, feedbackCopy, mentorAnswerCopy } from "./project-notices";

describe("mentor notices", () => {
  it("passes the reason to the students on a rejection", () => {
    expect(mentorAnswerCopy("Dr Rao", "Cookie", false, "Full this semester").body).toBe("Reason: Full this semester");
    expect(mentorAnswerCopy("Dr Rao", "Cookie", true).title).toContain("will mentor");
  });
  it("only offers staff who have not declined or are not already asked", () => {
    const all = [{ membershipId: "a" }, { membershipId: "b" }, { membershipId: "c" }, { membershipId: "d" }];
    const reqs = [{ mentorMembershipId: "a", status: "rejected" }, { mentorMembershipId: "b", status: "pending" }, { mentorMembershipId: "c", status: "cancelled" }];
    expect(askableMentors(all, reqs).map((m) => m.membershipId)).toEqual(["c", "d"]);
  });
});

describe("feedbackCopy", () => {
  it("names the group and week and shortens long feedback", () => {
    const c = feedbackCopy("Dr Rao", "Cookie", 1, "x".repeat(300));
    expect(c.title).toBe("Dr Rao left feedback on Cookie, week 1");
    expect(c.body.length).toBeLessThanOrEqual(140);
  });
});
