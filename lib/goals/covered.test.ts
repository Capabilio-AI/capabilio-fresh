import { describe, expect, it } from "vitest";
import { requestsCoveredBy, type OpenRequest } from "./covered";

const pathway = { key: "fashion-designer", name: "Fashion Designer", kind: "portfolio", aliases: ["fashion design"] };
const req = (id: string, goal_text: string, user_id = `u${id}`): OpenRequest => ({ id, user_id, goal_text });

describe("requestsCoveredBy", () => {
  it("covers every wording that names the pathway, and nothing else", () => {
    const hit = requestsCoveredBy([req("1", "I want to become a fashion designer"), req("2", "fashion design"), req("3", "deep sea diver"), req("4", "designer"), req("5", "Fashion Designer!")], pathway);
    expect(hit.map((r) => r.id)).toEqual(["1", "2", "5"]);
  });
  it("covers nothing when nobody asked", () => {
    expect(requestsCoveredBy([], pathway)).toEqual([]);
  });
});
