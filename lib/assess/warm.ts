import { createServiceClient } from "@/lib/supabase/service";
import { loadCareer, loadCareerSkills, type Db } from "./db";
import { primaryCareerOf } from "./session";
import { warmPool } from "./pool";
import { matchFocusSkills } from "@/lib/graduate/focus";

const WARM_CALLS = 60;

/**
 * Background top-up of one role's question pool, so by the time the assessment starts its questions already exist and nothing waits on
 * Groq. `claimed` is the skills a resume names: their cells are filled first, because the first questions come from them.
 */
export async function warmCareerPool(careerId: string, claimed: readonly string[] = []): Promise<void> {
  try {
    const db = createServiceClient() as unknown as Db;
    const career = await loadCareer(db, careerId);
    if (!career) return;
    const skills = await loadCareerSkills(db, career.id);
    const first = new Set(matchFocusSkills(claimed, skills));
    const ordered = [...skills.filter((s) => first.has(s.skillId)), ...skills.filter((s) => !first.has(s.skillId))];
    await warmPool(db, { career, skills: ordered }, {}, WARM_CALLS);
  } catch (e) {
    console.error("[assess] background pool warm-up failed:", e);
  }
}

/** Warms the student's confirmed career. Called with `after()` from the routes that save a career choice. */
export async function warmPrimaryCareerPool(userId: string, claimed: readonly string[] = []): Promise<void> {
  const careerId = await primaryCareerOf(createServiceClient() as unknown as Db, userId);
  if (careerId) await warmCareerPool(careerId, claimed);
}
