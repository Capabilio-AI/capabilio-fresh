const COLLEGE_POST_TYPES = ["event", "announcement"] as const;
const COMPANY_POST_TYPES = ["update", "hiring", "milestone", "event"] as const;

/** Pure. A college posts events and announcements; a company posts updates, hiring news, milestones and events. Never the other's types. */
export function postTypeAllowed(company: boolean, type: string): boolean {
  return ((company ? COMPANY_POST_TYPES : COLLEGE_POST_TYPES) as readonly string[]).includes(type);
}
