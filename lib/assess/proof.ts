// Proof of work: projects, certificates, GitHub/portfolio links, Arena results. The student adds it; it is shown at once but only
// VERIFIED proof becomes skill evidence (unverified proof carries no weight; see PROOF_COUNTS_UNVERIFIED). Evidence then flows through
// the same graph sync as Arena, so the profile keeps updating from real work without a second scoring path.

import { createHash } from "node:crypto";
import { z } from "zod";
import { track, type Db } from "./db";
import { syncSkillGraph } from "./graph-sync";
import { AssessError } from "./types";

/** Config: should unverified proof count toward skill scores? Off: only a reviewer's verification creates evidence. */
export const PROOF_COUNTS_UNVERIFIED = false;

export const PROOF_TYPES = ["PROJECT", "CERTIFICATION", "GITHUB", "PORTFOLIO", "ARENA", "OTHER"] as const;
export const ProofInput = z
  .object({
    type: z.enum(PROOF_TYPES),
    title: z.string().trim().min(2).max(160),
    url: z.string().trim().url().max(500).refine((u) => /^https?:\/\//i.test(u), "Use an http(s) link").optional(),
    skillIds: z.array(z.string().uuid()).max(8).default([]),
  })
  .strict();
export type ProofInputT = z.infer<typeof ProofInput>;

export interface ProofRow {
  id: string;
  type: (typeof PROOF_TYPES)[number];
  title: string;
  url: string | null;
  skill_ids: string[];
  verification_status: "UNVERIFIED" | "VERIFIED" | "REJECTED";
  created_at: string;
}

/** Deterministic id per (proof, skill): evidence rows are unique per source id, and one proof can support several skills. */
export function evidenceIdFor(proofId: string, skillId: string): string {
  const h = createHash("sha1").update(`proof:${proofId}:${skillId}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function primaryCareer(db: Db, userId: string): Promise<string | null> {
  return (await db.from("student_career_intent").select("primary_career_id").eq("student_id", userId).maybeSingle()).data?.primary_career_id ?? null;
}

/** Writes the evidence rows for a proof's skills and republishes the graph. Idempotent per (proof, skill). */
async function applyEvidence(db: Db, proof: ProofRow, userId: string): Promise<void> {
  if (proof.skill_ids.length === 0) return;
  const { data: skills } = await db.from("skills").select("id, name").in("id", proof.skill_ids);
  const careerId = await primaryCareer(db, userId);
  await db.from("student_skill_evidence").upsert(
    (skills ?? []).map((s: { id: string; name: string }) => ({
      student_id: userId, career_id: careerId, skill_id: s.id, skill_label: s.name, source: "PROOF_OF_WORK",
      source_id: evidenceIdFor(proof.id, s.id), correct: true, difficulty: "MEDIUM",
    })),
    { onConflict: "source,source_id", ignoreDuplicates: true }
  );
  if (careerId) await syncSkillGraph(db, userId, careerId, "PROOF_OF_WORK");
}

export async function addProofOfWork(db: Db, userId: string, raw: unknown): Promise<ProofRow> {
  const input = ProofInput.parse(raw);
  if (input.type !== "OTHER" && input.type !== "CERTIFICATION" && !input.url) throw new AssessError("URL_REQUIRED", "Add a link so this can be checked.", 400);
  if (input.skillIds.length > 0) {
    const { count } = await db.from("skills").select("id", { count: "exact", head: true }).in("id", input.skillIds).eq("status", "active");
    if ((count ?? 0) !== new Set(input.skillIds).size) throw new AssessError("UNKNOWN_SKILL", "One of the linked skills doesn't exist.", 400);
  }
  const { data, error } = await db
    .from("proof_of_work")
    .insert({ student_id: userId, type: input.type, title: input.title, url: input.url ?? null, skill_ids: [...new Set(input.skillIds)] })
    .select("id, type, title, url, skill_ids, verification_status, created_at")
    .single();
  if (error) throw error;
  void track(db, userId, "proof_of_work_added", { type: input.type, skills: input.skillIds.length });
  if (PROOF_COUNTS_UNVERIFIED) await applyEvidence(db, data as ProofRow, userId);
  return data as ProofRow;
}

export async function listProofOfWork(db: Db, userId: string): Promise<ProofRow[]> {
  const { data } = await db.from("proof_of_work").select("id, type, title, url, skill_ids, verification_status, created_at").eq("student_id", userId).order("created_at", { ascending: false }).limit(100);
  return (data ?? []) as ProofRow[];
}

/** A reviewer's decision. Only VERIFIED proof creates evidence, and then the student's graph, snapshot and profile update. */
export async function reviewProofOfWork(db: Db, proofId: string, reviewerId: string, decision: "VERIFIED" | "REJECTED"): Promise<ProofRow> {
  const { data, error } = await db
    .from("proof_of_work")
    .update({ verification_status: decision, verified_at: new Date().toISOString(), verified_by: reviewerId })
    .eq("id", proofId)
    .select("id, student_id, type, title, url, skill_ids, verification_status, created_at")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AssessError("NOT_FOUND", "Proof of work not found.", 404);
  if (decision === "VERIFIED") await applyEvidence(db, data as ProofRow, data.student_id);
  return data as ProofRow;
}
