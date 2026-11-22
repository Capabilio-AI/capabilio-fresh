import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EXAMPLES, LearnSearch } from "./LearnSearch";
import { RoleCard } from "./RoleCard";
import { searchWords } from "@/lib/courses/find";

describe("LearnSearch", () => {
  const html = renderToStaticMarkup(h(LearnSearch, {}));
  it("is a plain form that submits the typed words to the results page, with no script needed", () => {
    expect(html).toContain('action="/skillstudio/courses/find"');
    expect(html).toContain('method="get"');
    expect(html).toContain('name="q"');
    expect(html).toContain("What do you want to learn?");
  });
  it("offers every example as a tap, and each example finds something to search for", () => {
    for (const e of EXAMPLES) {
      expect(html).toContain(`/skillstudio/courses/find?q=${encodeURIComponent(e)}`);
      expect(searchWords(e).length, e).toBeGreaterThan(0);
    }
  });
  it("shows the words already searched", () => {
    expect(renderToStaticMarkup(h(LearnSearch, { initial: "embedded systems" }))).toContain('value="embedded systems"');
  });
});

describe("RoleCard", () => {
  it("links to the job's path and shows how many topics it has", () => {
    const html = renderToStaticMarkup(h("ul", null, h(RoleCard, { roleKey: "embedded-systems-engineer", name: "Embedded Systems Engineer", topics: 39, note: "Includes: RTOS" })));
    expect(html).toContain('href="/skillstudio/courses/role/embedded-systems-engineer"');
    expect(html).toContain("Embedded Systems Engineer");
    expect(html).toContain("39");
    expect(html).toContain("Includes: RTOS");
    expect(html).toContain("See the path");
  });
});
