import { describe, expect, it } from "vitest";
import { mainRoleRatings } from "./leaderboard-rules";

const ledger = [
  { student_id: "a", career_id: "analyst", rating: 512 },
  { student_id: "a", career_id: "scientist", rating: 408.4 },
  { student_id: "b", career_id: "analyst", rating: 450 },
  { student_id: "c", career_id: "scientist", rating: 700 },
];

describe("mainRoleRatings", () => {
  it("uses the rating on the student's main role, not their highest", () => {
    const out = mainRoleRatings(ledger, new Map([["a", "scientist"], ["b", "analyst"]]));
    expect(out).toEqual([{ user_id: "a", rating: 408 }, { user_id: "b", rating: 450 }]);
  });
  it("leaves out a student with no main role or no rating on it", () => {
    expect(mainRoleRatings(ledger, new Map([["c", "analyst"]]))).toEqual([]);
  });
});
