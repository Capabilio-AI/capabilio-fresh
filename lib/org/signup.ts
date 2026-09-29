import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ORG_TYPES = ["institution", "company"] as const;
export type OrgType = (typeof ORG_TYPES)[number];

// What the applicant may *say* they are. The server maps this to a role; the client never sends a role.
export const INSTITUTION_DESIGNATIONS = ["principal", "vice_principal", "hod", "tpo"] as const;
export type InstitutionDesignation = (typeof INSTITUTION_DESIGNATIONS)[number];

export const MIN_PASSWORD_LENGTH = 8;

// strict(): role / status / org_type-as-trusted / userId etc. are rejected, never silently accepted.
export const OrgSignupSchema = z
  .object({
    orgType: z.enum(ORG_TYPES),
    orgName: z.string().trim().min(2).max(200),
    fullName: z.string().trim().min(2).max(120),
    designation: z.enum(INSTITUTION_DESIGNATIONS).optional(),
    email: z.string().trim().email().max(254),
    password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
  })
  .strict()
  .refine((v) => (v.orgType === "institution" ? v.designation !== undefined : v.designation === undefined), {
    message: "Designation applies to institutions only.",
    path: ["designation"],
  });
export type OrgSignupInput = z.infer<typeof OrgSignupSchema>;

export function roleFor(input: Pick<OrgSignupInput, "orgType" | "designation">): InstitutionDesignation | "company_admin" {
  return input.orgType === "company" ? "company_admin" : (input.designation as InstitutionDesignation);
}

export type OrgSignupResult = { ok: true } | { ok: false; status: number; message: string };

/**
 * `auth` is an anon-key client (like a browser's); `service` is the service-role client.
 * Order matters: the auth user is created first, org rows only after Auth accepts it — and a
 * signUp for an already-registered email returns an identity-less user, in which case nothing
 * is written (no enumeration, and no way to attach an org membership to someone else's account).
 */
export async function registerOrganisation(
  auth: SupabaseClient,
  service: SupabaseClient,
  input: OrgSignupInput,
  emailRedirectTo: string
): Promise<OrgSignupResult> {
  const { data, error } = await auth.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.fullName }, emailRedirectTo },
  });
  if (error) return { ok: false, status: 400, message: error.message };
  if (!data.user || (data.user.identities?.length ?? 0) === 0) return { ok: true };

  const { error: rpcError } = await service.rpc("create_org_signup", {
    p_user_id: data.user.id,
    p_org_name: input.orgName,
    p_org_type: input.orgType,
    p_role: roleFor(input),
  });
  if (rpcError) {
    await service.auth.admin.deleteUser(data.user.id);
    if (rpcError.message.includes("name_taken_other_type")) {
      return { ok: false, status: 409, message: "That name is already registered as a different type of organisation. Please contact us." };
    }
    return { ok: false, status: 500, message: "We couldn't create your organisation account. Please try again." };
  }
  return { ok: true };
}
