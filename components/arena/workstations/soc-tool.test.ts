import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildShift } from "@/lib/workplace/soc/generator";
import { TECHNIQUES } from "@/lib/workplace/soc/types";
import { SocTool } from "./SocTool";
import { bucketHistogram, decisionProgress, EMPTY_FILTER, filterLogs, highlightSegments, secOfDay, shiftSpan, techniquesByTactic } from "./soc/helpers";

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

describe("soc helpers", () => {
  const logs = content.logs;
  const span = shiftSpan(logs);

  it("buckets every line exactly once and splits by source", () => {
    const b = bucketHistogram(logs, span, 16);
    expect(b).toHaveLength(16);
    expect(b.reduce((n, x) => n + x.total, 0)).toBe(logs.length);
    for (const x of b) expect(Object.values(x.bySource).reduce((n, v) => n + v, 0)).toBe(x.total);
  });

  it("filters by every word, source, host/user and time range", () => {
    const l = logs[Math.floor(logs.length / 2)];
    expect(filterLogs(logs, EMPTY_FILTER)).toHaveLength(logs.length);
    expect(filterLogs(logs, { ...EMPTY_FILTER, query: `${l.user.toUpperCase()} ${l.event}` }).map((x) => x.id)).toContain(l.id);
    expect(filterLogs(logs, { ...EMPTY_FILTER, query: "zzz-no-such-token" })).toHaveLength(0);
    expect(filterLogs(logs, { ...EMPTY_FILTER, source: l.source }).every((x) => x.source === l.source)).toBe(true);
    expect(filterLogs(logs, { ...EMPTY_FILTER, host: l.host, user: l.user }).every((x) => x.host === l.host && x.user === l.user)).toBe(true);
    const s = secOfDay(l.ts);
    const ranged = filterLogs(logs, { ...EMPTY_FILTER, range: { from: s, to: s + 1 } });
    expect(ranged.length).toBeGreaterThan(0);
    expect(ranged.every((x) => secOfDay(x.ts) === s)).toBe(true);
  });

  it("splits text into highlighted runs without losing characters", () => {
    const segs = highlightSegments("Failed login for a.b from 10.0.0.1", ["login", "10.0.0.1"]);
    expect(segs.map((s) => s.text).join("")).toBe("Failed login for a.b from 10.0.0.1");
    expect(segs.filter((s) => s.hit).map((s) => s.text)).toEqual(["login", "10.0.0.1"]);
    expect(highlightSegments("abc", [])).toEqual([{ text: "abc", hit: false }]);
  });

  it("counts the decisions made for an alert", () => {
    const ask = ["disposition", "severity", "technique", "action", "escalate", "evidence"] as const;
    expect(decisionProgress(undefined, ask)).toEqual({ done: 0, total: 6 });
    expect(decisionProgress({ disposition: "true_positive", escalate: false, evidence: ["L0001"] }, ask)).toEqual({ done: 3, total: 6 });
    expect(decisionProgress({ evidence: [] }, ["disposition", "evidence"])).toEqual({ done: 0, total: 2 });
  });

  it("groups every technique under a tactic", () => {
    const groups = techniquesByTactic();
    expect(groups.flatMap((g) => g.items)).toHaveLength(TECHNIQUES.length);
    expect(groups.find((g) => g.tactic === "Credential Access")?.items.map((t) => t.id)).toContain("T1110");
  });
});

describe("SocTool console", () => {
  it("renders the console chrome, filters, timeline and progress without leaking verdicts", () => {
    const out = html();
    for (const s of ["SOC CONSOLE", "Events over the shift", "Filter by log source", "0 of 6 decisions made", "Team runbook", "Alert detail"]) expect(out).toContain(s);
    expect(out).not.toMatch(/true_positive.*aria-pressed="true"/);
  });
});
