import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResumeExtraction } from "@/lib/ai/llm/prompts/resume.v1";

/** What landed where, so the screen can say exactly what was filled in. */
export interface ApplySummary {
  profile: string[];
  education: number;
  projects: number;
  experience: number;
  certifications: number;
  links: number;
}

const PHONE = /^[+0-9 ()-]{7,20}$/;
const KIND_LABEL = { internship: "Internship", job: "Work", other: "Experience" } as const;

const clip = (s: string, max: number) => s.trim().slice(0, max);
const key = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const httpUrl = (u: string | null | undefined): string | null => {
  if (!u) return null;
  try {
    const url = new URL(u.startsWith("http") ? u : `https://${u}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString().slice(0, 2000) : null;
  } catch {
    return null;
  }
};

const yearOrNull = (y: number | null): number | null => (y !== null && y >= 1980 && y <= new Date().getFullYear() + 10 ? y : null);

/** The vault entries this resume would add: pure, so it can be tested without a database. */
export function vaultEntriesFrom(x: ResumeExtraction): { item_type: "project" | "certificate" | "link" | "other"; title: string; url: string | null; description: string | null }[] {
  const out: ReturnType<typeof vaultEntriesFrom> = [];
  for (const p of x.projects) {
    const skills = p.skills.length > 0 ? `Skills: ${p.skills.join(", ")}.` : "";
    out.push({ item_type: "project", title: clip(p.name, 200), url: httpUrl(p.url), description: clip([p.description ?? "", skills].filter(Boolean).join(" "), 1000) || null });
  }
  for (const e of x.experience) {
    const head = `${KIND_LABEL[e.kind]}: ${e.title}${e.organisation ? ` at ${e.organisation}` : ""}`;
    out.push({ item_type: "other", title: clip(head, 200), url: null, description: clip([e.period ?? "", e.description ?? ""].filter(Boolean).join(". "), 1000) || null });
  }
  for (const c of x.certifications) {
    out.push({ item_type: "certificate", title: clip(c.name, 200), url: null, description: clip([c.issuer ?? "", c.year ? String(c.year) : ""].filter(Boolean).join(", "), 1000) || null });
  }
  for (const l of x.personal.links) {
    const url = httpUrl(l.url);
    if (url) out.push({ item_type: "link", title: clip(l.label, 200), url, description: null });
  }
  return out;
}

/**
 * Writes a resume's details into the sections Capabilio already shows (profile, education history, vault) with the service client.
 * Nothing the person already wrote is overwritten, repeated entries are skipped, and everything it adds is marked unverified.
 */
export async function applyResume(db: SupabaseClient, userId: string, x: ResumeExtraction): Promise<ApplySummary> {
  const summary: ApplySummary = { profile: [], education: 0, projects: 0, experience: 0, certifications: 0, links: 0 };

  // personal details and professional summary: only fill what is still empty
  const { data: profile } = await db.from("profiles").select("headline, bio, location, phone").eq("id", userId).maybeSingle();
  const patch: Record<string, string> = {};
  const fill = (col: "headline" | "bio" | "location" | "phone", value: string | null, label: string) => {
    if (value && !(profile as Record<string, string | null> | null)?.[col]) {
      patch[col] = value;
      summary.profile.push(label);
    }
  };
  fill("headline", x.summary.headline ? clip(x.summary.headline, 120) : null, "headline");
  fill("bio", x.summary.about ? clip(x.summary.about, 600) : null, "about");
  fill("location", x.personal.location ? clip(x.personal.location, 80) : null, "location");
  fill("phone", x.personal.phone && PHONE.test(x.personal.phone.trim()) ? x.personal.phone.trim() : null, "phone");
  if (Object.keys(patch).length > 0) await db.from("profiles").update(patch).eq("id", userId);

  // education history: one membership per institution, the same shape the Education page writes
  const { data: existingEdu } = await db.from("institution_memberships").select("institutions ( name )").eq("user_id", userId);
  const haveInstitutions = new Set(((existingEdu ?? []) as unknown as { institutions: { name: string } | { name: string }[] | null }[]).flatMap((m) => (Array.isArray(m.institutions) ? m.institutions : m.institutions ? [m.institutions] : [])).map((i) => key(i.name)));
  for (const e of x.education) {
    if (haveInstitutions.has(key(e.institution))) continue;
    const start = yearOrNull(e.startYear);
    const end = yearOrNull(e.endYear);
    const { data: institutionId } = await db.rpc("get_or_create_institution", { institution_name: clip(e.institution, 200) });
    if (!institutionId) continue;
    const { error } = await db.from("institution_memberships").insert({
      user_id: userId,
      institution_id: institutionId,
      role: "student",
      degree: e.degree ? clip(e.degree, 200) : null,
      field_of_study: e.fieldOfStudy ? clip(e.fieldOfStudy, 200) : null,
      start_year: start,
      end_year: start !== null && end !== null && end < start ? null : end,
    });
    if (!error) {
      summary.education += 1;
      haveInstitutions.add(key(e.institution));
    }
  }

  // projects, internships, certificates and links go to the vault, unverified
  const { data: existingVault } = await db.from("vault_items").select("item_type, title").eq("user_id", userId);
  const haveVault = new Set(((existingVault ?? []) as { item_type: string; title: string }[]).map((v) => `${v.item_type}:${key(v.title)}`));
  const fresh = vaultEntriesFrom(x).filter((v) => {
    const k = `${v.item_type}:${key(v.title)}`;
    if (!v.title || haveVault.has(k)) return false;
    haveVault.add(k);
    return true;
  });
  if (fresh.length > 0) {
    const { error } = await db.from("vault_items").insert(fresh.map((v) => ({ user_id: userId, ...v })));
    if (!error) {
      for (const v of fresh) {
        if (v.item_type === "project") summary.projects += 1;
        else if (v.item_type === "other") summary.experience += 1;
        else if (v.item_type === "certificate") summary.certifications += 1;
        else summary.links += 1;
      }
    }
  }
  return summary;
}
