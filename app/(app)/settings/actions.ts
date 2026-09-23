"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const NameSchema = z.string().trim().min(1, "Name can't be empty").max(200);

export interface UpdateNameState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function updateFullName(_prev: UpdateNameState, formData: FormData): Promise<UpdateNameState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
