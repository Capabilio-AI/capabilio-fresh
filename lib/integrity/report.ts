import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import { collegeStudents } from "@/lib/crt/org";
import { INTEGRITY_KINDS, type IntegrityCounts } from "./kinds";
import { SIMILAR_AT, rapidSolves, similarity } from "./similarity";

export const REPORT_DAYS = 30;
const CHUNK = 150;
const PEERS_PER_CHALLENGE = 300;
const DAY_MS = 86_400_000;

export interface SimilarMatch {
  challenge: string;
  /** the other student's name when they are in this college; null for a student elsewhere, whose name is not shared */
  with: string | null;
}
export interface StudentIntegrity {
  userId: string;
  name: string;
  rollNumber: string | null;
  branch: string | null;
  year: number | null;
  counts: IntegrityCounts;
  rapid: number;
  similar: SimilarMatch[];
  /** for ordering only: the heavier signals weigh more */
  score: number;
}

const chunks = <T,>(items: readonly T[], size = CHUNK): T[][] => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

type Completion = { user_id: string; challenge_id: string; code_submitted: string | null; completed_at: string };

export function integrityScore(counts: IntegrityCounts, rapid: number, similar: number): number {
  return similar * 8 + rapid * 3 + (counts.paste ?? 0) + (counts.screenshot ?? 0) * 3 + (counts.print ?? 0) * 2 + Math.floor((counts.blur ?? 0) / 10) + (counts.fullscreen_exit ?? 0) * 2 + (counts.tab_switch ?? 0) * 2 + (counts.devtools ?? 0) * 2 + (counts.exam_ended ?? 0) * 5;
}

/** Every signal in the last REPORT_DAYS days for the active students of a college, strongest first. Signals are not proof: the page says so. */
export async function loadIntegrityReport(service: SupabaseClient, institutionId: string): Promise<StudentIntegrity[]> {
  const db = untyped(service as never);
  const students = await collegeStudents(service as never, institutionId);
  if (students.length === 0) return [];
  const since = new Date(Date.now() - REPORT_DAYS * DAY_MS).toISOString();
  const ids = students.map((s) => s.userId);

  const names = new Map<string, string>();
  const counts = new Map<string, IntegrityCounts>();
  const completions: Completion[] = [];
  await Promise.all(
    chunks(ids).map(async (part) => {
      const [profiles, events, done] = await Promise.all([
        db.from("profiles").select("id, full_name").in("id", part),
        db.from("integrity_events").select("user_id, kind, n").in("user_id", part).gte("created_at", since).limit(20000),
        db.from("arena_challenge_completions").select("user_id, challenge_id, code_submitted, completed_at").in("user_id", part).eq("is_correct", true).gte("completed_at", since).limit(5000),
      ]);
      for (const p of (profiles.data ?? []) as { id: string; full_name: string | null }[]) names.set(p.id, p.full_name ?? "Student");
      for (const e of (events.data ?? []) as { user_id: string; kind: (typeof INTEGRITY_KINDS)[number]; n: number }[]) {
        const c = counts.get(e.user_id) ?? {};
        counts.set(e.user_id, { ...c, [e.kind]: (c[e.kind] ?? 0) + e.n });
      }
      completions.push(...((done.data ?? []) as Completion[]));
    })
  );

  const timesByUser = new Map<string, number[]>();
  for (const c of completions) timesByUser.set(c.user_id, [...(timesByUser.get(c.user_id) ?? []), Date.parse(c.completed_at)]);

  // the same challenge solved by anyone in the app, so copying across colleges is caught too
  const withCode = completions.filter((c) => (c.code_submitted ?? "").trim().length > 0);
  const challengeIds = [...new Set(withCode.map((c) => c.challenge_id))];
  const peersByChallenge = new Map<string, Completion[]>();
  const titles = new Map<string, string>();
  await Promise.all(
    chunks(challengeIds, 40).map(async (part) => {
      const [peers, info] = await Promise.all([
        db.from("arena_challenge_completions").select("user_id, challenge_id, code_submitted, completed_at").in("challenge_id", part).eq("is_correct", true).not("code_submitted", "is", null).limit(PEERS_PER_CHALLENGE * part.length),
        db.from("arena_challenges").select("id, title").in("id", part),
      ]);
      for (const p of (peers.data ?? []) as Completion[]) peersByChallenge.set(p.challenge_id, [...(peersByChallenge.get(p.challenge_id) ?? []), p]);
      for (const t of (info.data ?? []) as { id: string; title: string }[]) titles.set(t.id, t.title);
    })
  );

  const similarByUser = new Map<string, SimilarMatch[]>();
  const inCollege = new Set(ids);
  for (const mine of withCode) {
    const hit = (peersByChallenge.get(mine.challenge_id) ?? []).find((p) => p.user_id !== mine.user_id && (p.code_submitted ?? "").trim() && (similarity(mine.code_submitted!, p.code_submitted!) ?? 0) >= SIMILAR_AT);
    if (!hit) continue;
    const match: SimilarMatch = { challenge: titles.get(mine.challenge_id) ?? "A challenge", with: inCollege.has(hit.user_id) ? names.get(hit.user_id) ?? "A student here" : null };
    similarByUser.set(mine.user_id, [...(similarByUser.get(mine.user_id) ?? []), match]);
  }

  return students
    .map((s): StudentIntegrity => {
      const c = counts.get(s.userId) ?? {};
      const rapid = rapidSolves(timesByUser.get(s.userId) ?? []);
      const similar = similarByUser.get(s.userId) ?? [];
      return { userId: s.userId, name: names.get(s.userId) ?? "Student", rollNumber: s.rollNumber, branch: s.branch, year: s.year, counts: c, rapid, similar, score: integrityScore(c, rapid, similar.length) };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
