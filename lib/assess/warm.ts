import { createServiceClient } from "@/lib/supabase/service";
import { loadCareer, loadCareerSkills, type Db } from "./db";
import { primaryCareerOf } from "./session";
import { warmPool } from "./pool";

/**
 * Background top-up of the question pool for the student's confirmed career, so by the time they reach the career assessment its
 * questions already exist and nothing waits on Groq. Called with `after()` from the routes that save a career choice.
 */
export async function warmPrimaryCareerPool(userId: string): Promise<void> {
  try {
    const db = createServiceClient() as unknown as Db;
    const careerId = await primaryCareerOf(db, userId);
    const career = careerId ? await loadCareer(db, careerId) : null;
    if (!career) return;
    await warmPool(db, { career, skills: await loadCareerSkills(db, career.id) }, {}, 60);
  } catch (e) {
    console.error("[assess] background pool warm-up failed:", e);
  }
}
