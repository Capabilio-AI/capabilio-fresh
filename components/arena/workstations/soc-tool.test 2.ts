import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildShift } from "@/lib/workplace/soc/generator";
import { SocTool } from "./SocTool";

const { content } = buildShift(8, ["brute_force", "impossible_travel"], ["severity", "technique", "action", "escalate", "evidence"]);
const html = (closed = false) => renderToStaticMarkup(createElement(SocTool, { attemptId: "a1", content, closed, submitting: false, onSubmit: () => {} }));

describe("SocTool", () => {
  it("shows the queue, the notice, the logs and every asked decision", () => {
    const out = html();
    for (const a of content.alerts) expect(out).toContain(a.id);
    expect(out).toContain("Training simulation");
    expect(out).toContain(content.logs[0].id);
    for (const label of ["Disposition", "Severity", "MITRE ATT&amp;CK technique", "Containment action", "Escalate to L2?", "Evidence cited", "Submit decisions"]) expect(out).toContain(label);
  });

  it("hides the submit form once the ticket is closed", () => {
    expect(html(true)).not.toContain("Submit decisions");
  });
});
