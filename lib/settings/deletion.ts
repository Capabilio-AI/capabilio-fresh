export const DELETE_PHRASE = "DELETE";

/** Self-serve account roles. Staff and organisation accounts hold records other people depend on, so a platform admin handles those. */
const SELF_DELETE_ROLES = new Set(["student", "professional"]);

export function canSelfDelete(primaryRole: string | null | undefined): boolean {
  return Boolean(primaryRole) && SELF_DELETE_ROLES.has(primaryRole as string);
}

export function isDeleteConfirmed(typed: string): boolean {
  return typed.trim() === DELETE_PHRASE;
}
