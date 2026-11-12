import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { buildTimedSet, gradeParts, type AnswerResult, type Graded, type TimedSet } from "./studio-server";
import { NEGATIVE_MARK } from "./marking";
import { MAX_ROUND_QUESTIONS, canPublish, paperOf, sectionsFrom, type CompanyHeader, type CompanyInput, type CompanyRound, type RoundKind, type Section } from "./companies";
import type { Outcome } from "./server";

type Service = SupabaseClient<Database>;
const fail = (status: number, error: string): { ok: false; status: number; error: string } => ({ ok: false, status, error });

export interface RoundView {
  id: string;
  position: number;
  kind: RoundKind;
  title: string;
  minutes: number | null;
  negativeMarking: number;
  sections: Section[];
  questions: number;
  notes: string | null;
  /** an online assessment with sections can be taken here as a timed mock */
  mockable: boolean;
  status: "todo" | "completed";
  bestPct: number | null;
  attempts: number;
}
export interface CompanyView extends CompanyHeader {
  id: string;
  rounds: RoundView[];
  status: "DRAFT" | "PUBLISHED";
}

interface CompanyRow { id: string; slug: string; name: string; sector: CompanyHeader["sector"]; about: string | null; process: string[]; official_url: string | null; pattern_source_url: string | null; pattern_checked_on: string | null; status: "DRAFT" | "PUBLISHED" }
interface RoundRow { id: string; company_id: string; position: number; kind: RoundKind; title: string; minutes: number | null; negative_marking: number | string; sections: unknown; notes: string | null }
const COMPANY_COLUMNS = "id, slug, name, sector, about, process, official_url, pattern_source_url, pattern_checked_on, status";
const ROUND_COLUMNS = "id, company_id, position, kind, title, minutes, negative_marking, sections, notes";

const header = (c: CompanyRow): CompanyHeader => ({ slug: c.slug, name: c.name, sector: c.sector, about: c.about, process: c.process ?? [], officialUrl: c.official_url, patternSourceUrl: c.pattern_source_url, patternCheckedOn: c.pattern_checked_on });
const roundOf = (r: RoundRow): CompanyRound => ({ position: r.position, kind: r.kind, title: r.title, minutes: r.minutes, negativeMarking: Number(r.negative_marking), sections: sectionsFrom(r.sections), notes: r.notes });

function toView(c: CompanyRow, rounds: RoundRow[], attempts: Map<string, number[]>): CompanyView {
  return {
    ...header(c), id: c.id, status: c.status,
    rounds: rounds.filter((r) => r.company_id === c.id).sort((a, b) => a.position - b.position).map((r) => {
      const round = roundOf(r);
      const tries = attempts.get(r.id) ?? [];
      return { id: r.id, ...round, questions: round.sections.reduce((n, s) => n + s.count, 0), mockable: paperOf(c.name, round) !== null, status: tries.length ? "completed" : "todo", bestPct: tries.length ? Math.max(...tries) : null, attempts: tries.length };
    }),
  };
}

async function loadCompanies(service: Service, userId: string | null, onlyPublished: boolean): Promise<CompanyView[]> {
  const db = untyped(service);
  let q = db.from("crt_companies").select(COMPANY_COLUMNS).order("name");
  if (onlyPublished) q = q.eq("status", "PUBLISHED");
  const { data: companies, error } = await q;
  if (error) throw error;
  const list = (companies ?? []) as CompanyRow[];
  if (list.length === 0) return [];
  const { data: rounds, error: re } = await db.from("crt_company_rounds").select(ROUND_COLUMNS).in("company_id", list.map((c) => c.id));
  if (re) throw re;
  const attempts = new Map<string, number[]>();
  if (userId) {
    const { data } = await db.from("crt_company_attempts").select("round_id, pct").eq("user_id", userId);
    for (const a of (data ?? []) as { round_id: string; pct: number }[]) attempts.set(a.round_id, [...(attempts.get(a.round_id) ?? []), a.pct]);
  }
  return list.map((c) => toView(c, (rounds ?? []) as RoundRow[], attempts));
}

/** The published companies with their rounds and what this student has done in each. */
export const listCompanies = (service: Service, userId: string): Promise<CompanyView[]> => loadCompanies(service, userId, true);
/** Every company, drafts too: for the admin screen. */
export const listAllCompanies = (service: Service): Promise<CompanyView[]> => loadCompanies(service, null, false);

async function loadRound(service: Service, roundId: string): Promise<{ company: CompanyRow; round: CompanyRound } | null> {
  const db = untyped(service);
  const { data: r } = await db.from("crt_company_rounds").select(ROUND_COLUMNS).eq("id", roundId).maybeSingle();
  if (!r) return null;
  const { data: c } = await db.from("crt_companies").select(COMPANY_COLUMNS).eq("id", (r as RoundRow).company_id).eq("status", "PUBLISHED").maybeSingle();
  return c ? { company: c as CompanyRow, round: roundOf(r as RoundRow) } : null;
}

/** A timed mock in a published company's pattern: its sections, its time and its negative marking, from Capabilio's own questions. */
export async function companyMock(service: Service, userId: string, roundId: string): Promise<Outcome<{ set: TimedSet }>> {
  const found = await loadRound(service, roundId);
  const paper = found ? paperOf(found.company.name, found.round) : null;
  if (!found || !paper) return fail(404, "That test isn't available.");
  const built = await buildTimedSet(service, userId, paper.title, paper.parts, { secondsPerQuestion: paper.secondsPerQuestion, negativeMarking: paper.negativeMarking || NEGATIVE_MARK });
  return built;
}

/** Grades a company mock. Negative marking is applied on the server (see gradeParts), and the result is remembered so the hub can show Completed and the best score. */
export async function companyGrade(service: Service, userId: string, input: { roundId: string; answers: Record<string, string> }): Promise<Outcome<Graded>> {
  const found = await loadRound(service, input.roundId);
  const paper = found ? paperOf(found.company.name, found.round) : null;
  if (!found || !paper) return fail(404, "That test isn't available.");
  // a company that states its own penalty keeps it; otherwise the platform's standard applies
  const graded = await gradeParts(service, userId, paper.parts.map((p) => p.category), input.answers, MAX_ROUND_QUESTIONS, paper.negativeMarking || NEGATIVE_MARK);
  if (!graded.ok) return graded;
  const { error } = await untyped(service).from("crt_company_attempts").insert({ user_id: userId, round_id: input.roundId, pct: graded.pct });
  if (error) throw error;
  return graded;
}

// ---------------------------------------------------------------- admin

/** Saves a company and replaces its rounds. A published company stays published only while it still meets the publishing rules. */
export async function saveCompany(service: Service, userId: string, input: CompanyInput): Promise<Outcome<{ slug: string; status: "DRAFT" | "PUBLISHED" }>> {
  const db = untyped(service);
  const { data: existing } = await db.from("crt_companies").select("id, status").eq("slug", input.slug).maybeSingle();
  const { rounds, ...head } = input;
  const roundList: CompanyRound[] = rounds.map((r) => ({ ...r, notes: r.notes ?? null }));
  const stays = (existing as { status?: string } | null)?.status === "PUBLISHED" && canPublish(head, roundList).ok;
  const row = { slug: head.slug, name: head.name, sector: head.sector, about: head.about, process: head.process, official_url: head.officialUrl, pattern_source_url: head.patternSourceUrl, pattern_checked_on: head.patternCheckedOn, status: stays ? "PUBLISHED" : "DRAFT", created_by: userId };
  const saved = (existing
    ? await db.from("crt_companies").update(row).eq("id", (existing as { id: string }).id).select("id").single()
    : await db.from("crt_companies").insert(row).select("id").single()) as { data: { id: string } | null; error: { message: string; code?: string } | null };
  if (saved.error || !saved.data) return fail(saved.error?.code === "23505" ? 409 : 500, saved.error?.code === "23505" ? "A company with that name or slug already exists." : "Could not save the company.");
  const companyId = saved.data.id;
  const cleared = await db.from("crt_company_rounds").delete().eq("company_id", companyId);
  if (cleared.error) throw cleared.error;
  if (rounds.length > 0) {
    const inserted = await db.from("crt_company_rounds").insert(rounds.map((r) => ({ company_id: companyId, position: r.position, kind: r.kind, title: r.title, minutes: r.minutes, negative_marking: r.negativeMarking, sections: r.sections, notes: r.notes })));
    if (inserted.error) throw inserted.error;
  }
  return { ok: true, slug: head.slug, status: stays ? "PUBLISHED" : "DRAFT" };
}

/** Publishes or unpublishes a company. Publishing needs the pattern's source and check date and a paper to take. */
export async function setCompanyStatus(service: Service, slug: string, status: "DRAFT" | "PUBLISHED"): Promise<Outcome<{ slug: string; status: "DRAFT" | "PUBLISHED" }>> {
  const db = untyped(service);
  const { data: c } = await db.from("crt_companies").select(COMPANY_COLUMNS).eq("slug", slug).maybeSingle();
  if (!c) return fail(404, "Company not found.");
  if (status === "PUBLISHED") {
    const { data: rounds } = await db.from("crt_company_rounds").select(ROUND_COLUMNS).eq("company_id", (c as CompanyRow).id);
    const verdict = canPublish(header(c as CompanyRow), ((rounds ?? []) as RoundRow[]).map(roundOf));
    if (!verdict.ok) return fail(400, verdict.reason);
  }
  const { error } = await db.from("crt_companies").update({ status }).eq("slug", slug);
  if (error) throw error;
  return { ok: true, slug, status };
}
