import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrgContext } from "@/lib/org/context";
import { getViewerSummary } from "@/lib/dashboard/viewer";
import { loadStudentMaterials, loadStudentProjects } from "@/lib/org/loaders";
import { untyped } from "@/lib/org/db";
import { ActionButton } from "@/components/org/ActionButton";
import { EmptyState, Pill, formatDateTime } from "@/components/org/ui";

export const metadata: Metadata = { title: "Classroom — Capabilio AI" };

export default async function ClassroomPage() {
  const { supabase, user } = await requireAuthedUser();
  const ctx = await getOrgContext(supabase, user.id);
  if (!ctx || ctx.kind !== "student") notFound();
  const service = createServiceClient();
  const viewer = await getViewerSummary(supabase, user.id);
  const currentYear = viewer.direction?.academicYear?.year ?? null;
  const [materials, projects, placementsRes] = await Promise.all([
    loadStudentMaterials(service, ctx, currentYear),
    loadStudentProjects(service, ctx),
    untyped(service).from("org_placements").select("id, company, role_title, show_on_wall, offer_letter_path, student_response").eq("student_user_id", user.id).eq("institution_id", ctx.institutionId),
  ]);
  const placements = (placementsRes.data ?? []) as { id: string; company: string; role_title: string; show_on_wall: boolean; offer_letter_path: string | null; student_response: "pending" | "accepted" | "declined" }[];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Classroom</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        {ctx.institutionName}
        {ctx.branch ? ` · ${ctx.branch}` : ""}. Materials from your faculty and projects you can join.{" "}
        <Link href={`/o/${ctx.institutionSlug}`} className="text-app-blue hover:underline">
          Your institution&apos;s page
        </Link>
      </p>

      {placements.length > 0 && (
        <section className="mt-6 rounded-xl border border-app-border bg-white p-5" aria-label="Your placement">
          <h2 className="font-lp-body text-[15px] font-semibold text-app-charcoal">Congratulations — your offer was released</h2>
          <ul className="mt-3 flex flex-col gap-5">
            {placements.map((p) => (
              <li key={p.id} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-lp-body text-[14px] font-semibold text-app-charcoal">
                      {p.role_title} · {p.company}
                    </p>
                    <p className="font-lp-body text-[12px] text-app-muted">
                      {p.student_response === "accepted" ? "You accepted this offer." : p.student_response === "declined" ? "You declined this offer." : "Review the offer, then accept or decline. Your placement team sees your answer."}
                    </p>
                  </div>
                  {p.offer_letter_path && (
                    <a href={`/api/offer-letter/${p.id}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-app-border px-3 py-1.5 font-lp-body text-[12.5px] font-semibold text-app-blue hover:bg-black/5">
                      Open offer letter
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {p.student_response !== "accepted" && <ActionButton action="/api/classroom/placement-response" body={{ placementId: p.id, response: "accepted" }} label="Accept offer" />}
                  {p.student_response !== "declined" && <ActionButton action="/api/classroom/placement-response" body={{ placementId: p.id, response: "declined" }} label="Decline offer" variant="danger" confirm="Decline this offer?" />}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-app-border pt-3">
                  <p className="font-lp-body text-[12px] text-app-muted">
                    {p.show_on_wall ? "Shown on your college's public page (name, company and role — never your pay)." : "Not shown publicly. Only you and your placement team can see it."}
                  </p>
                  <ActionButton action="/api/classroom/placement-consent" body={{ placementId: p.id, show: !p.show_on_wall }} label={p.show_on_wall ? "Hide from public page" : "Show on public page"} variant="ghost" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="mb-3 mt-8 font-lp-body text-[15px] font-semibold text-app-charcoal">Projects</h2>
      {projects.length === 0 ? (
        <EmptyState title="No projects open to you" body="When faculty post a project for your department it appears here, and you can start or join a group of four." />
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/classroom/projects/${p.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-app-border bg-white p-4 hover:bg-black/[0.02]">
                <div>
                  <p className="font-lp-body text-[14px] font-semibold text-app-charcoal">{p.title}</p>
                  <p className="font-lp-mono text-[11px] text-app-muted">Due {formatDateTime(p.deadline_at)}</p>
                </div>
                {p.myGroup ? <Pill tone="ok">{p.myGroup.group.name} · {p.myGroup.group.status}</Pill> : <Pill tone={p.status === "open" ? "warn" : "neutral"}>{p.status === "open" ? "Not in a group" : p.status}</Pill>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-3 mt-8 font-lp-body text-[15px] font-semibold text-app-charcoal">Course materials{currentYear ? ` · Year ${currentYear}` : ""}</h2>
      {materials.length === 0 ? (
        <EmptyState title="No materials yet" body={ctx.branch ? "Faculty haven't shared anything for your branch and year yet." : "Add your branch to your profile to see materials for it."} />
      ) : (
        <ul className="divide-y divide-app-border rounded-xl border border-app-border bg-white">
          {materials.map((m) => (
            <li key={m.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-lp-body text-[13.5px] font-medium text-app-charcoal">{m.title}</p>
                <div className="flex items-center gap-2">
                  <Pill>{m.type}</Pill>
                  {m.url && (
                    <a href={m.url} target="_blank" rel="noopener noreferrer" className="font-lp-body text-[12.5px] text-app-blue hover:underline">
                      Open
                    </a>
                  )}
                </div>
              </div>
              {m.description && <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">{m.description}</p>}
              {m.type === "notes" && m.body && <p className="mt-2 whitespace-pre-wrap font-lp-body text-[13px] text-app-charcoal">{m.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
