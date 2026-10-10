import { describe, expect, it } from "vitest";
import { generatePassportNumber, PASSPORT_NUMBER_PATTERN, spokenWords } from "./number";

describe("generatePassportNumber", () => {
  it("has the CAP-WORD-WORD-XXXX shape, without look-alike characters", () => {
    for (let i = 0; i < 200; i++) expect(generatePassportNumber()).toMatch(PASSPORT_NUMBER_PATTERN);
  });
  it("rarely repeats (the database index handles the rest)", () => {
    const seen = new Set(Array.from({ length: 2000 }, generatePassportNumber));
    expect(seen.size).toBeGreaterThan(1990);
  });
  it("says only the words aloud", () => expect(spokenWords("CAP-SWIFT-FALCON-7K2Q")).toBe("swift falcon"));
});
