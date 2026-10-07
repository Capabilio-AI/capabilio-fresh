import { branchKey } from "@/lib/org/branch-scope";

/** Pure rules for communities: slugs, who belongs to a derived community, and who may moderate. */
export type CommunityKind = "college" | "branch" | "interest";
export type CommunityRole = "member" | "moderator" | "owner";

export function slugify(text: string, maxLength = 60): string {
  const s = text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s.slice(0, maxLength).replace(/-+$/g, "") || "community";
}

export interface AcademicMembership {
  institutionId: string;
  branch: string | null;
  /** faculty, HoD, principal, TPO: people who run the college rather than study in it */
  isStaff: boolean;
}
export interface CommunityRef {
  kind: CommunityKind;
  institutionId: string | null;
  branchKey: string | null;
}

/** College and branch communities are derived from a person's academic membership; interest communities are joined explicitly. */
export function derivedAccess(community: CommunityRef, memberships: readonly AcademicMembership[]): { member: boolean; role: CommunityRole | null } {
  if (community.kind === "interest") return { member: false, role: null };
  const mine = memberships.filter((m) => m.institutionId === community.institutionId && (community.kind === "college" || branchKey(m.branch) === community.branchKey));
  if (mine.length === 0) return { member: false, role: null };
  return { member: true, role: mine.some((m) => m.isStaff) ? "moderator" : "member" };
}

export const canModerate = (role: CommunityRole | null): boolean => role === "moderator" || role === "owner";

/** Can `actorRole` remove `targetRole`? Owners and moderators, never someone of equal or higher rank. */
export function canRemoveMember(actor: CommunityRole | null, target: CommunityRole): boolean {
  if (actor === "owner") return target !== "owner";
  if (actor === "moderator") return target === "member";
  return false;
}
