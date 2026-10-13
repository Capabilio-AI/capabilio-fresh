import { describe, expect, it } from "vitest";
import { canSelfDelete, isDeleteConfirmed } from "./deletion";

describe("canSelfDelete", () => {
  it("allows students and professionals only", () => {
    expect(canSelfDelete("student")).toBe(true);
    expect(canSelfDelete("professional")).toBe(true);
    for (const role of ["tpo", "principal", "company_admin", "faculty", "", null, undefined]) expect(canSelfDelete(role)).toBe(false);
  });
});

describe("isDeleteConfirmed", () => {
  it("needs the exact phrase", () => {
    expect(isDeleteConfirmed("DELETE")).toBe(true);
    expect(isDeleteConfirmed("  DELETE ")).toBe(true);
    expect(isDeleteConfirmed("delete")).toBe(false);
    expect(isDeleteConfirmed("")).toBe(false);
  });
});
