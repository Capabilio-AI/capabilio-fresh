import { describe, expect, it } from "vitest";
import { fitWithin, photoProblem } from "./photos";

describe("photoProblem", () => {
  it("accepts JPG, PNG and WebP", () => expect(["image/jpeg", "image/png", "image/webp"].map((type) => photoProblem({ type, size: 1000 }))).toEqual([null, null, null]));
  it("refuses other types, empty and oversize files", () => {
    expect(photoProblem({ type: "image/gif", size: 1000 })).toContain("JPG");
    expect(photoProblem({ type: "image/png", size: 0 })).toContain("empty");
    expect(photoProblem({ type: "image/png", size: 6 * 1024 * 1024 })).toContain("over 5 MB");
  });
});

describe("fitWithin", () => {
  it("shrinks the longest side to the limit and keeps the ratio", () => expect(fitWithin(3200, 800, 1600)).toEqual({ w: 1600, h: 400 }));
  it("never enlarges", () => expect(fitWithin(300, 200, 512)).toEqual({ w: 300, h: 200 }));
});
