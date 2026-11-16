/** A working professional's own words at sign-up: where they work now. It is a claim until the job is verified. */
export interface DeclaredJob { employerName: string; jobTitle: string }

const MAX = 120;
const clean = (v: unknown): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, MAX) : "");

/** The job a new account said it holds, from its sign-up details, or null when it did not say or either part is missing. */
export function declaredJob(meta: Record<string, unknown> | null | undefined): DeclaredJob | null {
  if (!meta || meta.intent !== "professional") return null;
  const employerName = clean(meta.employer_name);
  const jobTitle = clean(meta.job_title);
  return employerName && jobTitle ? { employerName, jobTitle } : null;
}
