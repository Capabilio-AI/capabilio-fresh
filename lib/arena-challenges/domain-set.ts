import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { getCareerIntent } from "@/lib/careers/intent";
import { loadCareers, loadSkillNames } from "@/lib/careers/data";
import { loadStudentCapabilities } from "@/lib/capability/read-model";
import { effectiveLevel } from "@/lib/roadmap-engine/gaps";
import { RUNTIMES } from "@/lib/arena-runtime/registry";
import type { RuntimeType } from "@/lib/arena-runtime/types";
import { ELO_BY_DIFFICULTY, type Difficulty } from "@/lib/arena-workstations/types";
import { chooseDomainCareer, type CareerChoice, type DomainCareerState } from "./career-state";
import { DOMAIN_SET_SIZE, explainPick, recommendForSkill, selectDomainSet, type DomainCandidate, type SkillGap } from "./select-domain";
import { weekStartOf } from "./week";

type Service = SupabaseClient<Database>;

export type ItemStatus = "NOT_STARTED" | "IN_PROGRESS" | "PASSED" | "FAILED" | "NEEDS_REVIEW";

export interface DomainSetItem {
  id: string;
  title: string;
  difficulty: string;
  estMinutes: number | null;
  skills: { id: string; name: string }[];
  status: ItemStatus;
  eloAvailable: number;
  runtimeType: RuntimeType | null;
  /** the workstation exists, is enabled, and so can be opened now */
  startable: boolean;
  why: string;
}

export type DomainSetView =
  | Exclude<DomainCareerState, { state: "ready" }>
  | { state: "ready"; which: CareerChoice; career: { id: string; key: string; name: string }; planB: string | null; primary: string; items: DomainSetItem[]; shortfall: number };

interface CatalogRow {
  id: string;
  title: string;
  difficulty: string;
  est_minutes: number | null;
  time_limit_minutes: number;
  workstation_template_id: string | null;
}

interface PublishedDomainPool {
  rows: Map<string, CatalogRow>;
  candidates: (DomainCandidate & { careerIds: string[] })[];
  runtimeOf: Map<string, RuntimeType>;
  enabledRuntimes: Set<RuntimeType>;
}

/** Every PUBLISHED catalog Domain challenge linked to one of `careerIds`, with its canonical skills, career links and workstation. */
async function loadPublishedDomainPool(service: Service, careerIds: string[] | null): Promise<PublishedDomainPool> {
  const db = untyped(service);
  let links = db.from("challenge_careers").select("challenge_id, career_id");
  if (careerIds) links = links.in("career_id", careerIds);
  const { data: linkRows } = await links;
  const ids = [...new Set((linkRows ?? []).map((l: { challenge_id: string }) => l.challenge_id))];
  const empty: PublishedDomainPool = { rows: new Map(), candidates: [], runtimeOf: new Map(), enabledRuntimes: new Set() };
  if (ids.length === 0) return empty;

  const [{ data: rows }, { data: skillRows }, { data: allLinks }, { data: settings }] = await Promise.all([
    db.from("arena_challenges").select("id, title, difficulty, est_minutes, time_limit_minutes, workstation_template_id").in("id", ids).eq("track", "domain").eq("status", "PUBLISHED").is("user_id", null),
    db.from("arena_challenge_skills").select("challenge_id, skill_id").in("challenge_id", ids),
    db.from("challenge_careers").select("challenge_id, career_id").in("challenge_id", ids),
    db.from("runtime_settings").select("runtime_type, enabled"),
  ]);
  const published = (rows ?? []) as CatalogRow[];
  const templateIds = [...new Set(published.flatMap((r) => (r.workstation_template_id ? [r.workstation_template_id] : [])))];
  const { data: templates } = templateIds.length ? await db.from("workstation_templates").select("id, runtime_type").in("id", templateIds) : { data: [] };
  const typeOfTemplate = new Map<string, RuntimeType>((templates ?? []).map((t: { id: string; runtime_type: RuntimeType }) => [t.id, t.runtime_type]));

  const group = (list: { challenge_id: string }[] | null, pick: (r: never) => string) => {
    const m = new Map<string, string[]>();
    for (const r of (list ?? []) as never[]) {
      const k = (r as { challenge_id: string }).challenge_id;
      m.set(k, [...(m.get(k) ?? []), pick(r)]);
    }
    return m;
  };
  const skillsOf = group(skillRows, (r: { skill_id: string }) => r.skill_id);
  const careersOf = group(allLinks, (r: { career_id: string }) => r.career_id);

  return {
    rows: new Map(published.map((r) => [r.id, r])),
    candidates: published.map((r) => ({ id: r.id, difficulty: r.difficulty, skillIds: skillsOf.get(r.id) ?? [], careerIds: careersOf.get(r.id) ?? [] })),
    runtimeOf: new Map(published.flatMap((r) => (r.workstation_template_id && typeOfTemplate.has(r.workstation_template_id) ? [[r.id, typeOfTemplate.get(r.workstation_template_id)!] as const] : []))),
    enabledRuntimes: new Set((settings ?? []).filter((s: { enabled: boolean }) => s.enabled).map((s: { runtime_type: RuntimeType }) => s.runtime_type)),
  };
}

async function loadAttemptState(service: Service, userId: string, since: string) {
  const { data } = await untyped(service).from("challenge_attempts").select("challenge_id, status, started_at, submitted_at").eq("student_id", userId).order("started_at", { ascending: false });
  const rows = (data ?? []) as { challenge_id: string; status: string; started_at: string; submitted_at: string | null }[];
  const latest = new Map<string, string>();
  for (const r of rows) if (!latest.has(r.challenge_id)) latest.set(r.challenge_id, r.status);
  const passedEver = new Set(rows.filter((r) => r.status === "PASSED").map((r) => r.challenge_id));
  const passedThisWeek = new Set(rows.filter((r) => r.status === "PASSED" && (r.submitted_at ?? r.started_at) >= since).map((r) => r.challenge_id));
  return { latest, passedEver, passedThisWeek };
}

const statusOf = (latest: string | undefined): ItemStatus => (latest === "IN_PROGRESS" || latest === "PASSED" || latest === "FAILED" || latest === "NEEDS_REVIEW" ? latest : "NOT_STARTED");

/**
 * The student's Domain set for their primary career (or Plan B): the challenges they passed this week stay listed so the set does not shift
 * under them, and the rest are chosen by selectDomainSet from their real skill gaps. Never invents a career or a challenge.
 */
export async function loadDomainSet(service: Service, userId: string, which: CareerChoice, now: Date = new Date()): Promise<DomainSetView> {
  const { intent } = await getCareerIntent(service, userId);
  const chosen = chooseDomainCareer(intent, which);
  if (chosen.state !== "ready") return chosen;

  const [careers, skillNames, caps, pool, attempts] = await Promise.all([
    loadCareers(service),
    loadSkillNames(service),
    loadStudentCapabilities(service, userId),
    loadPublishedDomainPool(service, [chosen.career.id]),
    loadAttemptState(service, userId, weekStartOf(now)),
  ]);

  const requirements = careers.find((c) => c.id === chosen.career.id)?.requirements ?? [];
  const gaps: SkillGap[] = requirements.map((r) => {
    const cap = caps.bySkill.get(r.skillId);
    const current = cap ? effectiveLevel({ level: cap.level ?? 0, assessed: cap.level !== null, confidence: cap.confidence, verified: cap.verified, verifiedLevel: cap.verifiedLevel, selfDeclaredLevel: cap.selfDeclaredLevel }) : 0;
    return { skillId: r.skillId, skillName: skillNames.get(r.skillId) ?? "this skill", current, hasData: Boolean(cap), target: r.targetLevel, importance: r.importance };
  });

  const kept = pool.candidates.filter((c) => attempts.passedThisWeek.has(c.id));
  const fresh = selectDomainSet(pool.candidates, attempts.passedEver, gaps, Math.max(0, DOMAIN_SET_SIZE - kept.length));
  const picks = [...kept.map((c) => ({ id: c.id, reason: null })), ...fresh];

  const items = picks.flatMap((p): DomainSetItem[] => {
    const row = pool.rows.get(p.id);
    const cand = pool.candidates.find((c) => c.id === p.id);
    if (!row || !cand) return [];
    const runtimeType = pool.runtimeOf.get(p.id) ?? null;
    const status = statusOf(attempts.latest.get(p.id));
    return [
      {
        id: row.id,
        title: row.title,
        difficulty: row.difficulty,
        estMinutes: row.est_minutes ?? row.time_limit_minutes,
        skills: cand.skillIds.map((id) => ({ id, name: skillNames.get(id) ?? "Skill" })),
        status,
        eloAvailable: ELO_BY_DIFFICULTY[row.difficulty as Difficulty] ?? 0,
        runtimeType,
        startable: runtimeType !== null && RUNTIMES[runtimeType].status === "available" && pool.enabledRuntimes.has(runtimeType),
        why: status === "PASSED" ? "Completed this week." : explainPick(p.reason, chosen.career.name),
      },
    ];
  });
  const order = { easy: 0, medium: 1, hard: 2 } as Record<string, number>;
  items.sort((a, b) => (order[a.difficulty] ?? 0) - (order[b.difficulty] ?? 0));
  return { ...chosen, items, shortfall: DOMAIN_SET_SIZE - items.length };
}

/** "Recommended challenges for skill X (and career Y)" -- the stable query the Roadmap page can use for its Arena section. */
export async function recommendChallengesForSkill(service: Service, userId: string, skillId: string, careerId: string | null, limit = 5) {
  const [caps, pool, attempts] = await Promise.all([loadStudentCapabilities(service, userId), loadPublishedDomainPool(service, null), loadAttemptState(service, userId, "0000-00-00")]);
  const cap = caps.bySkill.get(skillId);
  const ids = recommendForSkill({ pool: pool.candidates, solvedIds: attempts.passedEver, skillId, careerId, level: cap?.level ?? null, limit });
  return ids.flatMap((id) => {
    const row = pool.rows.get(id);
    return row ? [{ id, title: row.title, difficulty: row.difficulty, estMinutes: row.est_minutes ?? row.time_limit_minutes, runtimeType: pool.runtimeOf.get(id) ?? null }] : [];
  });
}
