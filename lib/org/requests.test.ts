import { describe, expect, it } from "vitest";
import { isOpen, NewRequestSchema, RespondSchema } from "./requests";

const id = "11111111-1111-4111-8111-111111111111";

describe("campus visit requests", () => {
  it("accepts a complete invitation and drops an empty date", () => {
    const r = NewRequestSchema.parse({ companyId: id, role: "Software engineer", proposedDate: "", message: "Please visit us." });
    expect(r.proposedDate).toBeUndefined();
  });

  it("rejects an unknown field, so a caller cannot smuggle in a college id", () => {
    expect(NewRequestSchema.safeParse({ companyId: id, role: "Engineer", message: "Hi", collegeId: id }).success).toBe(false);
  });

  it("rejects a missing message and a bad date", () => {
    expect(NewRequestSchema.safeParse({ companyId: id, role: "Engineer", message: " " }).success).toBe(false);
    expect(NewRequestSchema.safeParse({ companyId: id, role: "Engineer", message: "Hi", proposedDate: "3 Nov" }).success).toBe(false);
  });

  it("only a waiting request can still be answered", () => {
    expect(isOpen("pending")).toBe(true);
    expect(["accepted", "declined", "cancelled"].some(isOpen)).toBe(false);
  });

  it("a reply is accept or decline only", () => {
    expect(RespondSchema.safeParse({ id, decision: "maybe" }).success).toBe(false);
    expect(RespondSchema.safeParse({ id, decision: "accept" }).success).toBe(true);
  });
});
