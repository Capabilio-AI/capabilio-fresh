import { z } from "zod";
import { completeJsonDetailed } from "@/lib/ai/groq";
import type { AnyLab, Difficulty } from "./types";

// The AI writes only the story. Every number, limit and answer comes from the lab, so a story can never change what a mission asks.
const StorySchema = z.object({ title: z.string().min(8).max(70), story: z.string().min(80).max(700) });
export interface StoryDeps { llm(prompt: string, system: string): Promise<z.infer<typeof StorySchema>> }
export const realStoryDeps: StoryDeps = { llm: async (p, s) => (await completeJsonDetailed(p, s, StorySchema, { task: "arena_task", maxTokens: 1200 })).value };

const SYSTEM = `You write the opening of a hands-on engineering mission for a college student on a learning platform. It is a short story that gives the problem a human reason.
Rules:
- 2 to 4 sentences, plain words, an Indian setting (vary the city, town or industry; do not default to one place).
- Say who needs the problem solved and why it matters. Do NOT say how to solve it, do NOT name the answer or the formulas.
- You may mention only numbers that appear in the facts below. Never invent a number, a limit or a unit.
- The title is a short mission name, not a sentence of instructions.
JSON only: {"title": "...", "story": "..."}.`;

const numbersIn = (text: string): Set<string> => new Set((text.match(/\d+(?:\.\d+)?/g) ?? []).map((n) => String(Number(n))));

/** Pure. A story is safe when every number in it is one the lab itself stated. */
export function storyIsSafe(story: { title: string; story: string }, allowedText: string, avoidTitles: readonly string[]): boolean {
  const allowed = numbersIn(allowedText);
  const used = [...numbersIn(`${story.title} ${story.story}`)];
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return used.every((n) => allowed.has(n)) && !avoidTitles.some((t) => norm(t) === norm(story.title)) && !/\b(answer|solution|formula)\b/i.test(story.story);
}

export async function writeStory(lab: AnyLab, scenario: unknown, difficulty: Difficulty, avoidTitles: readonly string[], deps: StoryDeps = realStoryDeps): Promise<{ title: string; story: string; ai: boolean }> {
  const facts = [...lab.given(scenario).map((g) => `${g.label}: ${g.value}`), `Mission: ${lab.mission(scenario)}`].join("\n");
  try {
    const out = await deps.llm(`Bench: ${lab.name} (${lab.topic}). Difficulty: ${difficulty}.\nFacts:\n${facts}${avoidTitles.length ? `\nDo not reuse these titles:\n- ${avoidTitles.slice(0, 20).join("\n- ")}` : ""}`, SYSTEM);
    if (storyIsSafe(out, facts, avoidTitles)) return { ...out, ai: true };
  } catch {
    // an outage or a bad reply falls through to the lab's own story: a mission never waits on the AI
  }
  return { ...lab.fallback(scenario), ai: false };
}
