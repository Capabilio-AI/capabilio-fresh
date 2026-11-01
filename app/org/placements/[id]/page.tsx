import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Globe } from "lucide-react";
import { orgPageContext } from "@/lib/org/page";
import { untyped } from "@/lib/org/db";
import { REGISTRATION_LABEL, VISIT_STATUS } from "@/lib/org/visits";
import { JsonForm } from "@/components/org/JsonForm";
import { loadRegistrantProof } from "@/lib/org/registrations";
import { ActionButton } from "@/components/org/ActionButton";
import { LetterUpload } from "@/components/org/LetterUpload";
import { OfferForm } from "@/components/org/OfferForm";
import { Collapsible, EmptyState, PageHeader, Panel, Pill } from "@/components/org/ui";

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
  company_website: string | null;
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

  const [{ data: apps, error: appsError }, placements] = await Promise.all([
    service.from("applications").select("id, user_id, status, applied_at").eq("opportunity_id", visit.id).order("applied_at"),
    db.from("org_placements").select("id, student_user_id, offer_letter_path, student_response").eq("opportunity_id", visit.id),
  ]);
  if (appsError) throw new Error(`Registrations load failed: ${appsError.message}`);
  const rows = apps ?? [];
  const ids = rows.map((r) => r.user_id);
  const [profiles, memberships] = await Promise.all([
    ids.length ? service.from("profiles").select("id, full_name, email").in("id", ids) : Promise.resolve({ data: [] }),
    ids.length ? untyped(service).from("institution_memberships").select("user_id, branch, end_year, roll_number").eq("institution_id", ctx.institutionId).in("user_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const proof = await loadRegistrantProof(service, ids);
  const names = new Map((profiles.data ?? []).map((p) => [p.id, p.full_name ?? p.email]));
  const meta = new Map(((memberships.data ?? []) as { user_id: string; branch: string | null; end_year: number | null; roll_number: string | null }[]).map((m) => [m.user_id, m]));
  const placed = new Map(((placements.data ?? []) as { id: string; student_user_id: string; offer_letter_path: string | null; student_response: string }[]).map((p) => [p.student_user_id, p]));
  const st = VISIT_STATUS[visit.drive_status] ?? VISIT_STATUS.registration_open;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/org/placements" className="inline-flex items-center gap-1.5 font-lp-body text-[12.5px] text-app-muted hover:text-app-charcoal">
          <ArrowLeft size={13} aria-hidden="true" /> Back to company visits
        </Link>
      </div>
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
            <ActionButton action="/api/org/placements/delete" body={{ opportunityId: visit.id }} label="Delete visit" variant="danger" redirectTo="/org/placements" confirm="Delete this company visit? Registrations are removed and registered students are told. This can't be undone." />
          </div>
        }
      />

      {visit.drive_status !== "completed" && visit.drive_status !== "cancelled" && (
        <Collapsible title="Edit visit details">
          <JsonForm
            action="/api/org/placements/update"
            extra={{ opportunityId: visit.id }}
            submitLabel="Save changes"
            successMessage={rows.length > 0 ? "Saved. The students who registered have been notified of what changed." : "Saved."}
            resetOnSuccess={false}
            fields={[
              { name: "role", label: "Role(s) they are hiring for", defaultValue: visit.role },
              { name: "companyWebsite", label: "Company website", defaultValue: visit.company_website ?? "", placeholder: "infosys.com" },
              { name: "driveDate", label: "Visit date", type: "date", defaultValue: visit.drive_date ?? "" },
              { name: "deadline", label: "Registration closes", type: "date", defaultValue: visit.deadline ?? "" },
              { name: "ctcOffered", label: "Package", defaultValue: visit.ctc_offered ?? "" },
              { name: "location", label: "Where (campus or online)", defaultValue: visit.location ?? "" },
              { name: "eligibleBranches", label: "Open to branches (comma-separated; type all for every branch)", type: "list", defaultValue: visit.eligible_branches?.join(", ") ?? "all" },
              { name: "eligibility", label: "Eligibility and selection process", type: "textarea", defaultValue: visit.eligibility ?? "" },
            ]}
          />
        </Collapsible>
      )}

      {visit.company_website && (
        <p className="-mt-3 text-[13px]">
          <a href={visit.company_website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-bold text-app-charcoal underline underline-offset-2">
            <Globe size={13} aria-hidden="true" /> Company website
          </a>
        </p>
      )}

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
          <>
          <p className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-app-muted">
            Name, roll number, branch, class and email for each registered student.
            <a href={`/api/org/placements/registrations?visit=${visit.id}`} className="o-btn-ghost !py-1.5">Download list (CSV)</a>
          </p>
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
                        {m?.roll_number ? `${m.roll_number} · ` : "Roll no. not added · "}{m?.branch ?? "Branch not set"} · class of {m?.end_year ?? "—"}
                      </p>
                      {proof.get(a.user_id)?.targetRole && (
                        <p className="text-[11.5px] text-app-muted">
                          Working toward {proof.get(a.user_id)?.targetRole}
                          {proof.get(a.user_id)?.elo != null ? ` · ELO ${proof.get(a.user_id)?.elo} (${proof.get(a.user_id)?.tier})` : ""}
                          {proof.get(a.user_id)?.passportUrl && (
                            <>
                              {" · "}
                              <a href={proof.get(a.user_id)?.passportUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="font-bold underline">Skill Passport</a>
                            </>
                          )}
                        </p>
                      )}
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
                        The company selected this student. When they release the offer, record it here and attach the offer letter. The student is notified in Launchpad, can open the letter, and accepts or declines there.
                      </p>
                      <OfferForm applicationId={a.id} company={visit.company} role={visit.role} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          </>
        )}
      </Panel>
    </div>
  );
}
