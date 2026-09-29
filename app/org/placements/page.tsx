import type { Metadata } from "next";
import { orgPageContext } from "@/lib/org/page";
import { JsonForm } from "@/components/org/JsonForm";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/org/ui";

export const metadata: Metadata = { title: "Placement drives — Capabilio AI" };

export default async function PlacementsPage() {
  const { ctx, service } = await orgPageContext("postPlacement");
  const { data } = await service
    .from("opportunities")
    .select("id, role, company, location, opportunity_type, deadline, eligibility, created_at")
    .eq("institution_id", ctx.institutionId)
    .order("created_at", { ascending: false });
  const drives = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Placement drives"
        subtitle="Bring recruiters to your campus. A drive is a private listing in the Launchpad — only active students of your institution can see it."
      />
      <Panel title="Post a drive">
        <JsonForm
          action="/api/org/placements"
          submitLabel="Post drive"
          successMessage="Drive posted to your students' Launchpad."
          fields={[
            { name: "company", label: "Company", required: true },
            { name: "role", label: "Role", required: true },
            { name: "opportunityType", label: "Type", type: "select", required: true, defaultValue: "job", options: [{ value: "job", label: "Job" }, { value: "internship", label: "Internship" }] },
            { name: "location", label: "Location" },
            { name: "skills", label: "Skills (comma-separated)", type: "list" },
            { name: "eligibility", label: "Eligibility", type: "textarea" },
            { name: "deadline", label: "Apply by", type: "date" },
          ]}
        />
      </Panel>
      <Panel title="Your drives">
        {drives.length === 0 ? (
          <EmptyState title="No drives yet" body="Drives you post appear here and in your students' Launchpad (which opens for them in their final two years)." />
        ) : (
          <ul className="divide-y divide-app-border">
            {drives.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-lp-body text-[13.5px] font-medium text-app-charcoal">
                    {d.role} · {d.company}
                  </p>
                  <p className="font-lp-mono text-[11px] text-app-muted">
                    {d.location ?? "Location not set"} · {d.deadline ? `apply by ${d.deadline}` : "no deadline"}
                  </p>
                </div>
                <Pill>{d.opportunity_type}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
