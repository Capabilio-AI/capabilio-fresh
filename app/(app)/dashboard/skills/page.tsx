import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getSkills } from "@/lib/dashboard/data";
import { matchCareersForStudent, normalizeRole } from "@/lib/career/match";
import { getSkillPracticeRecency } from "@/lib/career/skill-decay";
import { gapTier } from "@/lib/career/skill-gap";
import { getCareerIntent } from "@/lib/careers/intent";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHead } from "@/components/dashboard/PageHead";
import { SegmentedLinks } from "@/components/dashboard/SegmentedLinks";
import { getRoadmapGraph } from "@/lib/roadmap-visual/service";
import type { Stage } from "@/lib/roadmap-visual/graph-types";
import { SkillsTab, type CareerSkill } from "@/components/dashboard/SkillsTab";
import { SkillGapsTab } from "@/components/dashboard/SkillGapsTab";

export const metadata: Metadata = { title: "Skills & Gaps — Capabilio AI" };

const FALLBACK_DOMAIN = "Core skills";
/** What a student should be working on at each year; later stages are shown but marked as coming later. */
const FOCUS: Record<number, Stage[]> = { 1: ["FOUNDATION"], 2: ["FOUNDATION", "CORE"], 3: ["CORE", "SPECIALIZATION"], 4: ["SPECIALIZATION", "JOB_READY"] };

export default async function SkillsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const showGaps = view === "gaps";
  const { supabase, user } = await requireAuthedUser();

  const [skills, careerMatches, practiceRecency, { intent }] = await Promise.all([
    getSkills(supabase, user.id),
    matchCareersForStudent(supabase, user.id),
    getSkillPracticeRecency(supabase, user.id),
    getCareerIntent(createServiceClient(), user.id),
  ]);

  // Only the student's own career is shown: their chosen primary, or the closest match while they have not chosen.
  const primaryKey = intent.primary ? normalizeRole(intent.primary.name) : null;
  const match = (primaryKey && careerMatches.find((m) => normalizeRole(m.careerRole) === primaryKey)) || (!intent.primary ? careerMatches[0] : null) || null;
  const careerName = intent.primary?.name ?? match?.careerRole ?? null;

  // A skill's domain comes from the skill catalogue, then from the student's own capability rows.
  const names = match?.skillGaps.map((g) => g.skill) ?? [];
  const { data: domainRows } = names.length ? await supabase.from("skills").select("name, domain").in("name", names) : { data: [] };
  const catalogue = new Map((domainRows ?? []).map((r) => [r.name, r.domain]));
  const own = new Map(skills.map((s) => [s.skill, s.domain]));
  const careerSkills: CareerSkill[] = (match?.skillGaps ?? []).map((g) => ({
    skill: g.skill,
    domain: catalogue.get(g.skill) ?? own.get(g.skill) ?? FALLBACK_DOMAIN,
    score: g.current,
    required: g.required,
  }));
  // Prefer the career's full roadmap tree (every skill area, with stages); fall back to the requirement list when the career has no roadmap yet.
  const graph = await getRoadmapGraph(createServiceClient(), user.id, "primary").catch(() => null);
  let graphSkills: CareerSkill[] = [];
  if (graph?.ok) {
    const year = graph.graph.header.position.year;
    const focus = new Set(FOCUS[Math.min(4, Math.max(1, year ?? 1))]);
    const groups = new Map(graph.graph.nodes.filter((n) => n.type === "GROUP").map((n) => [n.key, n]));
    graphSkills = graph.graph.nodes.flatMap((n) => {
      const g = n.type === "TOPIC" && !n.resource && n.parentKey ? groups.get(n.parentKey) : null;
      return g ? [{ skill: n.title, domain: g.title, score: n.level, required: n.target ?? 0, stage: g.stage, focus: year === null || focus.has(g.stage) }] : [];
    });
  }
  const shownSkills = graphSkills.length ? graphSkills : careerSkills;
  const criticalGaps = match ? match.skillGaps.filter((g) => gapTier(g.gap) === "critical").length : 0;

  return (
    <div>
      <PageHead title="Skills &amp; Gaps" intro="Every skill your career needs, what you can do today, and what to work on at your year." />

      <div className="flex flex-col gap-6 pt-4">
        <SegmentedLinks
          label="Skills view"
          segments={[
            { label: "Skill graph", href: "/dashboard/skills", detail: shownSkills.length ? String(shownSkills.length) : undefined, active: !showGaps },
            { label: "Skill gaps", href: "/dashboard/skills?view=gaps", detail: criticalGaps > 0 ? `${criticalGaps} critical` : undefined, active: showGaps },
          ]}
        />
        {showGaps ? (
          <SkillGapsTab matches={match ? [match] : []} practiceRecency={practiceRecency} />
        ) : (
          <SkillsTab careerName={careerName} skills={shownSkills} />
        )}
      </div>
    </div>
  );
}
