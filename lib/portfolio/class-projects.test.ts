import { describe, expect, it } from "vitest";
import { buildClassProjects } from "./class-projects";

const row = (over: Partial<Parameters<typeof buildClassProjects>[0][number]> = {}) => ({ evidence_type: "staff_graded_project", source_url: "https://x.dev", observed_at: "2026-11-01T00:00:00Z", created_at: "2026-11-01T00:00:00Z", metadata: { projectTitle: "Campus Smart Resource Monitoring System", grade: "A", gradedByRole: "hod", groupSize: 4, subject: "IoT" }, ...over });

describe("buildClassProjects", () => {
  it("turns staff-graded evidence into portfolio entries, newest first", () => {
    const out = buildClassProjects([row({ observed_at: "2026-10-01T00:00:00Z" }), row(), row({ evidence_type: "github_repository" })]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ title: "Campus Smart Resource Monitoring System", grade: "A", gradedBy: "HoD", groupSize: 4, subject: "IoT" });
    expect(out[0].gradedAt).toBe("2026-11-01T00:00:00Z");
  });
  it("skips evidence that lacks a title or grade, and never exposes notes", () => {
    expect(buildClassProjects([row({ metadata: { grade: "A" } }), row({ metadata: { projectTitle: "P" } })])).toEqual([]);
    expect(JSON.stringify(buildClassProjects([row({ metadata: { projectTitle: "P", grade: "B", contributionNotes: "secret" } })]))).not.toContain("secret");
  });
});
