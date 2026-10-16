import type { Dataset } from "@/lib/arena-workstations/engines/dataset";
import type { Rng } from "../rng";
import type { Requester } from "../tickets/types";
import type { Difficulty } from "@/lib/arena-workstations/types";
import type { ExperienceLevel } from "../level";

/** One thing the user must report at the end of an investigation. */
export type AnswerField =
  | { key: string; label: string; help?: string; type: "choice"; options: string[] }
  | { key: string; label: string; help?: string; type: "text"; placeholder?: string }
  | { key: string; label: string; help?: string; type: "number"; unit?: string };

export type AnswerValue = string | number;

export interface InvestigationDraft {
  templateId: string;
  difficulty: Difficulty;
  minLevel: ExperienceLevel;
  title: string;
  requester: Requester;
  /** the stakeholder's message in their own voice */
  scenario: string;
  skillTags: string[];
  /** "detective": something dropped and the cause is a slice of the business; "incident": a number on a dashboard is wrong because of a data fault */
  mode: "detective" | "incident";
  /** the company's data with the fault already in it */
  tables: Dataset[];
  fields: AnswerField[];
  /** the expected answer for each field key, worked out from the faulty data itself */
  answers: Record<string, AnswerValue>;
  /** how far a number may be from the answer and still count (in the number's own unit) */
  tolerance: Record<string, number>;
}

/** A template may decline (return null) when the user's data cannot carry its fault cleanly; the picker then tries another. */
export interface InvestigationTemplate {
  id: string;
  difficulty: Difficulty;
  minLevel: ExperienceLevel;
  /** "investigation" or "incident" */
  areas: string[];
  build(rng: Rng, tables: Dataset[]): InvestigationDraft | null;
}
