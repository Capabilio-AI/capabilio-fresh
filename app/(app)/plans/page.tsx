import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getStageState } from "@/lib/stage/server";
import { isPlanId } from "@/lib/plans/catalog";
import { PlanPicker } from "@/components/plans/PlanPicker";

export const metadata: Metadata = { title: "Plans — Capabilio AI" };

export default async function PlansPage() {
  const { user } = await requireAuthedUser();
  const state = await getStageState(user.id);
  if (state.stage !== "graduate") redirect("/dashboard");
  return <PlanPicker current={isPlanId(state.planId) ? state.planId : null} />;
}
