"use server";

import { revalidatePath } from "next/cache";
import { requireAuthedUser } from "@/lib/supabase/auth";

/** The student's own switch for the public passport page (off until they turn it on). */
export async function setPassportSharing(enabled: boolean): Promise<{ ok: boolean }> {
  const { supabase, user } = await requireAuthedUser();
  const { error } = await supabase.from("profiles").update({ passport_public: enabled }).eq("id", user.id);
  if (error) {
    console.error("[passport] sharing update failed:", error.code, error.message);
    return { ok: false };
  }
  revalidatePath("/profile");
  return { ok: true };
}
