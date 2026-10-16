import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildBoard, type BoardAssignment } from "@/lib/workplace/sprint";
import type { SprintView } from "@/lib/workplace/sprint-server";
import { SprintBoard } from "./SprintBoard";

const ticket = (i: number, over: Partial<BoardAssignment> = {}): BoardAssignment => ({
  id: `a${i}`, title: `Ticket ${i} title`, areaName: "SQL", difficulty: "medium", kind: "trigger",
  completedAt: "2026-10-12T10:00:00Z", nextAvailableAt: "2026-10-13T10:00:00Z", ...over,
});
const view = (assignments: BoardAssignment[], now: string): SprintView => ({
  company: "BrightCart", story: { title: "Month-end close", blurb: "Finance is closing the books." }, weekStart: "2026-10-12", board: buildBoard({ assignments, now: new Date(now) }),
});
const html = (v: SprintView) => renderToStaticMarkup(createElement(SprintBoard, { sprint: v }));

describe("SprintBoard", () => {
  it("tells the story and the progress in words", () => {
    const out = html(view([ticket(1), ticket(2, { completedAt: null, nextAvailableAt: null })], "2026-10-13T12:00:00Z"));
    expect(out).toContain("This week at BrightCart: Month-end close");
    expect(out).toContain("Finance is closing the books.");
    expect(out).toContain("1 of 5 tickets done");
    expect(out).toContain('aria-label="Tickets this week"');
  });

  it("names each slot's state as text, not only colour, and shows the kind of work", () => {
    const out = html(view([ticket(1), ticket(2, { completedAt: null, nextAvailableAt: null })], "2026-10-13T12:00:00Z"));
    for (const word of ["Done", "In progress", "Locked"]) expect(out).toContain(word);
    expect(out).toContain("Ticket 1 title");
    expect(out).toContain("Write a trigger");
    expect(out).toContain("Intermediate");
    expect(out).toContain("Unlocks after the previous ticket");
  });

  it("shows a fresh week as one ticket ready and hides titles that do not exist yet", () => {
    const out = html(view([], "2026-10-13T12:00:00Z"));
    expect(out).toContain("Ready to start");
    expect(out).toContain("Your next ticket");
    expect(out).toContain("0 of 5 tickets done");
  });

  it("shows when the next ticket opens during the cooldown", () => {
    const out = html(view([ticket(1)], "2026-10-12T20:00:00Z"));
    expect(out).toContain("Opens soon");
  });
});
