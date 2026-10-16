import type { ExperienceLevel } from "../level";
import type { Difficulty } from "@/lib/arena-workstations/types";

export interface ConfigFile {
  name: string;
  content: string;
}
export interface CheckResult {
  label: string;
  passed: boolean;
}
export type FileLanguage = "yaml" | "json" | "dockerfile" | "text" | "html" | "css" | "javascript";

/** What the user sees: the starting files and the requirements (the checks' labels). Never the solution. */
export interface FileContent {
  files: (ConfigFile & { language: FileLanguage })[];
  requirements: string[];
  deliverable: string;
  maxSubmissions: number;
}
export interface FileDraft<K> {
  title: string;
  requester: { name: string; title: string };
  scenario: string;
  skillTags: string[];
  content: FileContent;
  key: { checks: K[] };
}
export interface FileTemplate<K> {
  id: string;
  areas: string[];
  difficulty: Difficulty;
  minLevel: ExperienceLevel;
  draft: FileDraft<K>;
  /** a correct answer, for tests only: it must pass every check */
  solution: ConfigFile[];
}
export const MAX_SUBMISSIONS = 8;
