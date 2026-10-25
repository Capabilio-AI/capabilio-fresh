import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoleBuildingBanner } from "./RoleBuildingBanner";

describe("RoleBuildingBanner", () => {
  it("names the role and says its tasks are being designed, without promising a date", () => {
    const out = renderToStaticMarkup(createElement(RoleBuildingBanner, { careerName: "Embedded Systems Engineer" }));
    expect(out).toContain("We are designing the Embedded Systems Engineer tasks and challenges");
    expect(out).toContain("nothing from another role");
    expect(out).toContain('role="status"');
  });
});
