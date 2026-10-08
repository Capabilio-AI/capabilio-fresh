import type { Metadata } from "next";
import Link from "next/link";
import { orgPageContext } from "@/lib/org/page";
import { untyped } from "@/lib/org/db";
import { VISIT_STATUS } from "@/lib/org/visits";
import { JsonForm } from "@/components/org/JsonForm";
import { Collapsible, EmptyState, PageHeader, Pill } from "@/components/org/ui";
import { GroupTitle, Initial } from "@/components/org/widgets";

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

  const today = new Date().toISOString().slice(0, 10);
  const isDone = (d: VisitRow) => d.drive_status === "completed" || d.drive_status === "cancelled" || (d.drive_date !== null && d.drive_date < today && d.drive_status !== "registration_open");
  const lanes = [
    { title: "Needs your review", items: visits.filter((d) => !isDone(d) && countFor(d.id).review > 0) },
    { title: "Upcoming and open", items: visits.filter((d) => !isDone(d) && countFor(d.id).review === 0) },
    { title: "Finished", items: visits.filter(isDone) },
  ];

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
      {visits.length === 0 ? (
        <EmptyState title="No company visits yet" body="When a company confirms it will visit your campus, record it here. Final-year students then see it in Launchpad and can register." />
      ) : (
        lanes.map((lane) =>
          lane.items.length === 0 ? null : (
            <section key={lane.title} aria-label={lane.title}>
              <GroupTitle count={lane.items.length}>{lane.title}</GroupTitle>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {lane.items.map((d) => {
                  const c = countFor(d.id);
                  const st = VISIT_STATUS[d.drive_status] ?? VISIT_STATUS.registration_open;
                  const date = d.drive_date ? new Date(d.drive_date) : null;
                  return (
                    <li key={d.id}>
                      <Link href={`/org/placements/${d.id}`} className="o-card block p-4">
                        <div className="flex items-start gap-3">
                          <Initial text={d.company} size={42} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14.5px] font-bold text-app-charcoal">{d.company}</p>
                            <p className="truncate text-[12.5px] text-app-muted">{d.role}</p>
                          </div>
                          <Pill tone={st.tone}>{st.label}</Pill>
                        </div>
                        <p className="mt-2.5 text-[12.5px] text-app-muted">
                          {date ? date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "Date not set"}
                          {d.location ? ` · ${d.location}` : ""}
                          {d.ctc_offered ? ` · ${d.ctc_offered}` : ""}
                        </p>
                        <ol className="mt-3 grid grid-cols-3 divide-x divide-app-border rounded-xl bg-white/[0.04] text-center" aria-label="Pipeline">
                          {[{ label: "Registered", n: c.registered }, { label: "To review", n: c.review }, { label: "Selected", n: c.selected }].map((x) => (
                            <li key={x.label} className="py-2">
                              <p className={`text-[17px] font-extrabold leading-none ${x.label === "To review" && x.n > 0 ? "text-app-warning" : "text-app-charcoal"}`}>{x.n}</p>
                              <p className="mt-1 text-[11.5px] text-app-muted">{x.label}</p>
                            </li>
                          ))}
                        </ol>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )
        )
      )}
    </div>
  );
}
