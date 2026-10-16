import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getCareerIntent, type IntentView } from "@/lib/careers/intent";
import { getStatedCareerInterest } from "./interest-statement";

/**
 * Pure. The career a student's work tickets are for: the one they chose in Career Path (their Plan B if they chose to change role), the same one the
 * Domain Challenges page shows. The free-text answer from the first assessment is only the fallback for someone who has not chosen one, because it can
 * be empty or out of date and must never override an explicit choice.
 */
export function workstationCareer(intent: Pick<IntentView, "primary" | "secondary" | "planBKind">, statedRole: string | null): string | null {
  const chosen = intent.planBKind === "change_role" ? intent.secondary ?? intent.primary : intent.primary;
  return chosen?.name ?? statedRole;
}

export async function getWorkstationCareer(service: SupabaseClient<Database>, userId: string): Promise<string | null> {
  const [{ intent }, stated] = await Promise.all([getCareerIntent(service, userId), getStatedCareerInterest(service, userId)]);
  return workstationCareer(intent, stated);
}
