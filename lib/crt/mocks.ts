import { CRT_MODULES, type CrtModule } from "./model";

/**
 * The full-length mock assessments a placement cell can schedule. Each draws a fixed number of questions per module, one minute per question,
 * and is scored with negative marking like every timed CRT test.
 */
export const MOCKS = [
  { key: "full", label: "Full placement mock", blurb: "Aptitude, reasoning, communication and soft skills in one sitting, the way a company's online round runs.", counts: { aptitude: 20, reasoning: 15, verbal: 15, soft_skills: 10 } },
  { key: "aptitude_reasoning", label: "Aptitude and reasoning mock", blurb: "The numerical and logical sections that most companies use to shortlist.", counts: { aptitude: 20, reasoning: 20, verbal: 0, soft_skills: 0 } },
  { key: "communication_behaviour", label: "Communication and behaviour mock", blurb: "Verbal ability and situational judgement, as in HR and managerial rounds.", counts: { aptitude: 0, reasoning: 0, verbal: 15, soft_skills: 15 } },
  { key: "quick", label: "Quick mock", blurb: "A shorter sitting across all four areas, for a drill between full mocks.", counts: { aptitude: 8, reasoning: 8, verbal: 8, soft_skills: 6 } },
] as const satisfies readonly { key: string; label: string; blurb: string; counts: Record<CrtModule, number> }[];

export type MockKey = (typeof MOCKS)[number]["key"];
export const MOCK_KEYS = MOCKS.map((m) => m.key) as [MockKey, ...MockKey[]];

export const mockOf = (key: string | null | undefined) => MOCKS.find((m) => m.key === key) ?? null;
export const mockQuestionCount = (m: { counts: Record<CrtModule, number> }): number => CRT_MODULES.reduce((n, mod) => n + m.counts[mod], 0);
