"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUser } from "@/lib/supabase/aal";
import { deleteEmployment, markEmployed } from "@/lib/stage/server";

export interface EmploymentFormState {
  error?: string;
  saved?: boolean;
}

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");
const EmploymentSchema = z
  .object({
    employerName: z.string().trim().min(1, "Enter the company.").max(120),
    jobTitle: z.string().trim().min(1, "Enter your job title.").max(120),
    startDate: z.union([z.literal(""), DATE]),
    current: z.boolean(),
    endDate: z.union([z.literal(""), DATE]),
  })
  .refine((v) => v.current || v.endDate !== "", { message: "Add an end date, or tick that you work here now.", path: ["endDate"] })
  .refine((v) => v.current || v.startDate === "" || v.endDate >= v.startDate, { message: "The end date is before the start date.", path: ["endDate"] });

async function signedInUserId(): Promise<string> {
  const user = await getVerifiedUser(await createClient());
  if (!user) redirect("/login");
  return user.id;
}

/** Adds a job to the employment history. A current job moves a graduate to the professional path, so the whole app is refreshed. */
export async function addEmployment(_prev: EmploymentFormState, formData: FormData): Promise<EmploymentFormState> {
  const userId = await signedInUserId();
  const parsed = EmploymentSchema.safeParse({
    employerName: formData.get("employerName"),
    jobTitle: formData.get("jobTitle"),
    startDate: formData.get("startDate") ?? "",
    current: formData.get("current") === "on",
    endDate: formData.get("endDate") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details and try again." };

  const { employerName, jobTitle, startDate, current, endDate } = parsed.data;
  const result = await markEmployed(userId, { employerName, jobTitle, employedSince: startDate || null, employedUntil: current ? null : endDate });
  if (result === "failed") return { error: "Could not save this job. Try again." };

  revalidatePath("/", "layout");
  if (result === "moved") redirect("/dashboard");
  return { saved: true };
}

export async function removeEmployment(id: string): Promise<void> {
  const userId = await signedInUserId();
  if (z.string().uuid().safeParse(id).success) await deleteEmployment(userId, id);
  revalidatePath("/dashboard/vault");
}
