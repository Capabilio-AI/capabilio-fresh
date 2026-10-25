import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PersonalizationStatus } from "@/lib/personalization/status";
import { PersonalizationStatusView, nextDelay } from "./PersonalizationStatus";

const status = (over: Partial<PersonalizationStatus> = {}): PersonalizationStatus => ({
  career: { id: "c", name: "Embedded Systems Engineer" },
  settled: false,
  parts: [
    { key: "assessment", label: "Your assessment questions are ready", state: "ready" },
    { key: "pathway", label: "Preparing your learning pathway and Career Map", state: "preparing" },
    { key: "arena", label: "Arena practice for Embedded Systems Engineer is being developed", state: "unavailable" },
  ],
  ...over,
});
const html = (s: PersonalizationStatus, onRetry?: () => void) => renderToStaticMarkup(createElement(PersonalizationStatusView, { status: s, onRetry }));

describe("PersonalizationStatusView", () => {
  it("shows each real state in words, with no progress percentages", () => {
    const out = html(status());
    expect(out).toContain("Getting Embedded Systems Engineer ready");
    expect(out).toContain("Preparing your learning pathway and Career Map");
    expect(out).toContain("Arena practice for Embedded Systems Engineer is being developed");
    expect(out).not.toMatch(/\d+%/);
  });

  it("offers a retry only when something failed", () => {
    expect(html(status(), () => undefined)).not.toContain("Retry");
    const failed = status({ parts: [{ key: "pathway", label: "Your learning pathway is temporarily unavailable", state: "retry" }] });
    expect(html(failed, () => undefined)).toContain("Retry");
  });

  it("renders nothing without a chosen career", () => {
    expect(html(status({ career: null, parts: [] }))).toBe("");
  });
});

describe("nextDelay", () => {
  it("backs off and then holds", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 40].map(nextDelay)).toEqual([2000, 3000, 5000, 8000, 12000, 15000, 15000, 15000]);
  });
});
