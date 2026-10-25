import { AREA_MIN_LEVEL } from "@/lib/workplace/areas";
import { levelAtLeast, type ExperienceLevel } from "@/lib/workplace/level";

export interface SessionStage {
  key: string;
  /** arena_skill_areas.area_key of the IT-01 role; the existing tool and grader for that area serve the stage */
  areaKey: string;
  title: string;
  /** what the student is asked to achieve at this point of the story */
  goal: string;
  /** serve only tickets of these kinds (see TASK_KINDS); absent means any ticket of the area */
  taskKinds?: readonly string[];
  /** the stage's tool reports what the student explored (SQL queries run), so Discovery is assessed on it */
  explorable?: boolean;
}

export interface ProofSessionSpec {
  key: string;
  version: number;
  roleId: string;
  domainRoleKey: string;
  title: string;
  /** the shared company world: every stage uses the same warehouse, seeded per student */
  worldKey: string;
  /** what the report says was done, e.g. "a simulated BrightCart analysis" */
  claimSubject: string;
  /** shown before the student starts */
  intro: string;
  /** stages for people who may not yet be served an area that needs experience */
  stagesFor(level: ExperienceLevel): SessionStage[];
  /** what the session does and does not show, repeated in every report */
  limitations: string[];
}

const PREPARE: SessionStage = { key: "prepare", areaKey: "data_cleaning", title: "Prepare the data", goal: "Profile the warehouse extract and clean what would corrupt the numbers." };
const ANALYSE: SessionStage = { key: "analyse", areaKey: "sql", title: "Answer the business question", goal: "Write the SQL that answers the manager's question on the cleaned data.", taskKinds: ["retrieval", "analytics"], explorable: true };
const CROSSCHECK: SessionStage = { key: "crosscheck", areaKey: "spreadsheet", title: "Cross-check the number", goal: "Rebuild the headline figure in a spreadsheet and confirm it matches." };
const REPORT: SessionStage = { key: "report", areaKey: "dashboard", title: "Report it", goal: "Build the dashboard view the stakeholder will actually read." };
const FINDINGS_JUNIOR: SessionStage = { key: "findings", areaKey: "investigation", title: "Explain what is going on", goal: "Find what is behind the movement in the numbers and report it with evidence.", explorable: true };
const FINDINGS_FRESHER: SessionStage = { key: "findings", areaKey: "statistics", title: "Is the change real?", goal: "Test whether the movement is more than noise and state the conclusion." };

export const DATA_ANALYST_STORY: ProofSessionSpec = {
  key: "da-brightcart-story",
  version: 1,
  roleId: "IT-01",
  domainRoleKey: "data-analyst",
  title: "From raw extract to evidence-backed recommendation",
  worldKey: "brightcart",
  claimSubject: "a simulated BrightCart analysis",
  intro: "One connected piece of work in five stages, on your own company data: prepare the data, answer the business question, cross-check the number, report it, and explain what is behind it. About an hour or two. You explain your work at the end.",
  stagesFor: (level) => [PREPARE, ANALYSE, CROSSCHECK, REPORT, levelAtLeast(level, AREA_MIN_LEVEL[FINDINGS_JUNIOR.areaKey] ?? "fresher") ? FINDINGS_JUNIOR : FINDINGS_FRESHER],
  limitations: [
    "Each stage is graded by its own tool on data from the same company warehouse. A later stage is not computed from the student's earlier output, so the chain shows the work done, not a single end-to-end pipeline.",
    "Activity signals such as reading the brief or inspecting a table are reported by the browser and can be faked; they are marked lower-trust.",
    "Dimension levels describe what the session log shows. They never decide pass or fail.",
  ],
};
