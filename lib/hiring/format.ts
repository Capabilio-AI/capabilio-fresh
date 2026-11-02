import type { EmploymentType, InterviewStep, Opening, WorkMode } from "./types";

export const WORK_MODE_LABEL: Record<WorkMode, string> = { onsite: "On-site", hybrid: "Hybrid", remote: "Remote" };
export const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  internship: "Internship",
  contract: "Contract",
};

const DAY_MS = 86_400_000;

/** Pure. "my title!" becomes "my-title": the role's link name. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Pure. "Posted today", "Posted 3 days ago", "Posted 2 weeks ago", "Posted 3 months ago". */
export function postedLabel(publishedAt: string | null, now = new Date()): string | null {
  if (!publishedAt) return null;
  const days = Math.max(0, Math.floor((now.getTime() - new Date(publishedAt).getTime()) / DAY_MS));
  if (days === 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  if (days < 14) return `Posted ${days} days ago`;
  if (days < 60) return `Posted ${Math.floor(days / 7)} weeks ago`;
  return `Posted ${Math.floor(days / 30)} months ago`;
}

/** Pure. A role takes applications while it is open and its closing date (if any) has not passed. closes_on is the last day. */
export function isAccepting(o: Pick<Opening, "status" | "closesOn">, now = new Date()): boolean {
  if (o.status !== "open") return false;
  if (!o.closesOn) return true;
  return o.closesOn >= now.toISOString().slice(0, 10);
}

/** Pure. The paragraphs of a plain-text block: blank lines separate them. No markup is interpreted, so nothing a poster types can inject HTML. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Pure. One entry per non-empty line, trimmed: how the admin form turns a textarea into a list. */
export function linesToList(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

const EMPLOYMENT_SCHEMA: Record<EmploymentType, string> = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  internship: "INTERN",
  contract: "CONTRACTOR",
};

/** Pure. schema.org JobPosting for one role, so it can appear in Google for Jobs. */
export function jobPostingJsonLd(o: Opening, siteUrl: string): Record<string, unknown> {
  const description = [o.summary, o.about, ...o.responsibilities.map((r) => `• ${r}`)].join("\n\n");
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: o.title,
    description,
    datePosted: (o.publishedAt ?? o.createdAt).slice(0, 10),
    ...(o.closesOn ? { validThrough: o.closesOn } : {}),
    employmentType: EMPLOYMENT_SCHEMA[o.employmentType],
    hiringOrganization: { "@type": "Organization", name: "Capabilio AI", sameAs: siteUrl },
    ...(o.workMode === "remote"
      ? { jobLocationType: "TELECOMMUTE" }
      : { jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: o.location } } }),
    url: `${siteUrl}/careers/${o.slug}`,
    directApply: true,
  };
}

/** Pure. JSON for a <script type="application/ld+json">: "<" is escaped so a title can never close the tag. */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** Pure. One step per line, written "Title: what happens". A line with no colon is a title with no detail. */
export function parseInterviewLines(text: string): InterviewStep[] {
  return linesToList(text).map((line) => {
    const i = line.indexOf(":");
    return i === -1 ? { title: line, body: "" } : { title: line.slice(0, i).trim(), body: line.slice(i + 1).trim() };
  });
}

/** Pure. The inverse of parseInterviewLines, for the admin form. */
export function interviewToLines(steps: InterviewStep[]): string {
  return steps.map((s) => (s.body ? `${s.title}: ${s.body}` : s.title)).join("\n");
}
