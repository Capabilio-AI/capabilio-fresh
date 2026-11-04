export interface ClassProject {
  title: string;
  grade: string;
  subject: string | null;
  groupSize: number | null;
  gradedBy: string;
  gradedAt: string | null;
  /** the submitted link, when the group submitted one */
  link: string | null;
}

interface EvidenceLike {
  evidence_type: string | null;
  source_url: string | null;
  observed_at: string | null;
  created_at: string;
  metadata: unknown;
}

const ROLE_LABEL: Record<string, string> = { faculty: "Faculty", hod: "HoD", principal: "Principal", vice_principal: "Vice principal" };

/**
 * Pure. Group projects graded by college staff, from the evidence written when a grade is recorded. Only the shared grade and its context
 * are read: the staff's private contribution notes are never part of this evidence.
 */
export function buildClassProjects(rows: EvidenceLike[]): ClassProject[] {
  return rows
    .filter((r) => r.evidence_type === "staff_graded_project")
    .map((r): ClassProject | null => {
      const m = (r.metadata ?? {}) as Record<string, unknown>;
      const title = typeof m.projectTitle === "string" ? m.projectTitle : null;
      const grade = typeof m.grade === "string" ? m.grade : null;
      if (!title || !grade) return null;
      return {
        title,
        grade,
        subject: typeof m.subject === "string" ? m.subject : null,
        groupSize: typeof m.groupSize === "number" ? m.groupSize : null,
        gradedBy: ROLE_LABEL[String(m.gradedByRole)] ?? "Staff",
        gradedAt: r.observed_at ?? r.created_at,
        link: r.source_url,
      };
    })
    .filter((p): p is ClassProject => p !== null)
    .sort((a, b) => (b.gradedAt ?? "").localeCompare(a.gradedAt ?? ""));
}
