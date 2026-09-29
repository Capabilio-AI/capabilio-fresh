import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleX } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = { title: "Arena task — Capabilio AI" };

const TOOL_LABEL: Record<string, string> = {
  sql_workspace: "SQL workspace",
  statistics_workspace: "Statistics workspace",
  cleaning_workspace: "Data prep workspace",
  dashboard_workspace: "BI workspace",
  spreadsheet_workspace: "Excel workbook",
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

/** Evidence detail for one Arena attempt — the target of every Arena "View evidence" link. Owner-only. */
export default async function AttemptEvidencePage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { user } = await requireAuthedUser();
  const { attemptId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) notFound();

  const service = createServiceClient();
  // Ownership is enforced here (user_id = session user); answer keys are never selected.
  const { data: attempt } = await service
    .from("arena_domain_assignments")
    .select("id, role_key, skill_area_key, cycle_number, status, assigned_at, completed_at, submission, grade, submission_count, challenge_id")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!attempt) notFound();

  const [{ data: challenge }, { data: completion }, { data: area }] = await Promise.all([
    service.from("arena_challenges").select("title, requester, scenario, objective, category, difficulty, tool_type, content, generation_provider, generation_model, generation_version, grading_version, generated_at").eq("id", attempt.challenge_id).single(),
    service.from("arena_attempt_completions").select("completed_at, grading_version, evidence_id").eq("attempt_id", attemptId).maybeSingle(),
    service.from("arena_skill_areas").select("display_name").eq("role_key", attempt.role_key).eq("area_key", attempt.skill_area_key ?? "").maybeSingle(),
  ]);
  if (!challenge) notFound();

  const grade = attempt.grade as { passed: boolean; message: string; checks: { label: string; passed: boolean }[] } | null;
  const company = (challenge.content as { company?: string } | null)?.company;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/portfolio" className="inline-flex items-center gap-1.5 font-lp-body text-[13px] text-app-muted hover:text-app-charcoal">
        <ArrowLeft size={14} />
        Portfolio
      </Link>
      <p className="mt-4 font-lp-mono text-[11.5px] text-app-muted">
        {[company, area?.display_name, challenge.tool_type ? TOOL_LABEL[challenge.tool_type] : null].filter(Boolean).join(" · ")}
      </p>
      <h1 className="mt-1 font-lp-display text-[24px] font-semibold text-app-charcoal">{challenge.title}</h1>
      <p className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-lp-body text-[12.5px] font-semibold ${completion ? "bg-app-success-container text-app-success" : "bg-app-attention-container text-app-attention"}`}>
        {completion ? <CheckCircle2 size={14} /> : <CircleX size={14} />}
        {completion ? `Verified Arena submission · ${fmt(completion.completed_at)}` : "Not yet verified"}
      </p>

      <section className="mt-6 rounded-xl border border-app-border bg-white p-5">
        <h2 className="font-lp-body text-[13px] font-semibold text-app-charcoal">The request</h2>
        {challenge.requester && <p className="mt-1 font-lp-mono text-[11.5px] text-app-muted">From {challenge.requester}</p>}
        <p className="mt-2 font-lp-body text-[13.5px] leading-relaxed text-app-charcoal">{challenge.scenario}</p>
        <ul className="mt-3 flex flex-col gap-1">
          {challenge.objective.split("\n").map((l, i) => (
            <li key={i} className="font-lp-body text-[13px] text-app-charcoal">
              {l.replace(/`/g, "")}
            </li>
          ))}
        </ul>
      </section>

      {grade && (
        <section className="mt-4 rounded-xl border border-app-border bg-white p-5">
          <h2 className="font-lp-body text-[13px] font-semibold text-app-charcoal">Deterministic grading</h2>
          <p className="mt-1 font-lp-body text-[13px] text-app-charcoal">{grade.message}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {grade.checks.map((c) => (
              <li key={c.label} className={`font-lp-mono text-[12px] ${c.passed ? "text-app-success" : "text-app-rose"}`}>
                {c.passed ? "✓" : "✗"} {c.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      {attempt.submission && (
        <section className="mt-4 rounded-xl border border-app-border bg-white p-5">
          <h2 className="font-lp-body text-[13px] font-semibold text-app-charcoal">Submitted work</h2>
          <pre className="mt-2 max-h-[360px] overflow-auto whitespace-pre-wrap rounded-lg bg-app-background p-3 font-lp-mono text-[12px] text-app-charcoal">
            {typeof (attempt.submission as { query?: string }).query === "string" ? (attempt.submission as { query: string }).query : JSON.stringify(attempt.submission, null, 2)}
          </pre>
        </section>
      )}

      <section className="mt-4 rounded-xl border border-app-border bg-white p-5">
        <h2 className="font-lp-body text-[13px] font-semibold text-app-charcoal">Audit trail</h2>
        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 font-lp-mono text-[11.5px] sm:grid-cols-2">
          {[
            ["Assigned", fmt(attempt.assigned_at)],
            ["Verified", fmt(completion?.completed_at ?? null)],
            ["Rotation cycle", attempt.cycle_number ?? "—"],
            ["Submissions", attempt.submission_count],
            ["Difficulty", challenge.difficulty],
            ["Generated by", challenge.generation_provider ? `${challenge.generation_provider} · ${challenge.generation_model}` : "hand-authored (legacy)"],
            ["Generation version", challenge.generation_version ?? "—"],
            ["Grading version", completion?.grading_version ?? challenge.grading_version ?? "—"],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between gap-3 border-b border-app-border py-1">
              <dt className="text-app-muted">{k}</dt>
              <dd className="text-right text-app-charcoal">{String(v)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
