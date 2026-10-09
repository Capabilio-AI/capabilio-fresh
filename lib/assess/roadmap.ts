import { createServiceClient } from "@/lib/supabase/service";
import { ensureRoadmap } from "@/lib/roadmap-engine/service";

/**
 * Runs the existing roadmap engine against the student's refreshed capability data. The engine is hash-on-read: it writes a new
 * immutable version only when its inputs (here: the new skill scores) changed, and says what is missing otherwise (for example
 * no curriculum yet), so calling it after every assessment or threshold crossing is safe.
 */
export async function refreshRoadmap(userId: string): Promise<void> {
  try {
    const outcome = await ensureRoadmap(createServiceClient(), userId);
    if (outcome.status !== "READY") console.warn(`[assess] roadmap not generated for ${userId}: ${outcome.status}`);
  } catch (e) {
    console.error("[assess] roadmap refresh failed:", e);
  }
}
