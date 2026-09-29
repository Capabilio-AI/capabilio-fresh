import { z } from "zod";
import { DIFFICULTY_LABEL, type GenerationContext } from "../types";

/** Fields every generated challenge carries, whatever the tool. */
export const HeaderSchema = z.object({
  company: z.string().min(2).max(60),
  requester_name: z.string().min(2).max(40),
  requester_title: z.string().min(2).max(60),
  title: z.string().min(8).max(90),
  scenario: z.string().min(40).max(700),
  skill_tags: z.array(z.string().min(1).max(30)).min(1).max(5),
});
export type Header = z.infer<typeof HeaderSchema>;

export function systemPreamble(ctx: GenerationContext, toolDescription: string): string {
  return `You design one realistic work task for a fresher ${ctx.roleName} on their team's ${toolDescription}. The task
is the kind of thing a new analyst genuinely receives in their first months at a company: a request from a named
stakeholder, real business context, real-looking data. Difficulty: ${DIFFICULTY_LABEL[ctx.difficulty]} — ${
    ctx.difficulty === "easy" ? "one clear requirement, small data, no tricks" : ctx.difficulty === "medium" ? "two or three combined requirements, moderate data" : "several combined requirements that need care, larger data"
  }.

Rules:
- The company is fictional and Indian (invent a plausible name — never a real brand).
- The stakeholder is a named person with a real job title at that company.
- "scenario" is the stakeholder's message in their own voice (2–4 sentences): why they need this and what decision it feeds.
- Every value in the data must be realistic for the business (prices in ₹, plausible dates in 2026, believable volumes).
- Identifiers (table/column names) are lower_snake_case.
- Output JSON only, exactly the requested shape. No markdown.`;
}

export function avoidLine(ctx: GenerationContext): string {
  return ctx.avoidTitles.length ? `\nDo not reuse or closely rephrase these earlier task titles:\n- ${ctx.avoidTitles.slice(0, 20).join("\n- ")}` : "";
}

/**
 * Attaches the tool's semantic checks to its schema so completeJson feeds any
 * problems back to the model and it self-corrects within the same request,
 * instead of the whole generation being thrown away.
 */
export function withProblems<T extends z.ZodTypeAny>(schema: T, problems: (value: z.infer<T>) => string[]) {
  return schema.superRefine((value, ctx) => {
    for (const message of problems(value).slice(0, 8)) ctx.addIssue({ code: "custom", message });
  });
}

export function requesterLine(h: Header): string {
  return `${h.requester_name} · ${h.requester_title}`;
}
