import type { Dataset } from "@/lib/arena-workstations/engines/dataset";
import type { CleaningStep } from "@/lib/arena-workstations/engines/cleaning";
import type { SpreadsheetContent } from "@/lib/arena-workstations/engines/spreadsheet";
import type { BiSpec } from "@/lib/arena-workstations/engines/bi";
import type { StatQuestion } from "@/lib/arena-workstations/engines/stats";
import type { Difficulty } from "@/lib/arena-workstations/types";
import type { ExperienceLevel } from "../level";
import type { Rng } from "../rng";
import type { Requester } from "../tickets/types";

interface Base {
  templateId: string;
  difficulty: Difficulty;
  minLevel: ExperienceLevel;
  title: string;
  requester: Requester;
  /** the stakeholder's message in their own voice */
  scenario: string;
  skillTags: string[];
}

/** A spreadsheet ticket: a real slice of the company's data plus the formulas the stakeholder needs. */
export interface SheetDraft extends Base {
  content: SpreadsheetContent;
}

/** A cleaning ticket: a raw, messy export and the steps that turn it into a usable table (the answer is whatever those steps produce). */
export interface CleanDraft extends Base {
  dataset: Dataset;
  steps: CleaningStep[];
}

/** A dashboard ticket: a flat reporting table and the one chart that answers the stakeholder's question. */
export interface DashboardDraft extends Base {
  dataset: Dataset;
  spec: BiSpec;
}

/** A statistics ticket: measurements per order and the questions to answer from them. */
export interface StatsDraft extends Base {
  dataset: Dataset;
  questions: StatQuestion[];
}

export interface OfficeTemplate<D> {
  id: string;
  difficulty: Difficulty;
  minLevel: ExperienceLevel;
  /** the skill area it belongs to: "spreadsheet", "data_cleaning", "dashboard" or "statistics" */
  areas: string[];
  build(rng: Rng, tables: Dataset[]): D;
}

export type SheetTemplate = OfficeTemplate<SheetDraft>;
export type CleanTemplate = OfficeTemplate<CleanDraft>;
export type DashboardTemplate = OfficeTemplate<DashboardDraft>;
export type StatsTemplate = OfficeTemplate<StatsDraft>;
