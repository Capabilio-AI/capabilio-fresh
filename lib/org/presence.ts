import type { OrgPostRow } from "./db";

interface VisibilityInput {
  post: Pick<OrgPostRow, "status" | "type" | "is_public">;
  /** organisation_profiles.is_public — the org has opted into a public page. */
  profilePublic: boolean;
  /** viewer holds an ACTIVE membership at this institution */
  isMember: boolean;
}

/**
 * Spec §3.3: published events are public (once the org page is public); announcements are members-only
 * unless flagged public. Drafts are never visible here (authors see theirs in the workspace).
 */
export function postVisibleTo({ post, profilePublic, isMember }: VisibilityInput): boolean {
  if (post.status !== "published") return false;
  if (isMember) return true;
  if (!profilePublic) return false;
  return post.type === "event" || post.is_public;
}
