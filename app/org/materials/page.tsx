import type { Metadata } from "next";
import { Search } from "lucide-react";
import { orgPageContext } from "@/lib/org/page";
import { staffBranchScope } from "@/lib/org/branch-scope";
import { listMaterialsForStaff, listSubjects } from "@/lib/org/loaders";
import { listCollegeBranches } from "@/lib/org/college-branches";
import { MaterialsComposer } from "@/components/org/MaterialsComposer";
import { ActionButton } from "@/components/org/ActionButton";
import { EmptyState, PageHeader, Pill, formatDateTime } from "@/components/org/ui";
import { GroupTitle, Segmented } from "@/components/org/widgets";
import { ExternalLink, FileImage, FileSpreadsheet, FileText, Link2, Presentation, StickyNote, type LucideIcon } from "lucide-react";
import { BUCKET, SIGNED_URL_SECONDS } from "@/lib/pulse/media";

export const metadata: Metadata = { title: "Course materials — Capabilio AI" };

const TYPE_LABEL: Record<string, string> = { file: "Files", link: "Links", pdf: "PDFs", notes: "Notes" };
type Look = { icon: LucideIcon; tone: string; label: string };

/** How a material looks in the library: colour and icon by what it is, so a long list can be scanned. */
function lookOf(m: { type: string; file_name: string | null }): Look {
  const name = (m.file_name ?? "").toLowerCase();
  if (m.type === "link") return { icon: Link2, tone: "bg-app-blue-container text-app-blue", label: "Link" };
  if (m.type === "notes") return { icon: StickyNote, tone: "bg-app-warning-container text-app-warning", label: "Note" };
  if (m.type === "pdf" || name.endsWith(".pdf")) return { icon: FileText, tone: "bg-app-rose-container text-app-rose", label: "PDF" };
  if (/\.(xlsx|xls)$/.test(name)) return { icon: FileSpreadsheet, tone: "bg-app-success-container text-app-success", label: "Excel" };
  if (/\.(pptx|ppt)$/.test(name)) return { icon: Presentation, tone: "bg-app-orange-container text-app-orange", label: "Slides" };
  if (/\.(png|jpe?g|webp)$/.test(name)) return { icon: FileImage, tone: "bg-app-blue-container text-app-blue", label: "Image" };
  return { icon: FileText, tone: "bg-app-blue-container text-app-blue", label: "Document" };
}
const size = (n: number | null) => (n === null ? null : n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

type Params = { type?: string; q?: string; branch?: string };

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { ctx, service } = await orgPageContext("uploadMaterial");
  const scope = staffBranchScope(ctx);
  const type = sp.type && Object.hasOwn(TYPE_LABEL, sp.type) ? sp.type : undefined;
  const q = sp.q?.trim().toLowerCase() || undefined;
  const [materials, subjects, branches] = await Promise.all([listMaterialsForStaff(service, ctx), listSubjects(service, ctx.institutionId, scope), listCollegeBranches(service, ctx.institutionId, scope)]);

  // uploaded files have no url: give them a short-lived signed link, as students get in SkillStudio
  const filePaths = [...new Set(materials.flatMap((m) => (m.file_path ? [m.file_path] : [])))];
  const signed = filePaths.length ? await service.storage.from(BUCKET).createSignedUrls(filePaths, SIGNED_URL_SECONDS) : { data: [] };
  const fileUrl = new Map((signed.data ?? []).flatMap((u) => (u.path && u.signedUrl ? [[u.path, u.signedUrl] as const] : [])));

  const matches = (m: (typeof materials)[number]) => (!type || m.type === type) && (!sp.branch || m.branch === sp.branch) && (!q || `${m.title} ${m.description ?? ""} ${m.file_name ?? ""}`.toLowerCase().includes(q));
  const shown = materials.filter(matches);
  const byGroup = new Map<string, typeof shown>();
  for (const m of shown) byGroup.set(`Year ${m.year} · ${m.branch}`, [...(byGroup.get(`Year ${m.year} · ${m.branch}`) ?? []), m]);
  const groups = [...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b));
  const usedBranches = [...new Set(materials.map((m) => m.branch))].sort();
  const href = (next: Params) => {
    const merged = { type: sp.type, q: sp.q, branch: sp.branch, ...next };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    return params.toString() ? `/org/materials?${params}` : "/org/materials";
  };
  const count = (t: string) => materials.filter((m) => m.type === t).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Course materials"
        subtitle={scope ? `Share notes, files and links with ${scope} students. They see them in SkillStudio and get a notification.` : "Share notes, files and links with the branches and years you choose. Students see them in SkillStudio and get a notification."}
      />

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Library summary">
        {[["Shared", materials.length], ["Files", count("file") + count("pdf")], ["Links", count("link")], ["Notes", count("notes")]].map(([label, n]) => (
          <li key={String(label)} className="o-card p-4">
            <p className="text-[26px] font-extrabold leading-none tabular-nums text-app-charcoal">{Number(n).toLocaleString("en-IN")}</p>
            <p className="mt-1.5 text-[12.5px] text-app-muted">{label}</p>
          </li>
        ))}
      </ul>

      <MaterialsComposer branches={branches} subjects={subjects.map((s) => ({ value: s.id, label: s.label }))} canPickAll={!scope} />

      <section aria-label="Library" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <form method="get" role="search" className="relative">
            {sp.type && <input type="hidden" name="type" value={sp.type} />}
            {sp.branch && <input type="hidden" name="branch" value={sp.branch} />}
            <label>
              <span className="sr-only">Search the library</span>
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" aria-hidden="true" />
              <input name="q" defaultValue={sp.q ?? ""} placeholder="Search title or file name" className="o-input !w-64 !rounded-full !pl-9" />
            </label>
          </form>
          <Segmented
            label="Filter by type"
            tabs={[
              { label: "All", href: href({ type: undefined }), active: !type, count: materials.length },
              ...Object.keys(TYPE_LABEL).map((t) => ({ label: TYPE_LABEL[t], href: href({ type: t }), active: type === t, count: count(t) })),
            ]}
          />
        </div>
        {usedBranches.length > 1 && (
          <ul className="flex flex-wrap gap-2" aria-label="Filter by branch">
            {usedBranches.map((b) => (
              <li key={b}><a href={href({ branch: sp.branch === b ? undefined : b })} aria-current={sp.branch === b} className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold ${sp.branch === b ? "border-[var(--m-ink)]! bg-[var(--m-accent-soft)] text-app-charcoal" : "border-app-border! text-app-muted hover:bg-[var(--m-accent-soft)]"}`}>{b}</a></li>
            ))}
          </ul>
        )}

        {shown.length === 0 ? (
          <EmptyState title={materials.length === 0 ? "Nothing shared yet" : "Nothing matches"} body={materials.length === 0 ? "Share a file, a link or a note above. It appears here and in your students' SkillStudio." : "Try a different search or clear a filter."} />
        ) : (
          groups.map(([label, items]) => (
            <section key={label} aria-label={label}>
              <GroupTitle count={items.length}>{label}</GroupTitle>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {items.map((m) => {
                  const look = lookOf(m);
                  const open = m.url ?? (m.file_path ? fileUrl.get(m.file_path) : undefined);
                  return (
                    <li key={m.id} className="o-card flex items-start gap-3.5 p-4">
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${look.tone}`}><look.icon size={19} aria-hidden="true" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px] font-semibold text-app-charcoal">{m.title}</p>
                        {m.description && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-app-muted">{m.description}</p>}
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-app-muted">
                          <Pill tone="neutral">{look.label}</Pill>
                          {size(m.file_size) && <span>{size(m.file_size)}</span>}
                          <span>{formatDateTime(m.published_at)}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {open && <a href={open} target="_blank" rel="noopener noreferrer" aria-label={`Open ${m.title}`} className="o-btn-ghost !px-2.5"><ExternalLink size={14} aria-hidden="true" /></a>}
                        <ActionButton action="/api/org/materials/delete" body={{ id: m.id }} label="Remove" variant="ghost" confirm={`Remove "${m.title}"? Students will no longer see it.`} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </section>
    </div>
  );
}
