import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { orgPageContext } from "@/lib/org/page";
import { untyped } from "@/lib/org/db";
import { REGISTRATION_LABEL, VISIT_STATUS } from "@/lib/org/visits";
import { ActionButton } from "@/components/org/ActionButton";
import { LetterUpload } from "@/components/org/LetterUpload";
import { OfferForm } from "@/components/org/OfferForm";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/org/ui";

export const metadata: Metadata = { title: "Company visit — Capabilio AI" };

const UUID = /^[0-9a-f-]{36}$/i;

interface Visit {
  id: string;
  company: string;
  role: string;
  location: string | null;
  opportunity_type: string;
  drive_date: string | null;
  drive_status: string;
  ctc_offered: string | null;
  deadline: string | null;
  eligible_branches: string[] | null;
  eligibility: string | null;
}

const RESPONSE: Record<string, { label: string; tone: "ok" | "warn" | "neutral" }> = {
  pending: { label: "Awaiting student's answer", tone: "warn" },
  accepted: { label: "Student accepted", tone: "ok" },
  declined: { label: "Student declined", tone: "neutral" },
};

export default async function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { ctx, service } = await orgPageContext("postPlacement");
  const db = untyped(service);
  const { data } = await db.from("opportunities").select("*").eq("id", id).eq("institution_id", ctx.institutionId).maybeSingle();
  const visit = data as Visit | null;
  if (!visit) notFound();

  const { data: apps } = await service.from("applications").select("id, user_id, status, applied_at").eq("opportunity_id", visit.id).order("applied_at");
  const rows = apps ?? [];
  const ids = rows.map((r) => r.user_id);
  const [profiles, memberships, placements] = await Promise.all([
    ids.length ? service.from("profiles").select("id, full_name, email").in("id", ids) : Promise.resolve({ data: [] }),
    ids.length ? service.from("institution_memberships").select("user_id, branch, end_year").eq("institution_id", ctx.institutionId).in("user_id", ids) : Promise.resolve({ data: [] }),
    db.from("org_placements").select("id, student_user_id, offer_letter_path, student_response").eq("opportunity_id", visit.id),
  ]);
  const names = new Map((profiles.data ?? []).map((p) => [p.id, p.full_name ?? p.email]));
  const meta = new Map((memberships.data ?? []).map((m) => [m.user_id, m]));
  const placed = new Map(((placements.data ?? []) as { id: string; student_user_id: string; offer_letter_path: string | null; student_response: string }[]).map((p) => [p.student_user_id, p]));
  const st = VISIT_STATUS[visit.drive_status] ?? VISIT_STATUS.registration_open;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={visit.company}
        subtitle={`${visit.role}${visit.drive_date ? ` · ${new Date(visit.drive_date).toLocaleDateString("en-IN", { dateStyle: "medium" })}` : ""}${visit.location ? ` · ${visit.location}` : ""}${visit.ctc_offered ? ` · ${visit.ctc_offered}` : ""}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={st.tone}>{st.label}</Pill>
            {visit.drive_status !== "registration_open" && visit.drive_status !== "completed" && <ActionButton action="/api/org/placements/status" body={{ opportunityId: visit.id, status: "registration_open" }} label="Open registration" />}
            {visit.drive_status === "registration_open" && <ActionButton action="/api/org/placements/status" body={{ opportunityId: visit.id, status: "completed" }} label="Mark visit completed" variant="ghost" />}
            {visit.drive_status !== "cancelled" && visit.drive_status !== "completed" && (
              <ActionButton action="/api/org/placements/status" body={{ opportunityId: visit.id, status: "cancelled" }} label="Cancel visit" variant="danger" confirm="Cancel this company visit? Students can no longer register." />
            )}
            <Link href="/org/placements" className="text-[13px] font-semibold text-app-muted hover:text-app-charcoal">
              All visits
            </Link>
          </div>
        }
      />

      {(visit.eligibility || visit.eligible_branches?.length || visit.deadline) && (
        <Panel title="Eligibility">
          <dl className="grid grid-cols-1 gap-4 text-[13px] sm:grid-cols-3">
            <div>
              <dt className="o-eyebrow">Open to</dt>
              <dd className="mt-1 text-app-charcoal">{visit.eligible_branches?.length ? visit.eligible_branches.join(", ") : "All branches"}</dd>
            </div>
            <div>
              <dt className="o-eyebrow">Registration closes</dt>
              <dd className="mt-1 text-app-charcoal">{visit.deadline ? new Date(visit.deadline).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "No deadline"}</dd>
            </div>
            {visit.eligibility && (
              <div className="sm:col-span-3">
                <dt className="o-eyebrow">Criteria and process</dt>
                <dd className="mt-1 whitespace-pre-wrap text-app-charcoal">{visit.eligibility}</dd>
              </div>
            )}
          </dl>
        </Panel>
      )}

      <Panel title={`Registered students (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyState title="No one has registered yet" body="Final-year students of eligible branches see this visit in Launchpad and can register there." />
        ) : (
          <ul className="divide-y divide-app-border">
            {rows.map((a) => {
              const m = meta.get(a.user_id);
              const placement = placed.get(a.user_id);
              return (
                <li key={a.id} className="py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[13.5px] font-bold text-app-charcoal">{names.get(a.user_id) ?? "Student"}</p>
                      <p className="text-[11.5px] text-app-muted">
                        {m?.branch ?? "Branch not set"} · class of {m?.end_year ?? "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={a.status === "accepted" ? "ok" : a.status === "rejected" ? "neutral" : "warn"}>{placement ? "Offer released" : (REGISTRATION_LABEL[a.status] ?? a.status)}</Pill>
                      {!placement && a.status !== "shortlisted" && a.status !== "accepted" && <ActionButton action="/api/org/applications/status" body={{ applicationId: a.id, status: "shortlisted" }} label="Shortlist" variant="ghost" />}
                      {!placement && a.status !== "accepted" && <ActionButton action="/api/org/applications/status" body={{ applicationId: a.id, status: "accepted" }} label="Mark selected" />}
                      {!placement && a.status !== "rejected" && <ActionButton action="/api/org/applications/status" body={{ applicationId: a.id, status: "rejected" }} label="Not selected" variant="danger" confirm="Mark this student as not selected?" />}
                    </div>
                  </div>

                  {placement && (
                    <p className="mt-2.5 flex flex-wrap items-center gap-2">
                      <Pill tone={RESPONSE[placement.student_response]?.tone ?? "neutral"}>{RESPONSE[placement.student_response]?.label ?? placement.student_response}</Pill>
                      {placement.offer_letter_path ? (
                        <>
                          <a href={`/api/offer-letter/${placement.id}`} target="_blank" rel="noopener noreferrer" className="o-btn-ghost !py-1.5">
                            <FileText size={13} aria-hidden="true" /> Offer letter
                          </a>
                          <LetterUpload placementId={placement.id} replace />
                        </>
                      ) : (
                        <>
                          <span className="text-[11.5px] text-app-muted">No letter attached</span>
                          <LetterUpload placementId={placement.id} />
                        </>
                      )}
                    </p>
                  )}

                  {a.status === "accepted" && !placement && (
                    <div className="mt-3 rounded-2xl border border-app-border bg-white/[0.03] p-4">
                      <p className="mb-3 text-[12.5px] leading-relaxed text-app-muted">
                        The company selected this student. When they release the offer, record it here and attach the offer letter. The student is notified in their Classroom, can open the letter, and accepts or declines there.
                      </p>
                      <OfferForm applicationId={a.id} company={visit.company} role={visit.role} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
