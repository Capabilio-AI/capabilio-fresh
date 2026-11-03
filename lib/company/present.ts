import { SIZE_BANDS } from "./profile-schema";

export const POST_TYPE_LABEL: Record<string, string> = { update: "Update", hiring: "Hiring", milestone: "Milestone", event: "Event", announcement: "Announcement" };

/** Pure. The one-line facts under a company's name: only what it has filled in, in a fixed order. */
export function factLine(f: { industry: string | null; sizeBand: string | null; city: string | null; foundedYear: number | null }): string[] {
  const size = f.sizeBand && (SIZE_BANDS as readonly string[]).includes(f.sizeBand) ? `${f.sizeBand} people` : null;
  return [f.industry, size, f.city, f.foundedYear ? `Founded ${f.foundedYear}` : null].filter((x): x is string => Boolean(x));
}
