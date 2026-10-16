import { parse as parseYaml } from "yaml";
import { DIFFICULTY_LABEL, type GenerationContext } from "@/lib/arena-workstations/types";
import { makeRng } from "../rng";
import { generateFileTask, realDeps, validateFileTask, type Deps, type FileTaskKit } from "../file-tasks/generate";
import type { FileLanguage } from "../file-tasks/types";
import { CheckSchema, parseDockerfile, runChecks, type Check } from "./checks";
import type { DevopsDraft } from "./tickets";

export { realDeps, type Deps };

const CLOUD_SETTINGS = ["a fintech start-up on AWS", "an online learning platform on AWS", "a hospital group moving to the cloud", "a retail chain's order system", "a media company's image pipeline", "a logistics firm's tracking API", "a government services portal", "a gaming studio's leaderboard backend"];
const SETTINGS = ["a food-delivery backend", "an online exam portal", "a ticket-booking API", "a payments gateway", "a hospital records service", "a logistics tracker", "a video-streaming site", "a ride-sharing service", "a school ERP", "an e-commerce storefront", "a chat application", "a weather data pipeline"];
const AREA_BRIEF: Record<string, { files: string; ideas: string[] }> = {
  containers: { files: "one Dockerfile (language dockerfile)", ideas: ["a multi-stage build for a small image", "running as a non-root user", "layer caching: copy dependency files before source", "a pinned base image and a HEALTHCHECK", "removing build tools and caches from the final image", "using .dockerignore-style hygiene inside the Dockerfile (no ADD of remote URLs, no secrets in ENV)"] },
  "ci-cd": { files: "one GitHub Actions workflow (.github/workflows/<name>.yml, language yaml)", ideas: ["test on push and pull request with a Node, Python or Java matrix", "dependency caching", "build and push a container image only on main", "a deploy job that needs the test job and uses an environment", "least-privilege permissions for the workflow", "a scheduled nightly run plus manual dispatch"] },
  kubernetes: { files: "one or two Kubernetes manifests (language yaml)", ideas: ["probes and resource requests/limits", "a Service of a given type and port mapping", "a ConfigMap and Secret used through env or volumes", "a HorizontalPodAutoscaler", "a rolling update strategy with maxUnavailable", "an Ingress with a host and path", "a securityContext with runAsNonRoot and a read-only root filesystem"] },
  "infrastructure-as-code": { files: "a docker-compose.yml (language yaml) or a Terraform file named main.tf (language text, checked by pattern)", ideas: ["service dependencies with health checks", "named volumes and networks", "environment configuration through variables", "an S3 bucket with versioning and a private ACL in Terraform", "a Terraform variable with a type and a default, used by a resource", "resource tagging in Terraform"] },
  "iam-security": { files: "one or two IAM policy documents (language json, AWS policy JSON: Version and a Statement list of Effect, Action, Resource, optional Condition)", ideas: ["cutting a wildcard policy down to least privilege for one bucket or table", "a deny statement or a Condition that forces MFA or HTTPS (aws:SecureTransport)", "a trust policy that lets only one role or service assume a role", "restricting an action to one resource prefix", "a permission boundary or a policy for read-only support staff", "separating a read policy from a write policy for two jobs"] },
  networking: { files: "one CloudFormation template (language yaml) with security groups, subnets or route tables", ideas: ["security group rules limited to specific CIDRs or another security group", "private subnets without a route to an internet gateway plus a NAT route", "a network ACL denying one range", "a load balancer security group that is public while the instances are not", "separate security groups for web, app and database tiers", "a VPC endpoint for S3 so traffic stays private"] },
  "storage-and-data": { files: "one CloudFormation template (language yaml) for S3, DynamoDB or RDS", ideas: ["an S3 bucket with encryption, versioning and public access blocked", "a lifecycle rule moving objects to cheaper storage and expiring old versions", "a DynamoDB table with on-demand billing, point-in-time recovery and a TTL attribute", "an S3 bucket policy that denies non-HTTPS requests", "a DynamoDB table with a global secondary index for a query pattern", "an RDS instance with encryption, backups and a private subnet group"] },
  "serverless-and-compute": { files: "one CloudFormation or SAM template (language yaml) with Lambda, API Gateway or ECS/EC2", ideas: ["a Lambda function with runtime, memory, timeout and tracing set properly", "a Lambda triggered by an SQS queue with a dead-letter queue and a batch size", "an API Gateway endpoint wired to a function with throttling", "an EC2 launch template with IMDSv2 required and an instance profile", "a scheduled Lambda (EventBridge rule) with an environment variable and least-privilege role", "an ECS task definition with CPU, memory and a log configuration"] },
  "cost-and-reliability": { files: "one CloudFormation template (language yaml)", ideas: ["an RDS instance made Multi-AZ with backups and deletion protection", "an Auto Scaling group with minimum, maximum and a target-tracking policy", "an S3 lifecycle policy to cut storage cost", "a CloudWatch alarm on an error or CPU metric with an SNS topic action", "a DynamoDB table switched from provisioned to on-demand", "tags required for cost allocation on every resource"] },
  "cloud-debugging": { files: "one broken IAM policy (language json) or CloudFormation template (language yaml)", ideas: ["a policy that is syntactically valid but never grants access (wrong action name, wrong ARN, wrong Effect case)", "a template with a typo in a property name that makes a setting silently ignored", "a security group rule that opens the wrong port", "a resource missing a required property", "an ARN that lacks /* so object access is denied", "a Condition that can never be true"] },
  "config-debugging": { files: "one broken config of any kind (language yaml or dockerfile)", ideas: ["a misspelt key that makes a setting silently ignored", "steps in the wrong order", "an unpinned or wrong image tag", "a missing required field", "a wrong port or selector mismatch between a Service and a Deployment", "an indentation mistake that changes the meaning"] },
};

const SYSTEM = `You design one realistic cloud or DevOps task for a learner, as a request from a colleague at a fictional Indian company. The learner edits configuration files; a program checks the files against rules you write. You do not write code that runs: you describe the files and the checks.

Output:
- "files": 1-3 files. Each has a "name", a "language" (yaml, dockerfile or text), a "starter" (what the learner begins with: a skeleton, or for debugging a file with realistic mistakes) and a "solution" (a fully correct version). Keep each file under 40 lines.
- "checks": 5-10 rules the solution must satisfy and the starter must mostly fail. Each has a "label" that states the requirement in plain words (the learner sees these, so the task must be fully explained by the deliverable and the labels) and one of these kinds:
  * {"kind":"yaml","file","path","op","value"} (also for json files): path like "spec.template.spec.containers[*].image", "jobs.build.steps[0].uses" or "Resources.*.Properties.Timeout"; [*] means every item of a list and a key of * means every value of an object (use it for CloudFormation resources, whose names vary). equals compares case-sensitively; matches and all_match are case-insensitive regexes. op is exists, not_exists, equals, contains, matches (regex on a value), all_match (every value matches the regex), or count_gte.
  * {"kind":"docker","file","instr","op","value","other"}: instr like FROM, RUN, USER; op is exists, not_exists, matches, all_match, first_matches, last_matches, or before (the first instruction matching value comes before the first line matching other). value and other are case-insensitive regexes over the arguments.
  * {"kind":"regex","file","pattern","op"}: op matches or not_matches against the file text (use for Terraform, shell, nginx).
- To require that a value is NOT something (for example no wildcard action), use all_match with a negative lookahead such as ^(?!s3:\\*$).+ or ^(?!0\\.0\\.0\\.0/0$), or not_exists for something that must be absent. Never use matches for a negative requirement. Do not ask for more items (statements, subnets, rules) than the task needs; count checks must be satisfied by your own solution.
- Regexes must be short and simple (no nested quantifiers, no backreferences). Use a check only on a file of a fitting language (yaml checks on yaml or json files, docker checks on dockerfile files).
- The solution must pass every check. The starter must fail at least two. No check may depend on a detail the deliverable does not mention.
Write "title" (specific), "scenario" (the colleague's message in their own voice, 2-4 sentences: what went wrong and why it matters) and "deliverable" (one or two sentences telling the learner what to edit). Output JSON only, exactly the requested shape.`;

const SOLVER_SYSTEM = `You are a cloud and DevOps engineer. Edit the configuration files so they do what the task asks. Follow every requirement stated in the task literally. Return JSON only: {"files": [{"name": "<same file name>", "content": "<the complete corrected file>"}]}.`;

function describe(ctx: GenerationContext): string {
  const rng = makeRng(ctx.ticketSeed ?? 1);
  const area = AREA_BRIEF[ctx.areaKey ?? "containers"] ?? AREA_BRIEF.containers;
  const cloud = !["containers", "ci-cd", "kubernetes", "infrastructure-as-code", "config-debugging"].includes(ctx.areaKey ?? "");
  return `Role: ${ctx.roleName}. Area: ${ctx.areaName}. Difficulty: ${DIFFICULTY_LABEL[ctx.difficulty]}. Experience of the learner: ${ctx.level ?? "fresher"}.
${cloud ? "Use AWS. " : ""}Files: ${area.files}. Setting: ${rng.pick(cloud ? CLOUD_SETTINGS : SETTINGS)}. Core idea to exercise: ${rng.pick(area.ideas)}.
${ctx.avoidTitles.length ? `Do not reuse or rephrase these earlier titles, and pick a different problem:\n- ${ctx.avoidTitles.slice(0, 20).join("\n- ")}` : ""}`;
}

function parsesAs(language: FileLanguage, content: string): string | null {
  try {
    if (language === "yaml") content.split(/^---\s*$/m).filter((d) => d.trim()).forEach((d) => parseYaml(d, { logLevel: "error" }));
    if (language === "json") JSON.parse(content);
    if (language === "dockerfile" && !/^(FROM|ARG)$/.test(parseDockerfile(content)[0]?.instr ?? "")) return "a Dockerfile must begin with FROM";
    return null;
  } catch (e) {
    return `does not parse: ${(e as Error).message.slice(0, 80)}`;
  }
}

const kit: FileTaskKit<Check> = {
  languages: ["yaml", "json", "dockerfile", "text"],
  checkSchema: CheckSchema,
  run: runChecks,
  fit: (c, language) => ((c.kind === "yaml" && language !== "yaml" && language !== "json") || (c.kind === "docker" && language !== "dockerfile") ? `a ${c.kind} check was used on a ${language} file` : null),
  parses: parsesAs,
  debugAreas: ["config-debugging", "cloud-debugging"],
  system: SYSTEM,
  solverSystem: SOLVER_SYSTEM,
  brief: describe,
};

/** Throws GenerationRejected with the first reason the exercise is not fair (exported for tests). */
export const validate = (raw: Parameters<typeof validateFileTask<Check>>[1], area: string, avoid: readonly string[], solve: Parameters<typeof validateFileTask<Check>>[4]) => validateFileTask(kit, raw, area, avoid, solve);

/** One fresh exercise for this user's area and level, served only if its own solution passes its own checks and an independent solver agrees. */
export const generateAiDevops = (ctx: GenerationContext, deps: Deps = realDeps, previousProblem?: string): Promise<DevopsDraft> => generateFileTask(kit, ctx, deps, previousProblem);
