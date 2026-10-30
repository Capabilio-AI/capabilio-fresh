"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUser } from "@/lib/supabase/aal";
import { isPlanId, planSelectionError } from "@/lib/plans/catalog";
import { getStageState, savePlan } from "@/lib/stage/server";

export interface SelectPlanState {
  error?: string;
}

/** Records the chosen plan. Only recently graduated accounts have plans; nothing is charged yet. */
export async function selectPlan(_prev: SelectPlanState, formData: FormData): Promise<SelectPlanState> {
  const user = await getVerifiedUser(await createClient());
  if (!user) redirect("/login");

  const planId = formData.get("plan");
  if (!isPlanId(planId)) return { error: "Pick one of the plans to continue." };
  const paymentError = planSelectionError(planId);
  if (paymentError) return { error: paymentError };
  const { stage } = await getStageState(user.id);
  if (stage !== "graduate") return { error: "Plans are for recently graduated accounts." };
  if (!(await savePlan(user.id, planId))) return { error: "Could not save your plan. Try again." };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
