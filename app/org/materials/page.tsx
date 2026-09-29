import type { Metadata } from "next";
import { orgPageContext } from "@/lib/org/page";
import { listMaterialsForStaff, listSubjects } from "@/lib/org/loaders";
import { JsonForm } from "@/components/org/JsonForm";
import { Collapsible, EmptyState, PageHeader, Panel, Pill } from "@/components/org/ui";

export const metadata: Metadata = { title: "Course materials — Capabilio AI" };

export default async function MaterialsPage() {
  const { ctx, service } = await orgPageContext("uploadMaterial");
  const [materials, subjects] = await Promise.all([listMaterialsForStaff(service, ctx), listSubjects(service, ctx.institutionId)]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Course materials"
        subtitle="Share notes or links with students of a branch and year. Students see only their own branch and year. Files are shared as links for now (no upload storage yet)."
      />
      <Collapsible title="Add material">
        <JsonForm
          action="/api/org/materials"
          submitLabel="Publish material"
          successMessage="Published to students."
          fields={[
            { name: "type", label: "Type", type: "select", required: true, defaultValue: "link", options: [{ value: "link", label: "Link" }, { value: "pdf", label: "PDF (link)" }, { value: "notes", label: "Notes (text)" }] },
            { name: "title", label: "Title", required: true },
            { name: "url", label: "Link (for PDF / link)", type: "url", placeholder: "https://…" },
            { name: "body", label: "Notes text (for notes)", type: "textarea" },
            { name: "description", label: "Short description" },
            { name: "subjectId", label: "Subject", type: "select", options: subjects.map((s) => ({ value: s.id, label: s.label })), help: subjects.length ? "Picking a subject sets branch and year for you." : "No subjects yet — add them under Curriculum, or enter a branch and year below." },
            { name: "branch", label: "Branch (if no subject)" },
            { name: "year", label: "Year (if no subject)", type: "number" },
          ]}
        />
      </Collapsible>
      <Panel title="Published">
        {materials.length === 0 ? (
          <EmptyState title="Nothing shared yet" body="Materials you publish appear here and in your students' Classroom." />
        ) : (
          <ul className="divide-y divide-app-border">
            {materials.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-lp-body text-[13.5px] font-medium text-app-charcoal">{m.title}</p>
                  <p className="font-lp-mono text-[11px] text-app-muted">
                    {m.branch} · Year {m.year}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill>{m.type}</Pill>
                  {m.url && (
                    <a href={m.url} target="_blank" rel="noopener noreferrer" className="font-lp-body text-[12.5px] text-app-blue hover:underline">
                      Open
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
