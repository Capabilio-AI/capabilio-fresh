/** The four CRT modules, in the order a student meets them. */
export const CRT_MODULES = ["aptitude", "reasoning", "verbal", "soft_skills"] as const;
export type CrtModule = (typeof CRT_MODULES)[number];

export const MODULE_LABEL: Record<CrtModule, string> = {
  aptitude: "Quantitative aptitude",
  reasoning: "Logical reasoning",
  verbal: "Communication",
  soft_skills: "Soft skills",
};

/** Questions drawn per module for one assessment. */
export const QUESTIONS_PER_MODULE = 12;

export type Band = "needs_work" | "developing" | "proficient" | "strong";
export const BAND_LABEL: Record<Band, string> = { needs_work: "Needs work", developing: "Developing", proficient: "Proficient", strong: "Strong" };

export interface CrtOption {
  key: string;
  text: string;
  /** server-side only: 1/0 for a right/wrong question, 0-3 for a situational judgement question */
  points: number;
}

export interface CrtQuestion {
  id: string;
  module: CrtModule;
  options: CrtOption[];
}

export interface ModuleScore {
  points: number;
  max: number;
}
export type ModuleScores = Record<CrtModule, ModuleScore>;
