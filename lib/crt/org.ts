import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { onlyCurrentStudents } from "@/lib/org/current-students";
import { computeCurrentAcademicYear } from "@/lib/career/academic-year";
import { staffWithPermission } from "@/lib/notifications/audiences";
import { notify } from "@/lib/notifications/notify";
import { appliesTo, attemptExpired, cycleStatus, suggestNextWindow, type CycleStatus } from "./cycle";
import { summarizeCycle, type CycleSummary, type ResultRow } from "./aggregate";
import { MODULE_LABEL, type ModuleScores } from "./model";
import { finalizeAttempt, todayIst } from "./server";

type Service = SupabaseClient<Database>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.").refine((d) => !Number.isNaN(Date.parse(d)), "Enter a valid date.");

export const CreateCycleSchema = z
  .object({
    title: z.string().trim().min(2, "Give the cycle a name.").max(120),
    opensOn: isoDate,
    closesOn: isoDate,
    branches: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
    years: z.array(z.coerce.number().int().min(1).max(6)).max(6).optional(),
    durationMinutes: z.coerce.number().int().min(15, "At least 15 minutes.").max(180, "At most 180 minutes.").default(60),
  })
  .strict()
  .refine((v) => v.closesOn > v.opensOn, { message: "The close date must be after the open date.", path: ["closesOn"] });
export type CreateCycleInput = z.infer<typeof CreateCycleSchema>;

interface CycleRow {
  id: string;
  college_id: string;
  title: string;
  opens_on: string;
  closes_on: string;
  branches: string[] | null;
  years: number[] | null;
  duration_minutes: number;
  report_sent_at: string | null;
}
interface AttemptRow {
  id: string;
  cycle_id: string;
  user_id: string;
  deadline_at: string;
  submitted_at: string | null;
  question_ids: string[];
  answers: Record<string, string>;
  module_scores: ModuleScores | null;
  total_pct: number | null;
}
interface Student {
  userId: string;
  branch: string | null;
  year: number | null;
  rollNumber: string | null;
}

/** Active, still-enrolled students of a college with the year of study worked out the way the student's own dashboard does. */
async function collegeStudents(service: Service, institutionId: string): Promise<Student[]> {
  const { data: inst } = await untyped(service).from("institutions").select("academic_start_month").eq("id", institutionId).maybeSingle();
  const cycleStartMonth = (inst as { academic_start_month: number | null } | null)?.academic_start_month ?? undefined;
  const { data } = await onlyCurrentStudents(
    untyped(service).from("institution_memberships").select("user_id, branch, roll_number, start_year, end_year, year_override").eq("institution_id", institutionId).eq("role", "student").eq("status", "active")
  ).limit(5000);
  type M = { user_id: string; branch: string | null; roll_number: string | null; start_year: number | null; end_year: number | null; year_override: number | null };
  const seen = new Set<string>();
  const out: Student[] = [];
  for (const m of (data ?? []) as M[]) {
    if (seen.has(m.user_id)) continue;
    seen.add(m.user_id);
    const year = computeCurrentAcademicYear({ startYear: m.start_year, endYear: m.end_year, override: m.year_override, cycleStartMonth })?.year ?? null;
    out.push({ userId: m.user_id, branch: m.branch, year, rollNumber: m.roll_number });
  }
  return out;
}

const chunk = <T,>(xs: readonly T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

async function profilesFor(service: Service, ids: readonly string[]): Promise<Map<string, { name: string; email: string | null }>> {
  const out = new Map<string, { name: string; email: string | null }>();
  for (const part of chunk(ids, 200)) {
    const { data } = await service.from("profiles").select("id, full_name, email").in("id", part);
    for (const p of data ?? []) out.set(p.id, { name: p.full_name ?? p.email ?? "Student", email: p.email });
  }
  return out;
}

export interface OrgCycle {
  id: string;
  title: string;
  opensOn: string;
  closesOn: string;
  durationMinutes: number;
  branches: string[] | null;
  years: number[] | null;
  status: CycleStatus;
  reportSent: boolean;
  summary: CycleSummary;
}

export interface OrgCrtOverview {
  cycles: OrgCycle[];
  selected: { cycle: OrgCycle; rows: (ResultRow & { rollNumber: string | null; email: string | null })[] } | null;
  suggested: { opensOn: string; closesOn: string };
  branchOptions: { value: string; label: string }[];
}

export async function loadCrtOverview(service: Service, institutionId: string, selectedId?: string | null): Promise<OrgCrtOverview> {
  const db = untyped(service);
  const [{ data: cycleRows }, students] = await Promise.all([
    db.from("crt_cycles").select("*").eq("college_id", institutionId).order("opens_on", { ascending: false }).limit(12),
    collegeStudents(service, institutionId),
  ]);
  const rows = (cycleRows ?? []) as CycleRow[];
  const { data: attemptRows } = rows.length ? await db.from("crt_attempts").select("id, cycle_id, user_id, deadline_at, submitted_at, module_scores, total_pct").in("cycle_id", rows.map((c) => c.id)) : { data: [] };
  const attempts = (attemptRows ?? []) as AttemptRow[];
  const today = todayIst();

  const resultRows = (c: CycleRow): { rows: (ResultRow & { rollNumber: string | null })[]; eligible: number } => {
    const eligible = students.filter((s) => appliesTo({ branches: c.branches, years: c.years }, s.branch, s.year));
    const mine = new Map(attempts.filter((a) => a.cycle_id === c.id).map((a) => [a.user_id, a]));
    const out = eligible.map((s) => {
      const a = mine.get(s.userId);
      const done = a?.submitted_at && a.module_scores && a.total_pct !== null;
      return { userId: s.userId, name: s.userId, branch: s.branch, rollNumber: s.rollNumber, started: Boolean(a), totalPct: done ? Number(a!.total_pct) : null, moduleScores: done ? a!.module_scores : null };
    });
    return { rows: out, eligible: eligible.length };
  };

  const cycles: OrgCycle[] = rows.map((c) => ({
    id: c.id,
    title: c.title,
    opensOn: c.opens_on,
    closesOn: c.closes_on,
    durationMinutes: c.duration_minutes,
    branches: c.branches,
    years: c.years,
    status: cycleStatus({ opensOn: c.opens_on, closesOn: c.closes_on }, today),
    reportSent: Boolean(c.report_sent_at),
    summary: summarizeCycle(resultRows(c).rows, resultRows(c).eligible),
  }));

  const pick = cycles.find((c) => c.id === selectedId) ?? cycles[0] ?? null;
  let selected: OrgCrtOverview["selected"] = null;
  if (pick) {
    const { rows: detail } = resultRows(rows.find((c) => c.id === pick.id)!);
    const profiles = await profilesFor(service, detail.map((r) => r.userId));
    selected = {
      cycle: pick,
      rows: detail
        .map((r) => ({ ...r, name: profiles.get(r.userId)?.name ?? "Student", email: profiles.get(r.userId)?.email ?? null }))
        // finished first, best score first, then the ones who have not taken it
        .sort((a, b) => (b.totalPct ?? -1) - (a.totalPct ?? -1) || a.name.localeCompare(b.name)),
    };
  }

  const branchOptions = [...new Set(students.map((s) => s.branch?.trim()).filter((b): b is string => Boolean(b)))].sort().map((b) => ({ value: b, label: b }));
  return { cycles, selected, suggested: suggestNextWindow(rows[0]?.opens_on ?? null, today), branchOptions };
}

export async function createCycle(service: Service, institutionId: string, createdBy: string, input: CreateCycleInput): Promise<{ id: string }> {
  const { data, error } = await untyped(service)
    .from("crt_cycles")
    .insert({ college_id: institutionId, title: input.title, opens_on: input.opensOn, closes_on: input.closesOn, branches: input.branches?.length ? input.branches : null, years: input.years?.length ? input.years : null, duration_minutes: input.durationMinutes, created_by: createdBy })
    .select("id")
    .single();
  if (error) throw error;
  const id = (data as { id: string }).id;
  if (input.opensOn <= todayIst()) await announceOpen(service, institutionId, id);
  return { id };
}

/** Tells every student the cycle applies to that it is open. Safe to repeat: each student is told once per cycle. */
export async function announceOpen(service: Service, institutionId: string, cycleId: string): Promise<number> {
  const { data } = await untyped(service).from("crt_cycles").select("*").eq("id", cycleId).maybeSingle();
  const c = data as CycleRow | null;
  if (!c) return 0;
  const students = (await collegeStudents(service, institutionId)).filter((s) => appliesTo({ branches: c.branches, years: c.years }, s.branch, s.year));
  return notify(service, {
    userIds: students.map((s) => s.userId),
    type: "crt_open",
    title: `${c.title} is open`,
    body: `Finish your CRT assessment by ${c.closes_on}. It takes about ${c.duration_minutes} minutes.`,
    href: "/skillstudio/crt",
    institutionId,
    dedupeKey: `crt-open:${c.id}`,
  });
}

/**
 * After a cycle closes: scores any attempt whose clock ran out, then tells the placement cell the results are in. Returns false when
 * an attempt still has time on its clock, so the next run finishes the job instead of reporting early.
 */
export async function closeOutCycle(service: Service, cycleId: string): Promise<boolean> {
  const db = untyped(service);
  const { data } = await db.from("crt_cycles").select("*").eq("id", cycleId).maybeSingle();
  const c = data as CycleRow | null;
  if (!c || c.report_sent_at) return true;

  const { data: open } = await db.from("crt_attempts").select("*").eq("cycle_id", cycleId).is("submitted_at", null);
  const now = new Date();
  const pending = (open ?? []) as AttemptRow[];
  if (pending.some((a) => !attemptExpired(a.deadline_at, now))) return false;
  for (const a of pending) await finalizeAttempt(service, a as Parameters<typeof finalizeAttempt>[1]);

  const overview = await loadCrtOverview(service, c.college_id, cycleId);
  const s = overview.cycles.find((x) => x.id === cycleId)?.summary;
  const weakest = s?.weakest ? ` Weakest area: ${MODULE_LABEL[s.weakest].toLowerCase()}.` : "";
  const staff = await staffWithPermission(service, c.college_id, "outcomes");
  await notify(service, {
    userIds: staff,
    type: "crt_report",
    title: `CRT results are in: ${c.title}`,
    body: s ? `${s.submitted} of ${s.eligible} students completed (${s.participationPct}%)${s.avgPct !== null ? `, average ${s.avgPct}%` : ""}.${weakest}` : "The cycle has closed.",
    href: `/org/outcomes?tab=crt&cycle=${cycleId}`,
    institutionId: c.college_id,
    dedupeKey: `crt-report:${cycleId}`,
  });
  await db.from("crt_cycles").update({ report_sent_at: new Date().toISOString() }).eq("id", cycleId).is("report_sent_at", null);
  return true;
}
