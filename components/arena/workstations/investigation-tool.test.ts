import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { InvestigationContent } from "@/lib/arena-workstations/tools/investigation";
import { InvestigationTool } from "./InvestigationTool";

const content: InvestigationContent = {
  company: "BrightCart", kind: "incident", mode: "query", engine: "sqlite", deliverable: "",
  tables: [{ name: "orders", columns: [{ name: "order_id", type: "number" }], rows: [[1], [2]] }],
  fields: [
    { key: "fault", label: "What is wrong with the data?", type: "choice", options: ["Orders were loaded twice", "Orders are missing"] },
    { key: "where", label: "Where is it?", help: "A date as YYYY-MM-DD.", type: "text", placeholder: "YYYY-MM-DD" },
    { key: "impact", label: "By how much is the dashboard overstated?", type: "number", unit: "₹" },
  ],
};
const html = (over: Partial<{ closed: boolean }> = {}) => renderToStaticMarkup(createElement(InvestigationTool, { attemptId: "a1", content, closed: over.closed ?? false, submitting: false, onSubmit: () => {} }));

describe("InvestigationTool", () => {
  it("shows the data, an SQL box, and a form with every question", () => {
    const out = html();
    expect(out).toContain("The company&#x27;s data");
    expect(out).toContain("orders");
    expect(out).toContain("explore.sql");
    expect(out).toContain("Your incident report");
    for (const label of ["What is wrong with the data?", "Where is it?", "By how much is the dashboard overstated?"]) expect(out).toContain(label);
    expect(out).toContain("Orders were loaded twice");
    expect(out).toContain("Submit findings");
  });

  it("cannot be submitted until every finding is filled, and closes cleanly", () => {
    expect(html()).toMatch(/<button[^>]*disabled=""[^>]*>[^]*Submit findings/);
    const closed = html({ closed: true });
    expect(closed).not.toContain("Submit findings");
    expect(closed).not.toContain("Run query");
  });
});
