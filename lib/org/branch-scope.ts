import type { OrgContext } from "./context";

/** The comparison every branch match in the app uses (SQL: lower(btrim())). */
export const branchKey = (b: string | null | undefined) => (b ?? "").trim().toLowerCase();
export const sameBranch = (a: string | null | undefined, b: string | null | undefined) => branchKey(a) !== "" && branchKey(a) === branchKey(b);

/** Faculty / HoD whose membership names a branch are confined to it. Admins and staff with no branch are not. */
export function staffBranchScope(ctx: Pick<OrgContext, "kind" | "branch">): string | null {
  return ctx.kind === "staff" && branchKey(ctx.branch) ? (ctx.branch as string).trim() : null;
}

export type ScopeResult<T> = { ok: true; value: T } | { ok: false; message: string };

/** The branch a material is published to: a scoped member's own, and an explicit different one is refused rather than silently changed. */
export function resolveMaterialBranch(scope: string | null, requested: string | undefined): ScopeResult<string | undefined> {
  if (!scope) return { ok: true, value: requested };
  if (requested && !sameBranch(scope, requested)) return { ok: false, message: `You can only share materials with ${scope}.` };
  return { ok: true, value: scope };
}

/** Which branches may see a project: a scoped member's own branch only; everyone else keeps whatever they chose (none = all branches). */
export function resolveProjectScope(scope: string | null, requested: readonly string[] | undefined): ScopeResult<string[] | null> {
  if (!scope) return { ok: true, value: requested?.length ? [...requested] : null };
  if (requested?.some((b) => !sameBranch(scope, b))) return { ok: false, message: `You can only post projects for ${scope}.` };
  return { ok: true, value: [scope] };
}
