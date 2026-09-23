import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { completeJson } from "@/lib/ai/groq";
import { getStudentBranchContext } from "@/lib/assessment/attempts";
import { buildCareerMatch, type SkillGap } from "@/lib/career/skill-gap";

const PhaseNarrativeSchema = z.object({
  skill: z.string().min(1),
  phase_label: z.string().min(1),
  why: z.string().min(1),
  projects: z.array(z.string().min(1)).min(1),
  milestones: z.array(z.string().min(1)).min(1),
});

const GuidePathNarrativeSchema = z.object({
  phases: z.array(PhaseNarrativeSchema).min(1),
});

export interface GuidePathPhase {
  skill: string;
  currentScore: number | null;
  targetScore: number;
  gap: number;
  phaseLabel: string;
  why: string;
  projects: string[];
  milestones: string[];
}

function buildSystemPrompt(): string {
  return `You are a curriculum planner for an Indian engineering student career platform. Given a
target career, a student's academic year/branch, and a list of skill gaps (each with the exact
current score and required target score already computed — you must NOT invent or alter these
numbers), sequence a phased learning plan.

For each skill gap given, produce one phase: a phase_label tied to the student's actual year/branch
(e.g. "Semester 1", "Year 2", "Year 2/3", "Final year" — sequence smaller/foundational gaps earlier),
a "why" that explicitly references the skill's current and target score, explains why the target
career needs it, and names the specific kind of project it unblocks (be concrete, e.g. "required
before the Retail Sales Analysis project" — invent a plausible, specific project name, not a generic
placeholder), 1-3 concrete project ideas, and 1-3 measurable milestones.

Respond with JSON only:
{ "phases": [ { "skill": "string (must exactly match one of the given skill names)", "phase_label": "string", "why": "string", "projects": ["string"], "milestones": ["string"] } ] }`;
}

function buildUserPrompt(
  targetCareer: string,
  branch: string | null,
  year: number | null,
  gaps: SkillGap[]
): string {
  const context = `Target career: ${targetCareer}\nStudent: ${branch ?? "unspecified branch"}, year ${
    year ?? "unspecified"
  }`;
  const gapLines = gaps
    .map(
      (g) =>
        `- ${g.skill}: current ${g.current ?? "unassessed"}, target ${g.required}, gap ${g.gap}`
    )
    .join("\n");
  return `${context}\n\nSkill gaps to sequence:\n${gapLines}`;
}

/**
 * Dynamic recalculation service — callable on demand (initial generation,
 * or whenever new evidence lands: reassessment, project eval, Arena
 * result). Never a static one-time object. The AI call only produces
 * sequencing + narrative; every score below is this function's own
 * deterministic computation, re-attached after the AI response comes back
 * so a hallucinated number can never reach storage.
 */
export async function generateGuidePathForCareer(
  supabase: SupabaseClient<Database>,
  serviceClient: SupabaseClient<Database>,
  userId: string,
  targetCareer: string,
  isPrimary: boolean
): Promise<{ phases: GuidePathPhase[]; version: number }> {
  const [{ data: requirementRow }, { data: capabilityRows }, branchContext] = await Promise.all([
    supabase.from("career_requirements").select("requirements").eq("career_role", targetCareer).single(),
    supabase.from("capabilities").select("skill, capability_score, confidence").eq("user_id", userId),
    getStudentBranchContext(supabase, userId),
  ]);

  if (!requirementRow) {
    throw new Error(`Unknown career role: ${targetCareer}`);
  }

  const capabilities = (capabilityRows ?? []).map((c) => ({
    skill: c.skill,
    score: c.capability_score,
    confidence: c.confidence,
  }));
  const match = buildCareerMatch(
    targetCareer,
    requirementRow.requirements as Record<string, number>,
    capabilities,
    0
  );
  const gaps = match.skillGaps.filter((g) => g.gap > 0);

  const narrative = await completeJson(
    buildUserPrompt(targetCareer, branchContext.branch, branchContext.year, gaps),
    buildSystemPrompt(),
    GuidePathNarrativeSchema
  );

  const narrativeBySkill = new Map(narrative.phases.map((p) => [p.skill, p]));
  const phases: GuidePathPhase[] = gaps.map((gap) => {
    const n = narrativeBySkill.get(gap.skill);
    return {
      skill: gap.skill,
      currentScore: gap.current,
      targetScore: gap.required,
      gap: gap.gap,
      phaseLabel: n?.phase_label ?? "Unscheduled",
      why: n?.why ?? `${gap.skill} — current ${gap.current ?? "unassessed"}, target ${gap.required}.`,
      projects: n?.projects ?? [],
      milestones: n?.milestones ?? [],
    };
  });

  const { data: existing } = await serviceClient
    .from("guide_paths")
    .select("version")
    .eq("user_id", userId)
    .eq("is_primary", isPrimary)
    .maybeSingle();
  const version = (existing?.version ?? 0) + 1;

  const { error } = await serviceClient.from("guide_paths").upsert(
    {
      user_id: userId,
      target_career: targetCareer,
      is_primary: isPrimary,
      phases: phases as unknown as Database["public"]["Tables"]["guide_paths"]["Row"]["phases"],
      version,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,is_primary" }
  );
  if (error) throw error;

  return { phases, version };
}
