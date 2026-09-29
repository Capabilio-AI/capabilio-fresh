import type { Metadata } from "next";
import Link from "next/link";
import { orgPageContext } from "@/lib/org/page";
import { JsonForm } from "@/components/org/JsonForm";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/org/ui";

export const metadata: Metadata = { title: "Placements — Capabilio AI" };

export default async function PlacementsPage() {
  const { ctx, service } = await orgPageContext("postPlacement");
  const { data } = await service
    .from("opportunities")
    .select("id, role, company, location, opportunity_type, deadline, created_at")
    .eq("institution_id", ctx.institutionId)
    .order("created_at", { ascending: false });
  const drives = data ?? [];
  const { data: apps } = drives.length ? await service.from("applications").select("opportunity_id, status").in("opportunity_id", drives.map((d) => d.id)) : { data: [] };
  const countFor = (id: string) => {
    const mine = (apps ?? []).filter((a) => a.opportunity_id === id);
    return { applied: mine.length, review: mine.filter((a) => a.status === "submitted").length, selected: mine.filter((a) => a.status === "accepted").length };
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Placements"
        subtitle="Post a campus drive, review who applied, shortlist and select, then confirm placements. A drive is private to your institution's active students."
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
          <EmptyState title="No drives yet" body="Drives you post appear here with their applicants. Students see them in Launchpad, which opens in their final two years." />
        ) : (
          <ul className="divide-y divide-app-border">
            {drives.map((d) => {
              const c = countFor(d.id);
              return (
                <li key={d.id}>
                  <Link href={`/org/placements/${d.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-black/[0.02]">
                    <div>
                      <p className="font-lp-body text-[13.5px] font-medium text-app-charcoal">
                        {d.role} · {d.company}
                      </p>
                      <p className="font-lp-mono text-[11px] text-app-muted">
                        {d.location ?? "Location not set"} · {d.deadline ? `apply by ${d.deadline}` : "no deadline"} · {c.applied} applied · {c.selected} selected
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.review > 0 && <Pill tone="warn">{c.review} to review</Pill>}
                      <Pill>{d.opportunity_type}</Pill>
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
