import { describe, expect, it } from "vitest";
import { isFunctionMissing, parseAtomicSubmit } from "./atomic-submit";

describe("isFunctionMissing", () => {
  it("detects postgres and postgrest missing-function codes", () => {
    expect(isFunctionMissing({ code: "42883" })).toBe(true);
    expect(isFunctionMissing({ code: "PGRST202" })).toBe(true);
  });
  it("is false for other errors and no error", () => {
    expect(isFunctionMissing({ code: "23505" })).toBe(false);
    expect(isFunctionMissing(null)).toBe(false);
  });
});

describe("parseAtomicSubmit", () => {
  it("parses a valid result", () => {
    expect(parseAtomicSubmit({ conflict: false, awarded: true, completion_id: "x" })).toEqual({ conflict: false, awarded: true, completion_id: "x" });
  });
  it("rejects malformed data", () => {
    expect(parseAtomicSubmit(null)).toBeNull();
    expect(parseAtomicSubmit({ awarded: true })).toBeNull();
  });
});
