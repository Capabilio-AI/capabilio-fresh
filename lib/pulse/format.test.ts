import { describe, expect, it } from "vitest";
import { escapeLike, hashtagsOf, hoursLeft, initialsOf, legacyKind, relativeTime, splitTags } from "./format";

describe("hashtags", () => {
  it("finds tags, lower-cased and de-duplicated, ignoring # inside words and bare numbers", () => {
    expect(hashtagsOf("Built a #SQL dashboard #sql #Data_Analytics, issue#12 and #7")).toEqual(["sql", "data_analytics"]);
  });
  it("splits text so tags can be linked and nothing is lost", () => {
    const parts = splitTags("Shipped #React app today #win");
    expect(parts.map((p) => p.text).join("")).toBe("Shipped #React app today #win");
    expect(parts.filter((p) => p.tag).map((p) => p.tag)).toEqual(["react", "win"]);
  });
});

describe("escapeLike", () => {
  it("makes wildcards literal", () => {
    expect(escapeLike("100%_done\\")).toBe("100\\%\\_done\\\\");
  });
});

describe("legacyKind", () => {
  it("lifts the old text prefix into a kind", () => {
    expect(legacyKind("[Project] A thing")).toEqual({ kind: "project", content: "A thing" });
    expect(legacyKind("plain")).toEqual({ kind: "post", content: "plain" });
  });
});

describe("time and names", () => {
  const now = new Date("2026-10-07T12:00:00Z").getTime();
  it("formats relative time", () => {
    expect(relativeTime("2026-10-07T11:59:40Z", now)).toBe("just now");
    expect(relativeTime("2026-10-07T11:15:00Z", now)).toBe("45m");
    expect(relativeTime("2026-10-07T07:00:00Z", now)).toBe("5h");
    expect(relativeTime("2026-10-05T12:00:00Z", now)).toBe("2d");
  });
  it("counts story hours left, never below zero", () => {
    expect(hoursLeft("2026-10-07T20:30:00Z", now)).toBe(9);
    expect(hoursLeft("2026-10-07T10:00:00Z", now)).toBe(0);
  });
  it("makes initials", () => {
    expect(initialsOf("Akhila Chowdary")).toBe("AC");
    expect(initialsOf(null)).toBe("?");
  });
});
