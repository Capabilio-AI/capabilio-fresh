import { runChecks } from "@/lib/workplace/devops/checks";
import { generateAiDevops } from "@/lib/workplace/devops/ai";
import { DEVOPS_TEMPLATES } from "@/lib/workplace/devops/tickets";
import { APP_DEV_DEVOPS_TEMPLATES } from "@/lib/workplace/application-developer/devops-templates";
import { makeFileTaskTool } from "./file-task";

export type { FileSubmission as DevopsSubmission } from "./file-task";

/** DevOps and Cloud: the user edits Dockerfiles, CI workflows, Kubernetes, Compose, Terraform, IAM policies and CloudFormation. */
export const devopsTool = makeFileTaskTool({
  toolType: "devops_workspace",
  generationVersion: "devops.gen.v1",
  gradingVersion: "devops.grade.v1",
  defaultArea: "containers",
  aiSwitch: "DEVOPS_AI_GENERATION",
  family: "devops",
  templates: [...DEVOPS_TEMPLATES, ...APP_DEV_DEVOPS_TEMPLATES],
  generateAi: (ctx, previous) => generateAiDevops(ctx, undefined, previous),
  run: runChecks,
});
