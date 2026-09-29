import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { orgPageContext } from "@/lib/org/page";
import { untyped } from "@/lib/org/db";
import { ActionButton } from "@/components/org/ActionButton";
import { JsonForm } from "@/components/org/JsonForm";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/org/ui";

export const metadata: Metadata = { title: "Drive — Capabilio AI" };

const UUID = /^[0-9a-f-]{36}$/i;
const STATUS_LABEL: Record<string, string> = { submitted: "Applied", shortlisted: "Shortlisted", accepted: "Selected", rejected: "Rejected" };

export default async function DrivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { ctx, service } = await orgPageContext("postPlacement");
  const { data: drive } = await service.from("opportunities").select("*").eq("id", id).eq("institution_id", ctx.institutionId).maybeSingle();
  if (!drive) notFound();

  const { data: apps } = await service.from("applications").select("id, user_id, status, applied_at").eq("opportunity_id", drive.id).order("applied_at");
  const rows = apps ?? [];
  const ids = rows.map((r) => r.user_id);
  const [profiles, memberships, placements] = await Promise.all([
    ids.length ? service.from("profiles").select("id, full_name, email").in("id", ids) : Promise.resolve({ data: [] }),
    ids.length ? service.from("institution_memberships").select("user_id, branch, end_year").eq("institution_id", ctx.institutionId).in("user_id", ids) : Promise.resolve({ data: [] }),
    untyped(service).from("org_placements").select("student_user_id").eq("opportunity_id", drive.id),
  ]);
  const names = new Map((profiles.data ?? []).map((p) => [p.id, p.full_name ?? p.email]));
  const meta = new Map((memberships.data ?? []).map((m) => [m.user_id, m]));
  const placed = new Set(((placements.data ?? []) as { student_user_id: string }[]).map((p) => p.student_user_id));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${drive.role} · ${drive.company}`}
        subtitle={`${drive.location ?? "Location not set"} · ${drive.deadline ? `apply by ${drive.deadline}` : "no deadline"}${drive.eligibility ? ` · ${drive.eligibility}` : ""}`}
        action={
          <Link href="/org/placements" className="font-lp-body text-[13px] text-app-blue hover:underline">
            ← All drives
          </Link>
        }
      />
      <Panel title={`Applicants (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyState title="No applicants yet" body="Students in their final two years see this drive in Launchpad and can apply there." />
        ) : (
          <ul className="divide-y divide-app-border">
            {rows.map((a) => {
              const m = meta.get(a.user_id);
              const isPlaced = placed.has(a.user_id);
              return (
                <li key={a.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-lp-body text-[13.5px] font-medium text-app-charcoal">{names.get(a.user_id) ?? "Student"}</p>
                      <p className="font-lp-mono text-[11px] text-app-muted">
                        {m?.branch ?? "Branch not set"} · class of {m?.end_year ?? "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={a.status === "accepted" ? "ok" : a.status === "rejected" ? "neutral" : "warn"}>{isPlaced ? "Placement confirmed" : STATUS_LABEL[a.status] ?? a.status}</Pill>
                      {!isPlaced && a.status !== "shortlisted" && a.status !== "accepted" && <ActionButton action="/api/org/applications/status" body={{ applicationId: a.id, status: "shortlisted" }} label="Shortlist" variant="ghost" />}
                      {!isPlaced && a.status !== "accepted" && <ActionButton action="/api/org/applications/status" body={{ applicationId: a.id, status: "accepted" }} label="Select" />}
                      {!isPlaced && a.status !== "rejected" && <ActionButton action="/api/org/applications/status" body={{ applicationId: a.id, status: "rejected" }} label="Reject" variant="danger" confirm="Reject this applicant?" />}
                    </div>
                  </div>
                  {a.status === "accepted" && !isPlaced && (
                    <div className="mt-3 rounded-lg border border-app-border bg-white/[0.03] p-3">
                      <p className="mb-2 font-lp-body text-[12.5px] text-app-muted">
                        Confirm the placement once the offer is real. Only confirmed placements count in Outcomes; the student then chooses whether it appears on your public page.
                      </p>
                      <JsonForm
                        action="/api/org/placements/confirm"
                        extra={{ applicationId: a.id }}
                        submitLabel="Confirm placement"
                        successMessage="Placement confirmed."
                        fields={[
                          { name: "company", label: "Company", defaultValue: drive.company },
                          { name: "roleTitle", label: "Role", defaultValue: drive.role },
                          { name: "ctcLpa", label: "CTC (LPA)", type: "number" },
                          { name: "offerDate", label: "Offer date", type: "date" },
                        ]}
                      />
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
