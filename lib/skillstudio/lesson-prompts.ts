import type { NodeExplanation } from "@/lib/roadmap-visual/explain-node";
import type { LessonKind } from "./lesson-content";

// The same lesson for every learner of a topic, so it can be shared and cached: the prompt carries the topic's facts only,
// never the student's score, name or college.
export const LESSON_SYSTEM = [
  "You are Capabilio's lesson writer for one topic of a career roadmap, teaching a fresher or early-career learner.",
  "Be accurate and concrete. Prefer a small worked example to a general statement. Define a term the first time you use it.",
  "Never invent statistics, quotations, company claims, version numbers or links. If you are not sure of a detail, leave it out.",
  "Plain text only: no markdown, no links, no emoji. Code goes only in the fields meant for code.",
  "Stay strictly on the topic. You do not grade or certify anyone, and nothing you write changes anyone's scores.",
  "Respond with JSON only.",
].join(" ");

const CHECK_SHAPE = '{"question","options":[exactly 4 strings],"answerIndex":0-3,"why"}';

const TASK: Record<LessonKind, (topic: string) => string> = {
  theory: (topic) =>
    `Write a written lesson on "${topic}". 2 to 6 sections that build from the basics, each with 1-3 short paragraphs and, where it helps, one small worked example (with code only when the topic is about code). Then 3 to 6 key takeaways, up to 4 common mistakes, and exactly 3 multiple-choice check questions of rising difficulty that test understanding, not memory of wording.\nReturn JSON: {"summary": string, "sections": [{"heading","paragraphs":[string],"example":{"title","code":string|null,"explanation"}|null}], "takeaways": [string], "mistakes": [string], "check": [${CHECK_SHAPE}]}.`,
  video: (topic) =>
    `Write the script of a 2 to 4 minute narrated explainer video on "${topic}" for a learner who prefers watching to reading. 6 to 9 scenes in this order of kinds: one "title", then "concept" / "steps" / "example" scenes that build the idea with one running example, ending with one "recap". Each scene has a short on-screen heading, up to 4 short on-screen lines (under 12 words each), and the narrator's line in "say": 25 to 60 words in a warm, plain, spoken voice that explains rather than reads the screen. Use "code" (under 8 short lines) only in an "example" scene about code, else null. Then exactly 2 multiple-choice check questions.\nReturn JSON: {"title": string, "scenes": [{"kind","heading","points":[string],"code":string|null,"say"}], "check": [${CHECK_SHAPE}]}.`,
};

/** Pure. The grounded prompt for a topic's written lesson or explainer script. */
export function buildLessonPrompt(e: Pick<NodeExplanation, "title" | "description" | "importance" | "stage">, kind: LessonKind, careerName: string): string {
  return [
    `Career: ${careerName}`,
    `Topic: ${e.title}. ${e.description}`,
    `Why it is here: a ${e.importance.toLowerCase()} topic for this career at the ${e.stage.toLowerCase().replace("_", "-")} stage.`,
    `Task: ${TASK[kind](e.title)}`,
  ].join("\n\n");
}
