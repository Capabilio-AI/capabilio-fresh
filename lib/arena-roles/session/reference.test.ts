import { describe, expect, it } from "vitest";
import { referenceSubmission } from "@/lib/arena-workstations/reference-submission";
import { toolFor } from "@/lib/arena-workstations/registry";
import { hashSeed } from "@/lib/workplace/rng";
import { DATA_ANALYST_STORY } from "../sessions/data-analyst-story";

// Every stage of the Data Analyst session must be solvable by its own reference answer, whichever student (and so whichever generated ticket) it is.
// This runs the real generators and graders with no database, across many students, so a bad ticket shows up here and not in front of a person.
const STUDENTS = 25;
const LEVELS = ["fresher", "junior"] as const;
const TOOL_OF: Record<string, string> = { data_cleaning: "cleaning_workspace", sql: "sql_workspace", spreadsheet: "spreadsheet_workspace", dashboard: "dashboard_workspace", statistics: "statistics_workspace", investigation: "investigation_workspace" };

describe("Data Analyst session stages are solvable", () => {
  for (const level of LEVELS) {
    for (const stage of DATA_ANALYST_STORY.stagesFor(level)) {
      if (stage.areaKey === "investigation") continue; // graded from findings; covered by the investigation tool's own tests
      it(`${level}/${stage.key} (${stage.areaKey}): the reference answer is accepted and passes for ${STUDENTS} different students`, async () => {
        const tool = toolFor(TOOL_OF[stage.areaKey]);
        const problems: string[] = [];
        for (let n = 0; n < STUDENTS; n++) {
          const userId = `student-${n}-${level}`;
          const generated = await tool.generate({
            roleName: "Data Analyst", parentSkill: "Data Analysis", areaName: stage.title, difficulty: "easy", avoidTitles: [], roleKey: "data-analyst", areaKey: stage.areaKey, onlyTaskKinds: stage.taskKinds?.slice(),
            worldSeed: hashSeed(userId, "data-analyst", "world"), ticketSeed: hashSeed(userId, "data-analyst", "session", `session-${n}`, stage.key), level, recentKinds: [],
          });
          // the "business question" stage must never be a script task (UPDATE, ALTER ...)
          if (stage.taskKinds) expect((generated.content as { mode?: string }).mode, `${userId} mode`).toBe("query");
          const submission = referenceSubmission(tool.toolType, generated.content, generated.answer_key);
          const parsed = tool.submissionSchema.safeParse(submission);
          if (!parsed.success) {
            problems.push(`${userId}: rejected: ${parsed.error.issues.slice(0, 2).map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
            continue;
          }
          const grade = await tool.grade(generated.content, generated.answer_key, parsed.data);
          if (!grade.passed) problems.push(`${userId}: did not pass: ${grade.checks.filter((c) => !c.passed).map((c) => c.label).join("; ")}`);
        }
        expect(problems).toEqual([]);
      }, 120_000);
    }
  }
});
