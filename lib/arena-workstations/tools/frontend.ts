import { runFrontendChecks } from "@/lib/workplace/frontend/checks";
import { generateAiFrontend } from "@/lib/workplace/frontend/ai";
import { FRONTEND_TEMPLATES } from "@/lib/workplace/frontend/tickets";
import { makeFileTaskTool } from "./file-task";

/** Frontend: the user edits HTML and CSS; the server parses the files and checks structure, accessibility and styling. The page is never run on the server. */
export const frontendTool = makeFileTaskTool({
  toolType: "frontend_workspace",
  generationVersion: "frontend.gen.v1",
  gradingVersion: "frontend.grade.v1",
  defaultArea: "html-semantics",
  aiSwitch: "FRONTEND_AI_GENERATION",
  family: "frontend",
  templates: FRONTEND_TEMPLATES,
  generateAi: (ctx, previous) => generateAiFrontend(ctx, undefined, previous),
  run: runFrontendChecks,
});
