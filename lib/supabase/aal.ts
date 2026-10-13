interface FactorLike {
  status: string;
}

interface UserLike {
  factors?: FactorLike[] | null;
}

interface VerifyingClient<U extends UserLike> {
  auth: {
    getUser: () => Promise<{ data: { user: U | null }; error: unknown }>;
    mfa: { getAuthenticatorAssuranceLevel: () => Promise<{ data: { currentLevel: string | null } | null }> };
  };
}

const hasVerifiedFactor = (user: UserLike): boolean => (user.factors ?? []).some((f) => f.status === "verified");

/**
 * The signed-in user, or null. A password-only session on an account with a verified second factor counts as signed out.
 * The factor list comes from the auth server (getUser), never from the session cookie, which the holder can edit.
 * Any failure to find out answers null: this check fails closed.
 */
export async function getVerifiedUser<U extends UserLike>(supabase: VerifyingClient<U>): Promise<U | null> {
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  if (error || !user) return null;
  if (!hasVerifiedFactor(user)) return user;
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return aal?.currentLevel === "aal2" ? user : null;
}

/**
 * Same question for callers that already hold verified claims (the app layout reads claims locally, no network).
 * Only a password-only (aal1) token needs the server look; accounts on aal2 cost nothing extra.
 */
export async function secondFactorPending<U extends UserLike>(supabase: VerifyingClient<U>, claimAal: unknown): Promise<boolean> {
  if (claimAal !== "aal1") return false;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return true;
  return hasVerifiedFactor(data.user);
}
