import type { CrtModule } from "./model";

/** The eight learning paths of the Career Studio. A path groups lessons and practice questions; the assessment still scores the four modules. */
export const CATEGORIES = ["aptitude", "reasoning", "verbal", "speaking", "soft_skills", "group_discussion", "interview", "workplace"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  aptitude: "Quantitative aptitude",
  reasoning: "Logical reasoning",
  verbal: "Communication & verbal ability",
  speaking: "English speaking",
  soft_skills: "Soft skills",
  group_discussion: "Group discussion",
  interview: "Interview preparation",
  workplace: "Workplace communication",
};

interface PoolPart {
  module: CrtModule;
  /** null = every topic of the module */
  topics: readonly string[] | null;
}

/** Which assessment questions feed each path's practice. English speaking has its own practice (the speaking studio). */
export const CATEGORY_POOL: Record<Category, readonly PoolPart[]> = {
  aptitude: [{ module: "aptitude", topics: null }],
  reasoning: [{ module: "reasoning", topics: null }],
  verbal: [{ module: "verbal", topics: ["Grammar", "Vocabulary"] }],
  speaking: [],
  soft_skills: [{ module: "soft_skills", topics: ["Time Management", "Ownership", "Feedback", "Adaptability", "Ethics", "Stress"] }],
  group_discussion: [{ module: "soft_skills", topics: ["Teamwork", "Conflict", "Leadership"] }],
  interview: [{ module: "verbal", topics: ["Spoken Communication"] }, { module: "soft_skills", topics: ["Professional Conduct", "Networking"] }],
  workplace: [{ module: "verbal", topics: ["Workplace Writing"] }, { module: "soft_skills", topics: ["Communication", "Customer Focus"] }],
};

/** Pure. The path a question belongs to, or null if no path takes it. */
export function categoryOf(module: CrtModule, topic: string): Category | null {
  return CATEGORIES.find((c) => CATEGORY_POOL[c].some((p) => p.module === module && (p.topics === null || p.topics.includes(topic)))) ?? null;
}

export const inCategory = (category: Category, module: CrtModule, topic: string): boolean =>
  CATEGORY_POOL[category].some((p) => p.module === module && (p.topics === null || p.topics.includes(topic)));

interface SimPart {
  category: Category;
  count: number;
}
interface SimTestDef {
  key: string;
  label: string;
  blurb: string;
  parts: readonly SimPart[];
}

/**
 * The placement simulator: a full mock with sections, like a company's online test, and one test per section. Every test gives one
 * minute per question (SECONDS_PER_QUESTION in cycle.ts), so a test lasts as many minutes as it has questions. English speaking is
 * practised by voice in the Speaking Studio, not as a multiple-choice test.
 */
export const SIM_TESTS = [
  { key: "mock", label: "Full placement mock", blurb: "Seven sections in one sitting, the way a company's online round runs.", parts: [{ category: "aptitude", count: 10 }, { category: "reasoning", count: 10 }, { category: "verbal", count: 8 }, { category: "workplace", count: 4 }, { category: "soft_skills", count: 6 }, { category: "group_discussion", count: 3 }, { category: "interview", count: 3 }] },
  { key: "aptitude", label: "Quantitative aptitude", blurb: "Percentages, ratios, time and work, interest.", parts: [{ category: "aptitude", count: 10 }] },
  { key: "reasoning", label: "Logical reasoning", blurb: "Series, coding, directions, syllogisms.", parts: [{ category: "reasoning", count: 10 }] },
  { key: "verbal", label: "Verbal ability", blurb: "Grammar, vocabulary and sentence sense.", parts: [{ category: "verbal", count: 10 }] },
  { key: "soft_skills", label: "Soft skills", blurb: "Judgement calls on time, ownership and feedback.", parts: [{ category: "soft_skills", count: 8 }] },
  { key: "group_discussion", label: "Group discussion", blurb: "Teamwork, disagreement and leading a discussion.", parts: [{ category: "group_discussion", count: 8 }] },
  { key: "interview", label: "Interview readiness", blurb: "How to answer, present and conduct yourself.", parts: [{ category: "interview", count: 10 }] },
  { key: "workplace", label: "Workplace communication", blurb: "Emails, chats and meetings.", parts: [{ category: "workplace", count: 10 }] },
] as const satisfies readonly SimTestDef[];
export type SimTestKey = (typeof SIM_TESTS)[number]["key"];
export const SIM_TEST_KEYS = SIM_TESTS.map((t) => t.key) as [SimTestKey, ...SimTestKey[]];

export const testQuestionCount = (t: { parts: readonly SimPart[] }): number => t.parts.reduce((n, p) => n + p.count, 0);
