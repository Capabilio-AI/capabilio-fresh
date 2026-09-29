import { describe, expect, it } from "vitest";
import { pickTopRole } from "./reflection";

describe("pickTopRole (reflection uses real verified counts only)", () => {
  it("returns null with no engagement — the plain fallback prompt is used, nothing is inferred", () => {
    expect(pickTopRole([])).toBeNull();
    expect(pickTopRole([{ role_key: "data-analyst", verified_count: 0 }])).toBeNull();
  });
  it("sums per role and picks the highest", () => {
    expect(
      pickTopRole([
        { role_key: "data-analyst", verified_count: 2 },
        { role_key: "data-analyst", verified_count: 1 },
        { role_key: "other", verified_count: 2 },
      ])
    ).toEqual({ roleKey: "data-analyst", verifiedCount: 3 });
  });
});
