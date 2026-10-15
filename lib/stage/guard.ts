import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getStageState } from "./server";
import type { CareerStage } from "./stage";

/** Page guard: anyone whose career stage is not allowed lands on their dashboard instead. Returns the stage when allowed. */
export async function requireStage(allowed: readonly CareerStage[]): Promise<CareerStage> {
  const { user } = await requireAuthedUser();
  const { stage } = await getStageState(user.id);
  if (!allowed.includes(stage)) redirect("/dashboard");
  return stage;
}

/** API guard for study-programme features (stream challenges): null when the caller is a current student, else a 403 to return. */
export async function studentOnlyResponse(userId: string): Promise<NextResponse | null> {
  const { stage } = await getStageState(userId);
  return stage === "student" ? null : NextResponse.json({ error: "This is part of the student path." }, { status: 403 });
}
