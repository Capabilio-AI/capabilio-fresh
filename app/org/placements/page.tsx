import type { Metadata } from "next";
import Link from "next/link";
import { orgPageContext } from "@/lib/org/page";
import { untyped } from "@/lib/org/db";
import { VISIT_STATUS } from "@/lib/org/visits";
import { JsonForm } from "@/components/org/JsonForm";
import { Collapsible, EmptyState, PageHeader, Panel, Pill } from "@/components/org/ui";

export const metadata: Metadata = { title: "Company visits — Capabilio AI" };

interface VisitRow {
  id: string;
  company: string;
  role: string;
  location: string | null;
  opportunity_type: string;
  drive_date: string | null;
  drive_status: string;
  ctc_offered: string | null;
  deadline: string | null;
}

export default async function PlacementsPage() {
  const { ctx, service } = await orgPageContext("postPlacement");
  const { data } = await untyped(service)
    .from("opportunities")
    .select("id, company, role, location, opportunity_type, drive_date, drive_status, ctc_offered, deadline, created_at")
    .eq("institution_id", ctx.institutionId)
    .order("created_at", { ascending: false });
  const visits = (data ?? []) as VisitRow[];
  const { data: apps } = visits.length ? await service.from("applications").select("opportunity_id, status").in("opportunity_id", visits.map((d) => d.id)) : { data: [] };
  const countFor = (id: string) => {
    const mine = (apps ?? []).filter((a) => a.opportunity_id === id);
    return { registered: mine.length, review: mine.filter((a) => a.status === "submitted").length, selected: mine.filter((a) => a.status === "accepted").length };
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Company visits"
        subtitle="Companies come to your campus to hire. Record each visit once the company has confirmed it, let eligible students register, then follow it through shortlisting, selection and offer letters."
      />
      <Collapsible title="Record a company visit">
        <JsonForm
          action="/api/org/placements"
          submitLabel="Save company visit"
          successMessage="Saved. Eligible final-year students can now register in Launchpad."
          fields={[
            { name: "company", label: "Company", required: true, placeholder: "Infosys" },
            { name: "role", label: "Role(s) they are hiring for", required: true, placeholder: "Systems Engineer, Analyst" },
            { name: "opportunityType", label: "Type", type: "select", required: true, defaultValue: "job", options: [{ value: "job", label: "Full-time job" }, { value: "internship", label: "Internship" }] },
            { name: "driveDate", label: "Visit date", type: "date" },
            { name: "deadline", label: "Registration closes", type: "date" },
            { name: "ctcOffered", label: "Package (as shared by the company)", placeholder: "₹4.5–8 LPA" },
            { name: "location", label: "Where (campus or online)", placeholder: "Seminar Hall A" },
            { name: "eligibleBranches", label: "Open to branches (comma-separated; blank = all)", type: "list", placeholder: "CSE, ECE, IT" },
            { name: "skills", label: "Skills they look for (comma-separated)", type: "list" },
            { name: "status", label: "Status", type: "select", required: true, defaultValue: "registration_open", options: [{ value: "registration_open", label: "Registration open" }, { value: "planned", label: "Planned (not open yet)" }] },
            { name: "eligibility", label: "Eligibility and selection process", type: "textarea", placeholder: "60%+ throughout, no active backlogs. Aptitude → Technical → HR." },
          ]}
        />
      </Collapsible>
      <Panel title="Your company visits">
        {visits.length === 0 ? (
          <EmptyState title="No company visits yet" body="When a company confirms it will visit your campus, record it here. Final-year students then see it in Launchpad and can register." />
        ) : (
          <ul className="divide-y divide-app-border">
            {visits.map((d) => {
              const c = countFor(d.id);
              const st = VISIT_STATUS[d.drive_status] ?? VISIT_STATUS.registration_open;
              return (
                <li key={d.id}>
                  <Link href={`/org/placements/${d.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3.5 hover:bg-white/[0.03]">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-bold text-app-charcoal">
                        {d.company} <span className="font-medium text-app-muted">· {d.role}</span>
                      </p>
                      <p className="text-[11.5px] text-app-muted">
                        {d.drive_date ? new Date(d.drive_date).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "Date not set"}
                        {d.location ? ` · ${d.location}` : ""}
                        {d.ctc_offered ? ` · ${d.ctc_offered}` : ""} · {c.registered} registered · {c.selected} selected
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.review > 0 && <Pill tone="warn">{c.review} to review</Pill>}
                      <Pill tone={st.tone}>{st.label}</Pill>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
