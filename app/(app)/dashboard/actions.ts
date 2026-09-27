"use server";

import { createClient } from "@/lib/supabase/server";

interface DismissInput {
  statedInterest: string;
  matchesStatedInterest: boolean;
}

/**
 * Marks the one-time Career Direction Explainer as seen, and — when the
 * student's stated interest differs from their computed recommendation —
 * saves that interest as a real plan_b_explorations row (the existing
 * alternate-path entity, not a second disconnected "still interested"
 * flag). No Plan B viewing UI exists yet; this only writes the record so
 * one can be built against real data later.
 */
export async function dismissCareerDirectionIntro(input: DismissInput): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("profiles").update({ has_seen_career_direction_intro: true }).eq("id", user.id);

  if (!input.matchesStatedInterest) {
    await supabase.from("plan_b_explorations").insert({
      user_id: user.id,
      raw_input: input.statedInterest,
      career_concepts: [input.statedInterest],
      status: "exploring",
    });
  }
}
