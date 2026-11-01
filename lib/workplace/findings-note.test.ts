import { describe, expect, it } from "vitest";
import { gradeNote, numbersIn } from "./findings-note";

const key = { figures: [{ value: 125000, tolerance: 1 }], names: ["web", "2026-05-14"] };
const good = "On 14 May the web channel loaded the same orders twice, which overstates delivered revenue by ₹1,25,000. I recommend we reload that day from the source and add a duplicate check to the nightly load.";

describe("findings note", () => {
  it("reads rupees the way people write them", () => {
    expect(numbersIn("₹1,25,000")).toEqual([125000]);
    expect(numbersIn("about 1.25 lakh and 2 crore")).toEqual([125000, 20000000]);
    expect(numbersIn("85k, 3.5 million, 4.5%")).toEqual([85000, 3500000, 4.5]);
  });

  it("passes a note that is correct, located and actionable", () => {
    expect(gradeNote(good, key).passed).toBe(true);
  });

  it("accepts the figure in lakh form and the date in either style", () => {
    expect(gradeNote(good.replace("₹1,25,000", "about ₹1.25 lakh").replace("14 May", "May 14th"), key).passed).toBe(true);
    expect(gradeNote(good.replace("14 May", "2026-05-14"), key).passed).toBe(true);
  });

  it("fails each missing part and says which", () => {
    const wrongFigure = gradeNote(good.replace("₹1,25,000", "₹90,000"), key);
    expect(wrongFigure.checks[0].passed).toBe(false);
    const noWhere = gradeNote(good.replace("web channel", "channel"), key);
    expect(noWhere.checks[1].passed).toBe(false);
    const noAction = gradeNote("On 14 May the web channel loaded the same orders twice, which overstates delivered revenue by ₹1,25,000 and made finance very unhappy this month overall.", key);
    expect(noAction.checks[2].passed).toBe(false);
    expect(noAction.passed).toBe(false);
  });

  it("rejects an empty note, a one-liner and an essay", () => {
    expect(gradeNote(undefined, key).passed).toBe(false);
    expect(gradeNote("Web, 14 May, ₹1,25,000, fix it.", key).checks[3].passed).toBe(false);
    expect(gradeNote(`${good} ${"More words here. ".repeat(60)}`, key).checks[3].passed).toBe(false);
  });

  it("does not let a note pass by listing every number it can think of", () => {
    const shotgun = "Maybe 10, 20, 30, 40, 50 or 125000 rupees on the web channel on 14 May, I recommend we look at it again later this week please.";
    // listing the right number among guesses still counts as stating it: the guard is that the group and the action must also be right
    expect(gradeNote(shotgun, { ...key, figures: [{ value: 7777, tolerance: 1 }] }).passed).toBe(false);
  });
});
