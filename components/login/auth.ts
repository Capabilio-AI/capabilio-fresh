import { createClient } from "@/lib/supabase/client";
import { getRole, RoleId } from "./roles";

export interface Institution {
  id: string;
  name: string;
}

export type AuthOutcome =
  | { status: "success"; resolvedRole: RoleId; fullName: string | null; institutions: Institution[] }
  | { status: "invalid-credentials" }
  | { status: "unverified" }
  | { status: "pending-approval"; organisationName: string | null; orgType: "institution" | "company" | null }
  | { status: "network-error" };

const SELF_SERVE_ROLES: RoleId[] = ["student", "professional"];

export async function signIn(email: string, password: string): Promise<AuthOutcome> {
  const supabase = createClient();

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    const message = signInError.message.toLowerCase();
    if (message.includes("email not confirmed")) {
      return { status: "unverified" };
    }
    if (message.includes("invalid login credentials")) {
      return { status: "invalid-credentials" };
    }
    return { status: "network-error" };
  }

  const user = signInData.user;
  if (!user) {
    return { status: "invalid-credentials" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("primary_role, full_name")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { status: "network-error" };
  }

  if (SELF_SERVE_ROLES.includes(profile.primary_role)) {
    return {
      status: "success",
      resolvedRole: profile.primary_role,
      fullName: profile.full_name,
      institutions: [],
    };
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("institution_memberships")
    .select("status, institutions ( id, name )")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (membershipError) {
    return { status: "network-error" };
  }

  if (!memberships || memberships.length === 0) {
    // Name the organisation that is waiting (own row, readable under RLS), then don't leave a
    // live session behind a "pending" screen.
    const { data: pending } = await supabase
      .from("institution_memberships")
      .select("institutions ( name, org_type )")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1);
    const org = pending?.[0]?.institutions as { name: string; org_type: string } | null | undefined;
    await supabase.auth.signOut();
    return {
      status: "pending-approval",
      organisationName: org?.name ?? null,
      orgType: org?.org_type === "company" ? "company" : org ? "institution" : null,
    };
  }

  const institutions = memberships
    .map((m) => m.institutions)
    .filter((i): i is Institution => Boolean(i));

  return {
    status: "success",
    resolvedRole: profile.primary_role,
    fullName: profile.full_name,
    institutions,
  };
}

export interface SignUpInput {
  firstName: string;
  lastName: string;
  collegeName: string;
  branch: string;
  startYear: number;
  endYear: number;
  email: string;
  password: string;
}

export type SignUpOutcome = { status: "success" } | { status: "error"; message: string };

export async function signUp(input: SignUpInput): Promise<SignUpOutcome> {
  const supabase = createClient();
  const fullName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();

  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        full_name: fullName,
        college_name: input.collegeName.trim(),
        branch: input.branch.trim(),
        start_year: String(input.startYear),
        end_year: String(input.endYear),
        role: "student",
      },
      emailRedirectTo: `${window.location.origin}/auth/confirm?next=/verified`,
    },
  });

  // Supabase deliberately returns success (not an error) when the email is
  // already registered and email confirmation is required, as an anti
  // account-enumeration measure — so a distinct "already registered" state
  // is never surfaced here, by design.
  if (error) {
    return { status: "error", message: error.message };
  }

  return { status: "success" };
}

export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
  });
  // Deliberately no error surfaced to the caller: Supabase already returns
  // the same response whether the email exists or not, and we don't add a
  // second layer that could leak account existence.
}

export async function resendVerificationEmail(email: string): Promise<void> {
  const supabase = createClient();
  await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=/verified` },
  });
}

export function portalFor(role: RoleId): string {
  return getRole(role).portal;
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  // Default scope is "global" — invalidates the refresh token server-side
  // (not just a local no-op) and clears the SSR-managed auth cookies this
  // client stores the session in (lib/supabase/client.ts uses
  // @supabase/ssr's createBrowserClient specifically so cookies, not
  // localStorage, are the source of truth — the same cookies
  // lib/supabase/server.ts reads on every server-rendered request).
  await supabase.auth.signOut();
}
