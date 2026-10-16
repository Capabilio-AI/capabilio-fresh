import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import type { Difficulty } from "@/lib/arena-workstations/types";
import { buildBoard, pickStory, sprintWeekStart, type Board, type BoardAssignment, type Story } from "./sprint";
import { worldForRole } from "./worlds";

export interface SprintView {
  company: string;
  story: Story;
  weekStart: string;
  board: Board;
}

interface SprintRow {
  id: string;
  week_start: string;
  company_key: string;
  story_title: string;
  story_blurb: string;
}

/** This week's sprint for the user, created on the first ticket. Null for a role that has no company world. */
export async function ensureSprint(service: SupabaseClient, userId: string, roleKey: string, now = new Date()): Promise<SprintRow | null> {
  const world = worldForRole(roleKey);
  if (!world) return null;
  const db = untyped(service as SupabaseClient<never>);
  const weekStart = sprintWeekStart(now);
  const story = pickStory(world.stories, userId, weekStart);
  await db.from("workplace_sprints").upsert(
    { user_id: userId, role_key: roleKey, week_start: weekStart, company_key: world.key, story_title: story.title, story_blurb: story.blurb },
    { onConflict: "user_id,role_key,week_start", ignoreDuplicates: true }
  );
  const { data } = await db.from("workplace_sprints").select("id, week_start, company_key, story_title, story_blurb").eq("user_id", userId).eq("role_key", roleKey).eq("week_start", weekStart).maybeSingle();
  return (data as SprintRow | null) ?? null;
}

/** Marks a ticket as part of the sprint. */
export async function stampTicket(service: SupabaseClient, attemptId: string, sprintId: string): Promise<void> {
  await untyped(service as SupabaseClient<never>).from("arena_domain_assignments").update({ sprint_id: sprintId }).eq("id", attemptId);
}

interface AssignmentRow {
  id: string;
  challenge_id: string;
  skill_area_key: string | null;
  completed_at: string | null;
  next_available_at: string | null;
}
interface ChallengeRow {
  id: string;
  title: string;
  difficulty: Difficulty;
  kind: string | null;
}

/** Read-only: the week's board. Before the first ticket there is no sprint row yet, so the story is shown from the same pick. */
export async function loadSprintView(service: SupabaseClient, userId: string, roleKey: string, areaNames: Record<string, string>, now = new Date()): Promise<SprintView | null> {
  const world = worldForRole(roleKey);
  if (!world) return null;
  const db = untyped(service as SupabaseClient<never>);
  const weekStart = sprintWeekStart(now);
  const { data: sprint } = await db.from("workplace_sprints").select("id, week_start, company_key, story_title, story_blurb").eq("user_id", userId).eq("role_key", roleKey).eq("week_start", weekStart).maybeSingle();
  const story = sprint ? { title: (sprint as SprintRow).story_title, blurb: (sprint as SprintRow).story_blurb } : pickStory(world.stories, userId, weekStart);

  let assignments: BoardAssignment[] = [];
  if (sprint) {
    const { data: rows } = await db.from("arena_domain_assignments").select("id, challenge_id, skill_area_key, completed_at, next_available_at").eq("sprint_id", (sprint as SprintRow).id).order("assigned_at", { ascending: true });
    const list = (rows ?? []) as AssignmentRow[];
    const { data: challenges } = list.length ? await db.from("arena_challenges").select("id, title, difficulty, kind:content->>taskKind").in("id", list.map((r) => r.challenge_id)) : { data: [] };
    const byId = new Map(((challenges ?? []) as ChallengeRow[]).map((c) => [c.id, c]));
    assignments = list.flatMap((r) => {
      const c = byId.get(r.challenge_id);
      return c ? [{ id: r.id, title: c.title, areaName: areaNames[r.skill_area_key ?? ""] ?? r.skill_area_key ?? "Task", difficulty: c.difficulty, kind: c.kind, completedAt: r.completed_at, nextAvailableAt: r.next_available_at }] : [];
    });
  }
  return { company: world.name, story, weekStart, board: buildBoard({ assignments, now }) };
}
