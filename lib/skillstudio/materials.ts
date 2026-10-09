// What staff have shared with the student's own branch (and their year or earlier): notes, links and uploaded files, each with who shared it.
// Files are served through short-lived signed links, one for viewing in the popup and one that forces a download.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getOrgContext } from "@/lib/org/context";
import { untyped, type MaterialRow } from "@/lib/org/db";
import { sameBranch } from "@/lib/org/branch-scope";
import { BUCKET, SIGNED_URL_SECONDS } from "@/lib/pulse/media";
import { safeUrl } from "@/lib/roadmap-visual/resources";

export type MaterialKind = "file" | "notes" | "link";
export interface StudyMaterial {
  id: string;
  kind: MaterialKind;
  title: string;
  description: string | null;
  /** notes text */
  body: string | null;
  /** external link, or null */
  link: string | null;
  file: { name: string; size: number | null; mime: string | null; viewUrl: string; downloadUrl: string } | null;
  sharedBy: { name: string; role: string };
  year: number;
  subject: string | null;
  sharedAt: string;
}
export interface MaterialsView { institutionName: string; branch: string; year: number | null; items: StudyMaterial[] }

const ROLE_LABEL: Record<string, string> = { faculty: "Faculty", hod: "Head of department", principal: "Principal", vice_principal: "Vice principal", tpo: "Training & placement" };

export async function loadStudyMaterials(supabase: SupabaseClient<Database>, service: SupabaseClient<Database>, userId: string, currentYear: number | null): Promise<MaterialsView | null> {
  const ctx = await getOrgContext(supabase, userId);
  if (!ctx || ctx.kind !== "student" || !ctx.branch) return null;
  const db = untyped(service);

  const { data } = await db.from("class_materials").select("*").eq("institution_id", ctx.institutionId).order("published_at", { ascending: false }).limit(300);
  // their own branch; their current year and the years before it (revision), never a later year's material
  const rows = ((data ?? []) as MaterialRow[]).filter((m) => sameBranch(m.branch, ctx.branch) && (currentYear === null || m.year <= currentYear));
  if (rows.length === 0) return { institutionName: ctx.institutionName, branch: ctx.branch, year: currentYear, items: [] };

  const [{ data: authors }, { data: subjects }] = await Promise.all([
    db.from("institution_memberships").select("id, role, user_id").in("id", [...new Set(rows.map((r) => r.author_membership_id))]),
    rows.some((r) => r.subject_id) ? db.from("curriculum_subjects").select("id, name").in("id", [...new Set(rows.flatMap((r) => (r.subject_id ? [r.subject_id] : [])))]) : { data: [] },
  ]);
  const memberships = (authors ?? []) as { id: string; role: string; user_id: string }[];
  const { data: profiles } = memberships.length ? await db.from("profiles").select("id, full_name").in("id", memberships.map((m) => m.user_id)) : { data: [] };
  const nameOf = new Map(((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]));
  const authorOf = new Map(memberships.map((m) => [m.id, { name: nameOf.get(m.user_id) ?? "Your faculty", role: ROLE_LABEL[m.role] ?? "Staff" }]));
  const subjectOf = new Map(((subjects ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));

  const paths = rows.flatMap((r) => (r.file_path ? [r.file_path] : []));
  const [viewUrls, downloadUrls] = await Promise.all([
    paths.length ? service.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS) : { data: [] },
    Promise.all(rows.filter((r) => r.file_path).map(async (r) => [r.file_path as string, (await service.storage.from(BUCKET).createSignedUrl(r.file_path as string, SIGNED_URL_SECONDS, { download: r.file_name ?? true })).data?.signedUrl] as const)),
  ]);
  const view = new Map((viewUrls.data ?? []).flatMap((u) => (u.path && u.signedUrl ? [[u.path, u.signedUrl] as const] : [])));
  const download = new Map(downloadUrls.flatMap(([p, u]) => (u ? [[p, u] as const] : [])));

  const items = rows.flatMap((m): StudyMaterial[] => {
    const viewUrl = m.file_path ? view.get(m.file_path) : undefined;
    const downloadUrl = m.file_path ? download.get(m.file_path) : undefined;
    const isFile = m.type === "file";
    if (isFile && (!viewUrl || !downloadUrl)) return []; // a file that cannot be served is not shown
    return [{
      id: m.id,
      kind: isFile ? "file" : m.type === "notes" ? "notes" : "link",
      title: m.title, description: m.description, body: m.type === "notes" ? m.body : null,
      link: !isFile && m.type !== "notes" ? safeUrl(m.url) : null,
      file: isFile && viewUrl && downloadUrl ? { name: m.file_name ?? "file", size: m.file_size, mime: m.file_mime, viewUrl, downloadUrl } : null,
      sharedBy: authorOf.get(m.author_membership_id) ?? { name: "Your faculty", role: "Staff" },
      year: m.year, subject: m.subject_id ? subjectOf.get(m.subject_id) ?? null : null, sharedAt: m.published_at,
    }];
  });
  return { institutionName: ctx.institutionName, branch: ctx.branch, year: currentYear, items };
}
