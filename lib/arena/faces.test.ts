import { describe, expect, it } from "vitest";
import { faceFor } from "./faces";

describe("faceFor", () => {
  it("gives the same student the same face every time", () => {
    expect(faceFor("065df54c-18f7-4a11-bc4f-d4aaba4ff40b")).toBe(faceFor("065df54c-18f7-4a11-bc4f-d4aaba4ff40b"));
  });

  it("spreads students over many different faces", () => {
    const faces = new Set(Array.from({ length: 200 }, (_, i) => faceFor(`student-${i}`)));
    expect(faces.size).toBeGreaterThan(10);
  });

  it("always returns a face, even for an empty id", () => {
    expect(faceFor("")).toBeTruthy();
  });
});
