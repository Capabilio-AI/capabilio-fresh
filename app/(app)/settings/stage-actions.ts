"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUser } from "@/lib/supabase/aal";
import { markEmployed, markGraduated } from "@/lib/stage/server";
import { canDeclareGraduated } from "@/lib/stage/finish-studies";
import { createServiceClient } from "@/lib/supabase/service";
import { getStudentDirection } from "@/lib/career/direction";

export interface StageActionState {
  error?: string;
}

const JobSchema = z.object({
  employerName: z.string().trim().min(1, "Enter the company you joined.").max(120),
  jobTitle: z.string().trim().min(1, "Enter your job title.").max(120),
  employedSince: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid start date.")]).optional(),
});

async function signedInUserId(): Promise<string> {
  const user = await getVerifiedUser(await createClient());
  if (!user) redirect("/login");
  return user.id;
}

/** After a move the whole app path changes, so every layout is refreshed and the user lands on their new dashboard. */
function landOnDashboard(): never {
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/** "I have finished my studies": the profile becomes a recently graduated one straight away. */
export async function finishStudies(): Promise<StageActionState> {
  const userId = await signedInUserId();
  if (!canDeclareGraduated(await getStudentDirection(createServiceClient(), userId))) {
    return { error: "You can finish your studies once you are in your final year or your programme has ended." };
  }
  if (!(await markGraduated(userId))) return { error: "Your profile could not be moved. Try again, or contact support." };
  return landOnDashboard();
}

/** "I got a job": the profile moves to the professional path and keeps its evidence. */
export async function reportJob(_prev: StageActionState, formData: FormData): Promise<StageActionState> {
  const userId = await signedInUserId();
  const parsed = JobSchema.safeParse({
    employerName: formData.get("employerName"),
    jobTitle: formData.get("jobTitle"),
    employedSince: formData.get("employedSince") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details and try again." };

  const { employerName, jobTitle, employedSince } = parsed.data;
  if ((await markEmployed(userId, { employerName, jobTitle, employedSince: employedSince || null })) === "failed") {
    return { error: "Your profile could not be moved. Try again, or contact support." };
  }
  return landOnDashboard();
}
