import type { ProResume } from "./resume-schema";

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

export interface Cert { name: string; issuer: string | null; year: number | null }
export interface Edu { institution: string; degree: string | null; fieldOfStudy: string | null; startYear: number | null; endYear: number | null }
export interface Project { name: string; description: string | null; url: string | null; skills: string[] }
export interface Link { label: string; url: string }

const tidy = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max + 1) : "");
const year = (v: unknown): number | null | undefined => {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) && n >= 1950 && n <= 2100 ? n : undefined;
};

/** An address with http or https, adding https:// when the person left it off. Null when it is not a usable address. */
export function normUrl(raw: unknown): string | null {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t || t.length > 500) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".") ? u.toString().slice(0, 500) : null;
  } catch {
    return null;
  }
}

export function validateCert(input: unknown): Checked<Cert> {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const name = tidy(i.name, 160);
  const issuer = tidy(i.issuer, 120);
  const y = year(i.year);
  if (!name || name.length > 160) return { ok: false, error: "Give the certification a name (up to 160 characters)." };
  if (issuer.length > 120) return { ok: false, error: "Keep the issuer under 120 characters." };
  if (y === undefined) return { ok: false, error: "The year must be between 1950 and 2100." };
  return { ok: true, value: { name, issuer: issuer || null, year: y } };
}

export function validateEdu(input: unknown): Checked<Edu> {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const institution = tidy(i.institution, 200);
  const degree = tidy(i.degree, 200);
  const field = tidy(i.fieldOfStudy, 200);
  const start = year(i.startYear);
  const end = year(i.endYear);
  if (!institution || institution.length > 200) return { ok: false, error: "Tell us the institution (up to 200 characters)." };
  if (degree.length > 200 || field.length > 200) return { ok: false, error: "Keep the degree and field under 200 characters." };
  if (start === undefined || end === undefined) return { ok: false, error: "Years must be between 1950 and 2100." };
  if (start !== null && end !== null && end < start) return { ok: false, error: "The end year cannot be before the start year." };
  return { ok: true, value: { institution, degree: degree || null, fieldOfStudy: field || null, startYear: start, endYear: end } };
}

export function validateProject(input: unknown): Checked<Project> {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const name = tidy(i.name, 160);
  const description = typeof i.description === "string" ? i.description.trim() : "";
  if (!name || name.length > 160) return { ok: false, error: "Give the project a name (up to 160 characters)." };
  if (description.length > 600) return { ok: false, error: "Keep the description under 600 characters." };
  const rawUrl = typeof i.url === "string" ? i.url.trim() : "";
  const url = rawUrl ? normUrl(rawUrl) : null;
  if (rawUrl && !url) return { ok: false, error: "That link does not look right." };
  const raw = Array.isArray(i.skills) ? i.skills : typeof i.skills === "string" ? i.skills.split(",") : [];
  const seen = new Set<string>();
  const skills = raw.map((s) => tidy(s, 60)).filter((s) => s && s.length <= 60 && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
  if (skills.length > 12) return { ok: false, error: "Add up to 12 skills." };
  return { ok: true, value: { name, description: description || null, url, skills } };
}

export function validateLink(input: unknown): Checked<Link> {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const label = tidy(i.label, 60);
  if (!label || label.length > 60) return { ok: false, error: "Give the link a label, such as GitHub (up to 60 characters)." };
  const url = normUrl(i.url);
  return url ? { ok: true, value: { label, url } } : { ok: false, error: "That link does not look right." };
}

export interface ResumeRecords { certifications: Cert[]; education: Edu[]; projects: Project[]; links: Link[] }

/** What a resume adds to each record list, cleaned the same way as what a person types. Anything unusable is dropped, never guessed. */
export function recordsFromResume(x: Pick<ProResume, "personal" | "education" | "certifications" | "projects">): ResumeRecords {
  const keep = <T,>(list: readonly T[], check: (t: T) => Checked<unknown>) => list.filter((t) => check(t).ok);
  const certifications = x.certifications.map((c) => ({ name: c.name, issuer: c.issuer, year: c.year }));
  const education = x.education.map((e) => ({ institution: e.institution, degree: e.degree, fieldOfStudy: e.fieldOfStudy, startYear: e.startYear, endYear: e.endYear }));
  const projects = x.projects.map((p) => ({ name: p.name, description: p.description, url: p.url, skills: p.skills }));
  const links = x.personal.links.map((l) => ({ label: l.label, url: l.url }));
  return {
    certifications: keep(certifications, validateCert).map((c) => (validateCert(c) as { ok: true; value: Cert }).value),
    education: keep(education, validateEdu).map((e) => (validateEdu(e) as { ok: true; value: Edu }).value),
    projects: keep(projects, validateProject).map((p) => (validateProject(p) as { ok: true; value: Project }).value),
    links: keep(links, validateLink).map((l) => (validateLink(l) as { ok: true; value: Link }).value),
  };
}
