import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getStageState } from "./server";
import type { CareerStage } from "./stage";
import { createServiceClient } from "@/lib/supabase/service";
import { studentHasRole } from "@/lib/careers/has-role";
import { getStudentDirection } from "@/lib/career/direction";
import { unlocksFor } from "@/lib/student/phase";

/** Page guard: anyone whose career stage is not allowed lands on their dashboard instead. Returns the stage when allowed. */
export async function requireStage(allowed: readonly CareerStage[]): Promise<CareerStage> {
  const { user } = await requireAuthedUser();
  const { stage } = await getStageState(user.id);
  if (!allowed.includes(stage)) redirect("/dashboard");
  return stage;
}

/** Student-path pages are not a professional's: they are sent to their own Overview. Returns the stage otherwise. */
export async function keepProfessionalOut(): Promise<CareerStage> {
  const { user } = await requireAuthedUser();
  const { stage } = await getStageState(user.id);
  if (stage === "professional") redirect("/professional");
  return stage;
}

/** Role pages (skills, passport, roadmap): a student who has not chosen a role is sent to their Overview, which shows their assessment only. */
export async function requireRoleChosen(): Promise<void> {
  const { user } = await requireAuthedUser();
  const { stage } = await getStageState(user.id);
  if (stage !== "student") return;
  if (!(await studentHasRole(createServiceClient(), user.id))) redirect("/dashboard");
}

/** Arena opens at 2nd year, or at once for a 1st year who chose a role. A 1st year with no role is sent to their Overview, where Explore roles is. */
export async function requireArenaOpen(): Promise<void> {
  const { user } = await requireAuthedUser();
  const { stage } = await getStageState(user.id);
  if (stage !== "student") return;
  const service = createServiceClient();
  const [hasRole, direction] = await Promise.all([studentHasRole(service, user.id), getStudentDirection(service, user.id)]);
  if (!unlocksFor(direction?.academicYear?.year ?? null, hasRole).arena) redirect("/dashboard");
}

/** API guard for study-programme features (stream challenges): null when the caller is a current student, else a 403 to return. */
export async function studentOnlyResponse(userId: string): Promise<NextResponse | null> {
  const { stage } = await getStageState(userId);
  return stage === "student" ? null : NextResponse.json({ error: "This is part of the student path." }, { status: 403 });
}
