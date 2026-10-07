import type { SubjectPriority } from "@/lib/roadmap-visual/coverage";

/** Which of the student's own subjects feed this career the most. It only ranks: every subject stays part of the degree. */
export function SubjectsPanel({ subjects, state }: { subjects: SubjectPriority[]; state: string }) {
  return (
    <details className="rounded-xl border border-app-border bg-white px-4 py-3" open={subjects.length > 0}>
      <summary className="cursor-pointer font-lp-body text-[14px] font-medium text-app-charcoal">Your college subjects that matter most for this career</summary>
      {subjects.length === 0 ? (
        <p className="mt-2 font-lp-body text-[13px] text-app-muted">{state === "PUBLISHED" ? "None of your syllabus subjects feed this career's topics yet, so nothing is ranked. Every subject is still part of your degree; the map shows what to learn alongside it." : "Once your college publishes its syllabus for your branch, your subjects are ranked here by how much they help this career."}</p>
      ) : (
        <>
          <p className="mt-1 font-lp-body text-[12px] text-app-muted">Every subject remains part of your degree. These rank higher because they teach topics this career needs and you haven&apos;t reached yet.</p>
          <ol className="mt-2 space-y-1.5">
            {subjects.slice(0, 10).map((s) => (
              <li key={s.courseId} className="font-lp-body text-[13px] text-app-charcoal">
                <span className="font-medium">{s.title}</span> <span className="text-app-muted">· {s.semester ? `Semester ${(s.year - 1) * 2 + s.semester}` : `Year ${s.year}`}{s.timing === "COMPLETED" ? " · done" : s.timing === "CURRENT" ? " · this semester" : s.timing === "UPCOMING" ? " · upcoming" : ""} · teaches {s.topics.map((t) => t.title).slice(0, 4).join(", ")}{s.topics.length > 4 ? ` +${s.topics.length - 4} more` : ""}{s.tier === "INFERRED" ? " (inferred by Capabilio)" : ""}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </details>
  );
}
