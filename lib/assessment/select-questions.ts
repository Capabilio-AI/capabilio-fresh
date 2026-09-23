import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums } from "@/lib/supabase/types";
import type { AssessmentSection } from "./sections";
import { QUESTIONS_PER_SECTION } from "./sections";

type CollegeType = Enums<"college_type">;

export interface BranchContext {
  collegeType: CollegeType | null;
  branch: string | null;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Config-driven branch-adaptive question filter: tries the most specific
 * match first (this college type + this branch), then falls back to
 * broader tiers so every section always has QUESTIONS_PER_SECTION
 * questions even where the bank is thin for a given branch. New branches
 * need only new question_bank rows (college_type/branches columns), not
 * new code.
 */
export async function selectQuestionsForSection(
  supabase: SupabaseClient<Database>,
  section: AssessmentSection,
  context: BranchContext
): Promise<string[]> {
  const picked: string[] = [];

  async function addTier(filter: (q: ReturnType<typeof baseQuery>) => typeof q) {
    if (picked.length >= QUESTIONS_PER_SECTION) return;
    const remaining = QUESTIONS_PER_SECTION - picked.length;
    const query = filter(baseQuery());
    const { data } = await query.limit(remaining * 3);
    const candidates = shuffle((data ?? []).filter((q) => !picked.includes(q.id)));
    for (const q of candidates) {
      if (picked.length >= QUESTIONS_PER_SECTION) break;
      picked.push(q.id);
    }
  }

  function baseQuery() {
    let q = supabase
      .from("question_bank")
      .select("id")
      .eq("section", section)
      .eq("active", true);
    if (picked.length > 0) {
      q = q.not("id", "in", `(${picked.join(",")})`);
    }
    return q;
  }

  if (context.collegeType && context.branch) {
    await addTier((q) =>
      q.eq("college_type", context.collegeType!).contains("branches", [context.branch!])
    );
  }
  if (context.collegeType) {
    await addTier((q) => q.eq("college_type", context.collegeType!).is("branches", null));
  }
  await addTier((q) => q.is("college_type", null).is("branches", null));

  return picked;
}
