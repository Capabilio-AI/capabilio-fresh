import { describe, expect, test } from "vitest";
import { ProfileSchema } from "./schemas";

const base = { isPublic: false };
describe("ProfileSchema.collegeCode", () => {
  test("uppercases a valid code", () => {
    expect(ProfileSchema.parse({ ...base, collegeCode: " asist1 " }).collegeCode).toBe("ASIST1");
  });
  test("rejects symbols and too-short codes", () => {
    expect(ProfileSchema.safeParse({ ...base, collegeCode: "A-1" }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...base, collegeCode: "A" }).success).toBe(false);
  });
  test("blank means unchanged", () => {
    expect(ProfileSchema.parse({ ...base, collegeCode: "" }).collegeCode).toBeUndefined();
  });
});
