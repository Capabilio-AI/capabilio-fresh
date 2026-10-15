import { describe, expect, it } from "vitest";
import { namesMatch } from "./name-match";

describe("namesMatch", () => {
  it("accepts the same name in a different order, case or with a title", () => {
    expect(namesMatch("Asha Rao", "RAO ASHA")).toBe(true);
    expect(namesMatch("Asha Rao", "Dr. Asha Rao")).toBe(true);
  });
  it("accepts run-together and initial forms", () => {
    expect(namesMatch("Venkata Gopi Chand Kopuri", "Kopuri Venkata Gopichand")).toBe(true);
    expect(namesMatch("Asha Devi Rao", "Asha Rao")).toBe(true);
  });
  it("rejects a different person, even with a shared first name", () => {
    expect(namesMatch("John Smith", "John Doe")).toBe(false);
    expect(namesMatch("Asha Rao", "Priya Nair")).toBe(false);
  });
  it("never blocks when there is nothing to compare", () => {
    expect(namesMatch("", "Asha Rao")).toBe(true);
    expect(namesMatch("Asha Rao", "")).toBe(true);
  });
});
