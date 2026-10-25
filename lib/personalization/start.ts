import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { inBackground } from "@/lib/assess/background";
import { executeRun, requestGeneration, type StartResult } from "@/lib/roadmap-generate/runs";

type Service = SupabaseClient<Database>;

export interface StartDeps {
  request?: typeof requestGeneration;
  run?: typeof executeRun;
  schedule?: (task: () => Promise<unknown>) => void;
}

/**
 * Stage A of personalization: as soon as a role is confirmed, make sure its roadmap (the source of SkillStudio's modules and the Career Map)
 * is being built. Idempotent: a career that already has one, or is already building one, starts nothing, and a failed run cools down.
 * The roadmap belongs to the career, not the student, so changing role can never attach an old role's pathway to the new one.
 */
export async function startPathway(service: Service, careerId: string, deps: StartDeps = {}): Promise<StartResult> {
  const { request = requestGeneration, run = executeRun, schedule = inBackground } = deps;
  const started = await request(service, careerId);
  if (started.state === "STARTED") schedule(() => run(service, started.runId, careerId));
  return started;
}
