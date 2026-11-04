import type { Metadata } from "next";
import { orgPageContext } from "@/lib/org/page";
import { staffBranchScope } from "@/lib/org/branch-scope";
import { listMaterialsForStaff, listSubjects } from "@/lib/org/loaders";
import { listCollegeBranches } from "@/lib/org/college-branches";
import { groupShares, summariseAudience, type MaterialShare, type ShareRow } from "@/lib/org/material-share";
import { MaterialsComposer } from "@/components/org/MaterialsComposer";
import { MaterialsLibrary, type LibraryItem, type LibraryKind } from "@/components/org/MaterialsLibrary";
import { EmptyState, PageHeader, formatDateTime } from "@/components/org/ui";
import { BUCKET, SIGNED_URL_SECONDS } from "@/lib/pulse/media";
import { untyped } from "@/lib/org/db";

export const metadata: Metadata = { title: "Course materials — Capabilio AI" };

const PAGE_SIZE = 15;
type Params = { type?: string; q?: string; branch?: string; year?: string; sort?: string; view?: string; page?: string };

/** What a share looks like in the library, from what it is. */
function kindOf(m: Pick<MaterialShare, "type" | "file_name">): LibraryKind {
  const name = (m.file_name ?? "").toLowerCase();
  if (m.type === "link") return "link";
  if (m.type === "notes") return "note";
  if (m.type === "pdf" || name.endsWith(".pdf")) return "pdf";
  if (/\.(xlsx|xls)$/.test(name)) return "excel";
  if (/\.(pptx|ppt)$/.test(name)) return "slides";
  if (/\.(png|jpe?g|webp)$/.test(name)) return "image";
  return "document";
}
const size = (n: number | null) => (n === null ? null : n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { ctx, service } = await orgPageContext("uploadMaterial");
  const scope = staffBranchScope(ctx);
  const [rows, subjects, collegeBranches] = await Promise.all([listMaterialsForStaff(service, ctx), listSubjects(service, ctx.institutionId, scope), listCollegeBranches(service, ctx.institutionId, scope)]);
  const shares = groupShares(rows as unknown as ShareRow[]);

  const type = ["file", "link", "pdf", "notes"].includes(sp.type ?? "") ? sp.type : "";
  const q = (sp.q ?? "").trim().toLowerCase();
  const year = /^[1-6]$/.test(sp.year ?? "") ? Number(sp.year) : null;
  const sort = ["old", "name", "size"].includes(sp.sort ?? "") ? (sp.sort as string) : "new";
  const view = sp.view === "cards" ? "cards" : "list";

  const matched = shares.filter(
    (m) =>
      (!type || m.type === type) &&
      (!sp.branch || m.audiences.some((a) => a.branch === sp.branch)) &&
      (year === null || m.audiences.some((a) => a.year === year)) &&
      (!q || `${m.title} ${m.description ?? ""} ${m.file_name ?? ""}`.toLowerCase().includes(q))
  );
  const sorted = [...matched].sort((a, b) =>
    sort === "old" ? a.published_at.localeCompare(b.published_at) : sort === "name" ? a.title.localeCompare(b.title) : sort === "size" ? (b.file_size ?? -1) - (a.file_size ?? -1) : b.published_at.localeCompare(a.published_at)
  );
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, /^\d{1,4}$/.test(sp.page ?? "") ? Number(sp.page) : 1), pages);
  const slice = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // links for the visible files only
  const filePaths = [...new Set(slice.flatMap((m) => (m.file_path ? [m.file_path] : [])))];
  const signed = filePaths.length ? await service.storage.from(BUCKET).createSignedUrls(filePaths, SIGNED_URL_SECONDS) : { data: [] };
  const fileUrl = new Map((signed.data ?? []).flatMap((u) => (u.path && u.signedUrl ? [[u.path, u.signedUrl] as const] : [])));

  // admins see everyone's shares, so say who shared each
  const canSeeAuthors = ctx.kind === "admin";
  const authors = new Map<string, string>();
  if (canSeeAuthors && slice.length) {
    const db = untyped(service);
    const { data: ms } = await db.from("institution_memberships").select("id, user_id").in("id", [...new Set(slice.map((m) => m.author_membership_id))]);
    const members = (ms ?? []) as { id: string; user_id: string }[];
    const { data: ps } = members.length ? await db.from("profiles").select("id, full_name").in("id", members.map((m) => m.user_id)) : { data: [] };
    const nameOf = new Map(((ps ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]));
    for (const m of members) authors.set(m.id, nameOf.get(m.user_id) ?? "Staff");
  }

  const allBranchNames = collegeBranches.map((b) => b.branch);
  const items: LibraryItem[] = slice.map((m) => {
    const summary = summariseAudience(m.audiences, allBranchNames);
    return {
      shareId: m.share_id,
      title: m.title,
      description: m.description,
      kind: kindOf(m),
      chips: summary.chips,
      audienceFull: summary.full,
      groups: m.audiences.length,
      size: size(m.file_size),
      sharedAt: formatDateTime(m.published_at).split(",")[0],
      href: m.url ?? (m.file_path ? fileUrl.get(m.file_path) ?? null : null),
      author: authors.get(m.author_membership_id) ?? null,
    };
  });

  const count = (t: string[]) => shares.filter((m) => t.includes(m.type)).length;
  const usedBranches = [...new Set(shares.flatMap((m) => m.audiences.map((a) => a.branch)))].sort();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Course materials"
        subtitle={scope ? `Share notes, files and links with ${scope} students. They see them in SkillStudio and get a notification.` : "Share notes, files and links with the branches and years you choose. Students see them in SkillStudio and get a notification."}
      />

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Library summary">
        {([["Shared", shares.length], ["Files", count(["file"])], ["Links", count(["link", "pdf"])], ["Notes", count(["notes"])]] as const).map(([label, n]) => (
          <li key={label} className="o-card p-4">
            <p className="text-[26px] font-extrabold leading-none tabular-nums text-app-charcoal">{n.toLocaleString("en-IN")}</p>
            <p className="mt-1.5 text-[12.5px] text-app-muted">{label}</p>
          </li>
        ))}
      </ul>

      <MaterialsComposer branches={collegeBranches} subjects={subjects.map((s) => ({ value: s.id, label: s.label }))} canPickAll={!scope} />

      {shares.length === 0 ? (
        <EmptyState title="Nothing shared yet" body="Share a file, a link or a note above. It appears here and in your students' SkillStudio." />
      ) : (
        <MaterialsLibrary
          items={items}
          branches={usedBranches}
          canSeeAuthors={canSeeAuthors}
          filters={{ q: sp.q?.trim() ?? "", type: type ?? "", branch: sp.branch ?? "", year: year ? String(year) : "", sort, view, page, pages, total: sorted.length }}
        />
      )}
    </div>
  );
}
