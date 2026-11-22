import { describe, expect, it } from "vitest";
import { goalKey, goalWords, matchPathways, type PathwayCandidate } from "./match";

const pathways: PathwayCandidate[] = [
  { key: "civil-services", name: "Civil Services Examination", kind: "exam", aliases: ["UPSC", "IAS", "IPS"] },
  { key: "fashion-designer", name: "Fashion Designer", kind: "portfolio", aliases: ["fashion design", "apparel designer"] },
  { key: "chartered-accountant", name: "Chartered Accountant", kind: "credential", aliases: ["CA"] },
];

describe("goalWords and goalKey", () => {
  it("drops filler and punctuation", () => {
    expect(goalWords("I want to become a Fashion Designer!")).toEqual(["fashion", "designer"]);
  });
  it("gives the same key however the goal is worded", () => {
    expect(goalKey("I want to become a fashion designer")).toBe(goalKey("Fashion designer."));
  });
});

describe("matchPathways", () => {
  it("matches an alias exactly", () => {
    expect(matchPathways("UPSC", pathways)[0]).toMatchObject({ key: "civil-services", score: 1 });
    expect(matchPathways("I want to crack IAS", pathways)[0]?.key).toBe("civil-services");
  });
  it("matches the name however it is phrased, including a different word form", () => {
    expect(matchPathways("I want to become a fashion designer", pathways)[0]).toMatchObject({ key: "fashion-designer", score: 1 });
    expect(matchPathways("fashion designing", pathways)[0]?.key).toBe("fashion-designer");
  });
  it("matches when most of a name is typed, and not when only a little is", () => {
    expect(matchPathways("civil services", pathways)[0]?.key).toBe("civil-services");
    expect(matchPathways("designer", pathways)).toEqual([]);
    // half a name is too little: "accountant" is not necessarily the chartered route, so the box asks instead of guessing
    expect(matchPathways("accountant", pathways)).toEqual([]);
    expect(matchPathways("chartered accountant", pathways)[0]?.key).toBe("chartered-accountant");
  });
  it("returns nothing for a goal no pathway names, and for empty text", () => {
    expect(matchPathways("I want to be a deep sea diver", pathways)).toEqual([]);
    expect(matchPathways("   ", pathways)).toEqual([]);
  });
});
