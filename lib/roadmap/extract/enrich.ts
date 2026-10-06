/** Pure. Turns AI output into data that is safe to store: every item must be found in the source text, and skills must resolve to the canonical taxonomy. */
import { resolveSkill, type SkillIndex } from "@/lib/skills/resolve";
import { isGrounded, wordOverlap } from "./ground";
import type { ParsedSection } from "./section";
import type { SectionStructure } from "../suggest";

const AI_NOTE = "Read by the AI structurer; each item was matched word-for-word against the source text.";

/** Fills ONLY the fields the deterministic parser left empty, keeping only AI items that are grounded in the section text. */
export function applyFallback(parsed: ParsedSection, ai: SectionStructure, sectionText: string): { parsed: ParsedSection; dropped: number } {
  let dropped = 0;
  const grounded = (items: string[]) => items.filter((s) => (isGrounded(s, sectionText) ? true : (dropped++, false)));
  const next: ParsedSection = { ...parsed, provenance: { ...parsed.provenance } };
  const mark = (field: string) => (next.provenance[field] = AI_NOTE);

  if (next.objectives.length === 0) {
    next.objectives = grounded(ai.objectives);
    if (next.objectives.length) mark("objectives");
  }
  if (next.outcomes.length === 0) {
    const kept = ai.outcomes.filter((o) => (isGrounded(o.text, sectionText) ? true : (dropped++, false)));
    next.outcomes = kept.map((o, i) => ({ code: /^CO\d+$/i.test(o.code) ? o.code.toUpperCase() : `CO${i + 1}`, text: o.text, bloom: null }));
    if (next.outcomes.length) mark("outcomes");
  }
  if (next.units.length === 0) {
    const units = ai.units
      .filter((u) => (isGrounded(u.title, sectionText) ? true : (dropped++, false)))
      .map((u, i) => ({ unitNo: i + 1, title: u.title, hours: null, topics: grounded(u.topics) }));
    next.units = units;
    if (units.length) mark("units");
  }
  if (next.experiments.length === 0) {
    next.experiments = grounded(ai.experiments);
    if (next.experiments.length) mark("experiments");
  }
  if (next.textbooks.length === 0) {
    next.textbooks = grounded(ai.textbooks);
    if (next.textbooks.length) mark("textbooks");
  }
  if (next.referenceBooks.length === 0) {
    next.referenceBooks = grounded(ai.referenceBooks);
    if (next.referenceBooks.length) mark("references");
  }
  next.complete = next.outcomes.length > 0 || next.units.length > 0 || next.experiments.length > 0;
  return { parsed: next, dropped };
}

export interface RawSkillCandidate {
  name: string;
  evidence: string;
  outcomes: string[];
  confidence: "high" | "medium" | "low";
}
export interface SkillMappingCandidate {
  skillId: string;
  confidence: number;
  evidence: string;
  outcomeCodes: string[];
}

/** Fixed, documented mapping from the model's three-level label to the stored 0–1 confidence. */
export const CONFIDENCE_VALUE = { high: 0.9, medium: 0.7, low: 0.4 } as const;
/** A candidate's evidence must share at least this much wording with the course text, or it is discarded as unjustified. */
export const MIN_EVIDENCE_OVERLAP = 0.5;

export function resolveCandidates(
  candidates: RawSkillCandidate[],
  index: SkillIndex,
  ctx: { sectionText: string; outcomeCodes: Set<string> }
): { mappings: SkillMappingCandidate[]; unresolved: { name: string; evidence: string }[]; dropped: number } {
  const bySkill = new Map<string, SkillMappingCandidate>();
  const unresolved: { name: string; evidence: string }[] = [];
  let dropped = 0;
  for (const c of candidates) {
    if (wordOverlap(c.evidence, ctx.sectionText, 3) < MIN_EVIDENCE_OVERLAP) {
      dropped++;
      continue;
    }
    const hit = resolveSkill(c.name, index);
    if (!hit) {
      unresolved.push({ name: c.name, evidence: c.evidence });
      continue;
    }
    const confidence = CONFIDENCE_VALUE[c.confidence];
    const codes = c.outcomes.filter((o) => ctx.outcomeCodes.has(o));
    const prev = bySkill.get(hit.skillId);
    if (!prev) bySkill.set(hit.skillId, { skillId: hit.skillId, confidence, evidence: c.evidence, outcomeCodes: [...new Set(codes)] });
    else {
      prev.outcomeCodes = [...new Set([...prev.outcomeCodes, ...codes])];
      if (confidence > prev.confidence) {
        prev.confidence = confidence;
        prev.evidence = c.evidence;
      }
    }
  }
  return { mappings: [...bySkill.values()], unresolved, dropped };
}
