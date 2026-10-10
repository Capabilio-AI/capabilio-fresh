"use server";

import { revalidatePath } from "next/cache";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { ProfileDetailsSchema } from "@/lib/profile/details";

export interface ProfileFormState {
  ok: boolean;
  message: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export async function updateProfileDetails(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const parsed = ProfileDetailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: ProfileFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, message: "Check the highlighted fields.", fieldErrors };
  }
  const { supabase, user } = await requireAuthedUser();
  const d = parsed.data;
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: d.fullName, headline: d.headline, bio: d.bio, location: d.location })
    .eq("id", user.id);
  if (error) {
    console.error("[profile] update failed:", error.code, error.message);
    return { ok: false, message: "Couldn't save your profile. Please try again.", fieldErrors: {} };
  }
  revalidatePath("/profile");
  return { ok: true, message: "Profile saved.", fieldErrors: {} };
}
