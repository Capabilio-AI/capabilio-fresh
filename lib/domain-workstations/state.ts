import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { pickNextTicket, resolveDailyState, type AssignmentRow } from "./daily";
import type { DomainRole } from "./roles";

// Never includes ground_truth_query/expected_output.
const TICKET_COLUMNS = "id, title, category, difficulty, time_limit_minutes, scenario, objective, starter_code, skill_tags, requester, sequence";

type Ticket = Pick<
  Database["public"]["Tables"]["arena_challenges"]["Row"],
  "id" | "title" | "category" | "difficulty" | "time_limit_minutes" | "scenario" | "objective" | "starter_code" | "skill_tags" | "requester" | "sequence"
>;

export type DomainState =
  | { state: "not_started"; completedCount: number; totalCount: number }
  | { state: "active"; assignmentId: string; assignedAt: string; ticket: Ticket; completedCount: number; totalCount: number }
  | { state: "cooldown"; nextAvailableAt: string; completedCount: number; totalCount: number }
  | { state: "complete"; completedCount: number; totalCount: number };

/**
 * Resolves (and, when due, hands out) the student's one ticket for this role.
 * `autoStart` is false for students who haven't opted in and whose stated
 * career doesn't match the role — they see a "start" screen instead.
 */
export async function loadDomainState(service: SupabaseClient<Database>, userId: string, role: DomainRole, autoStart: boolean): Promise<DomainState> {
  const [{ data: assignmentRows }, { data: ticketRows }] = await Promise.all([
    service.from("arena_domain_assignments").select("id, challenge_id, assigned_at, completed_at, next_available_at").eq("user_id", userId).eq("role_key", role.key),
    service.from("arena_challenges").select("id, sequence").eq("track", "domain").eq("scope_key", role.key).eq("active", true),
  ]);
  const assignments: AssignmentRow[] = assignmentRows ?? [];
  const tickets = ticketRows ?? [];
  const counts = { completedCount: assignments.filter((a) => a.completed_at).length, totalCount: tickets.length };

  if (assignments.length === 0 && !autoStart) return { state: "not_started", ...counts };

  const daily = resolveDailyState(assignments, new Date());
  if (daily.kind === "cooldown") return { state: "cooldown", nextAvailableAt: daily.nextAvailableAt, ...counts };

  let open = daily.kind === "active" ? daily.assignment : null;
  if (!open) {
    const next = pickNextTicket(tickets, new Set(assignments.map((a) => a.challenge_id)));
    if (!next) return { state: "complete", ...counts };

    const { data: inserted, error } = await service
      .from("arena_domain_assignments")
      .insert({ user_id: userId, role_key: role.key, challenge_id: next.id })
      .select("id, challenge_id, assigned_at, completed_at, next_available_at")
      .single();
    if (error?.code === "23505") {
      // Another request (second tab) handed out the ticket first — use theirs.
      const { data: existing } = await service.from("arena_domain_assignments").select("id, challenge_id, assigned_at, completed_at, next_available_at").eq("user_id", userId).eq("role_key", role.key).is("completed_at", null).single();
      open = existing;
    } else if (error) {
      throw error;
    } else {
      open = inserted;
    }
  }
  if (!open) throw new Error("Could not resolve the open domain ticket.");

  const { data: ticket } = await service.from("arena_challenges").select(TICKET_COLUMNS).eq("id", open.challenge_id).single();
  if (!ticket) throw new Error(`Domain ticket ${open.challenge_id} not found.`);
  return { state: "active", assignmentId: open.id, assignedAt: open.assigned_at, ticket, ...counts };
}
