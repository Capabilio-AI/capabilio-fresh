import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PUBLIC_TABS } from "./PublicCollegePage";

const read = (rel: string) => readFileSync(rel, "utf8");

describe("public college page shows no student data", () => {
  it("offers only Home, About and Events", () => {
    expect(PUBLIC_TABS.map((t) => t.id)).toEqual(["home", "about", "events"]);
  });
  it("the /o route does not load student counts, departments, the placement wall or profile checks", () => {
    const route = read("app/o/[slug]/page.tsx");
    expect(route).not.toMatch(/loadPlacementWall|loadOrgFacts/);
    const view = read("components/org/PublicCollegePage.tsx");
    // code only: the doc comment names what is left out
    const code = view.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toMatch(/\.studentCount|ProfileChecks|Profile checks|facts\.|wall\b/);
  });
});
