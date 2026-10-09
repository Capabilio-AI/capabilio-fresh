import type { Metadata } from "next";
import { orgPageContext } from "@/lib/org/page";
import { staffBranchScope } from "@/lib/org/branch-scope";
import { listMaterialsForStaff, listSubjects } from "@/lib/org/loaders";
import { JsonForm } from "@/components/org/JsonForm";
import { MaterialFileForm } from "@/components/org/MaterialFileForm";
import { ExternalLink, FileText, Link2, StickyNote, type LucideIcon } from "lucide-react";
import { Collapsible, EmptyState, PageHeader } from "@/components/org/ui";
import { GroupTitle, Segmented } from "@/components/org/widgets";

export const metadata: Metadata = { title: "Course materials — Capabilio AI" };

const TYPE_ICON: Record<string, LucideIcon> = { link: Link2, pdf: FileText, notes: StickyNote, file: FileText };
const TYPE_LABEL: Record<string, string> = { file: "Files", link: "Links", pdf: "PDFs", notes: "Notes" };

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const sp = await searchParams;
  const { ctx, service } = await orgPageContext("uploadMaterial");
  const scope = staffBranchScope(ctx);
  const type = sp.type && sp.type in TYPE_LABEL ? sp.type : undefined;
  const [materials, subjects] = await Promise.all([listMaterialsForStaff(service, ctx), listSubjects(service, ctx.institutionId, scope)]);

  const shown = type ? materials.filter((m) => m.type === type) : materials;
  const byGroup = new Map<string, typeof shown>();
  for (const m of shown) byGroup.set(`Year ${m.year} · ${m.branch}`, [...(byGroup.get(`Year ${m.year} · ${m.branch}`) ?? []), m]);
  const groups = [...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Course materials"
        subtitle={scope ? `Share notes or links with ${scope} students of a year. Only students of ${scope} in that year see them, in SkillStudio.` : "Share notes or links with students of a branch and year. Students see only their own branch and year, in SkillStudio. Upload a file or share a link."}
      />
      <Collapsible title="Upload a file">
        <MaterialFileForm subjects={subjects.map((s) => ({ value: s.id, label: s.label }))} scoped={Boolean(scope)} />
      </Collapsible>
      <Collapsible title="Add a link or notes">
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
            { name: "subjectId", label: "Subject", type: "select", options: subjects.map((s) => ({ value: s.id, label: s.label })), help: subjects.length ? "Picking a subject sets branch and year for you." : scope ? "No subjects for your branch yet — enter the year below." : "No subjects yet — add them under Curriculum, or enter a branch and year below." },
            ...(scope ? [] : [{ name: "branch", label: "Branch (if no subject)" }]),
            { name: "year", label: "Year (if no subject)", type: "number" as const },
          ]}
        />
      </Collapsible>
      <Segmented
        label="Filter by type"
        tabs={[
          { label: "All", href: "/org/materials", active: !type, count: materials.length },
          ...Object.keys(TYPE_LABEL).map((t) => ({ label: TYPE_LABEL[t], href: `/org/materials?type=${t}`, active: type === t, count: materials.filter((m) => m.type === t).length })),
        ]}
      />
      {shown.length === 0 ? (
        <EmptyState title="Nothing shared yet" body="Materials you publish appear here and in your students' SkillStudio." />
      ) : (
        groups.map(([label, items]) => (
          <section key={label} aria-label={label}>
            <GroupTitle count={items.length}>{label}</GroupTitle>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {items.map((m) => {
                const Icon = TYPE_ICON[m.type] ?? Link2;
                return (
                  <li key={m.id} className="o-card flex items-start gap-3 p-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-app-orange-container text-app-orange">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-app-charcoal">{m.title}</p>
                      <p className="text-[12.5px] text-app-muted">{TYPE_LABEL[m.type]?.replace(/s$/, "") ?? m.type}</p>
                    </div>
                    {m.url && (
                      <a href={m.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${m.title}`} className="o-btn-ghost !px-2.5">
                        <ExternalLink size={14} aria-hidden="true" />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
