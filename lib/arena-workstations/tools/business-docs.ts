import type { Json } from "@/lib/supabase/types";
import { hashSeed, makeRng } from "@/lib/workplace/rng";
import { gradeBusinessDocs } from "@/lib/workplace/business-docs/engine";
import { pickDocsTemplate } from "@/lib/workplace/business-docs/templates";
import { BusinessDocsSubmissionSchema, type BusinessDocsContent, type BusinessDocsKey, type BusinessDocsSubmission } from "@/lib/workplace/business-docs/types";
import { GenerationRejected, TIME_LIMIT_MINUTES, type GenerationContext, type GeneratedChallenge, type ToolDefinition } from "../types";

/**
 * Business Docs Studio (tier A): the student fills a structured document in the browser (user stories, acceptance criteria, issues,
 * test traceability, a process map, a RACI, a gap table). The server checks it against structural and traceability rules and a hidden
 * key; nothing the student writes is executed, and prose quality is never graded. Tickets are fixed templates, no AI.
 */
async function generate(ctx: GenerationContext): Promise<GeneratedChallenge> {
  const t = pickDocsTemplate({ areaKey: ctx.areaKey ?? "requirements", difficulty: ctx.difficulty, level: ctx.level ?? "fresher", rng: makeRng(ctx.ticketSeed ?? hashSeed("business-docs")), avoidTitles: ctx.avoidTitles });
  if (!t) throw new GenerationRejected(`no business document ticket exists for area ${ctx.areaKey ?? "requirements"}`);
  return {
    title: t.title,
    category: ctx.areaName,
    requester: `${t.requester.name} · ${t.requester.title}`,
    scenario: t.scenario,
    objective: t.content.deliverable,
    skill_tags: t.skillTags,
    time_limit_minutes: TIME_LIMIT_MINUTES[ctx.difficulty] + 10,
    content: { ...t.content, maxSubmissions: BUSINESS_DOCS_MAX_SUBMISSIONS } as unknown as Json,
    answer_key: t.key as unknown as Json,
    origin: { provider: "template", model: `business_docs.${t.id}.v1` },
  };
}

/** Enough tries to fix a slip in a document, too few to probe the planted issues one pair at a time. */
const BUSINESS_DOCS_MAX_SUBMISSIONS = 5;

export const businessDocsTool: ToolDefinition<BusinessDocsSubmission> = {
  toolType: "business_docs_workspace",
  generationVersion: "business_docs.gen.v1",
  gradingVersion: "business_docs.grade.v1",
  generate,
  submissionSchema: BusinessDocsSubmissionSchema as unknown as ToolDefinition<BusinessDocsSubmission>["submissionSchema"],
  async grade(content, answerKey, submission) {
    return gradeBusinessDocs(content as unknown as BusinessDocsContent, answerKey as unknown as BusinessDocsKey, submission);
  },
};
