"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { getVerifiedUser } from "@/lib/supabase/aal";
import { checkRateLimit } from "@/lib/rate-limit/check";
import { canSelfDelete, isDeleteConfirmed } from "@/lib/settings/deletion";

const NameSchema = z.string().trim().min(1, "Name can't be empty").max(200);

export interface UpdateNameState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function updateFullName(_prev: UpdateNameState, formData: FormData): Promise<UpdateNameState> {
  const supabase = await createClient();
  const user = await getVerifiedUser(supabase);
  if (!user) redirect("/login");

  const parsed = NameSchema.safeParse(formData.get("fullName"));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid name" };
  }

  const { error } = await supabase.from("profiles").update({ full_name: parsed.data }).eq("id", user.id);
  if (error) {
    return { status: "error", message: "Could not save — try again." };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { status: "success", message: "Saved" };
}

export interface DeleteAccountState {
  status: "idle" | "error";
  message?: string;
}

/**
 * Permanently deletes the signed-in account. Every user-owned table cascades from the auth user, so removing it
 * removes the data. Requires the current password again and a typed confirmation; the caller never supplies a user id.
 */
export async function deleteAccount(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const supabase = await createClient();
  const user = await getVerifiedUser(supabase);
  if (!user?.email) redirect("/login");
  const limit = await checkRateLimit(user.id, { bucket: "account-delete", maxRequests: 5, windowSeconds: 3600 });
  if (!limit.allowed) return { status: "error", message: "Too many attempts. Try again in an hour." };

  if (!isDeleteConfirmed(String(formData.get("confirm") ?? ""))) {
    return { status: "error", message: "Type DELETE to confirm." };
  }
  const password = String(formData.get("password") ?? "");
  if (!password) return { status: "error", message: "Enter your password to confirm." };

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("primary_role").eq("id", user.id).single();
  if (!canSelfDelete(profile?.primary_role)) {
    return { status: "error", message: "Organisation accounts can't be deleted from here. Contact your platform administrator." };
  }

  // A separate, cookie-less client: checking the password must not touch or replace the live session.
  const verifier = createAnonClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: passwordError } = await verifier.auth.signInWithPassword({ email: user.email, password });
  if (!passwordError) await verifier.auth.signOut(); // the check opened a real session; close it
  if (passwordError) return { status: "error", message: "That password is incorrect." };

  // The one reference to profiles that does not cascade; clear it so a verifier's account can still be deleted.
  // lib/supabase/types.ts predates proof_of_work, so this one table goes through a narrow cast.
  const proofTable = (service as unknown as { from: (t: string) => { update: (v: object) => { eq: (c: string, v: string) => PromiseLike<{ error: unknown }> } } }).from("proof_of_work");
  const { error: releaseError } = await proofTable.update({ verified_by: null }).eq("verified_by", user.id);
  if (releaseError) return { status: "error", message: "Could not delete your account. Please try again." };

  const { error: deleteError } = await service.auth.admin.deleteUser(user.id);
  if (deleteError) return { status: "error", message: "Could not delete your account. Please try again." };

  await supabase.auth.signOut();
  redirect("/");
}
