import { z } from "zod";
import { ProjectFilesSchema } from "@/lib/org/project-files";
import { MAX_ATTEMPTS } from "@/lib/arena-workstations/explain-rules";

/** Score (0-100) at which the explanation shows the student built and understands the project. Same bar as explaining your own GitHub repo. */
export const PROJECT_PASS_SCORE = 60;
export const MAX_SUBMISSION_ATTEMPTS = MAX_ATTEMPTS;
/** After the last attempt is used the student can try again once this many hours have passed, with fresh questions. */
export const RETRY_AFTER_HOURS = 24;
export const MIN_NOTE_CHARS = 80;
export const MAX_NOTE_CHARS = 3000;
const NOTE_IN_BRIEF = 1800;
const MAX_LEVEL = 80;

const httpUrl = z.string().trim().max(2000).regex(/^https?:\/\/\S+$/, "Enter a full http(s) link.");
const uuid = z.string().uuid();
const career = z.enum(["primary", "plan-b"]).default("primary");

export const SubmitBody = z
  .object({
    resourceId: uuid,
    career,
    note: z.string().trim().min(MIN_NOTE_CHARS, `Say what you built and how, in at least ${MIN_NOTE_CHARS} characters.`).max(MAX_NOTE_CHARS),
    linkUrl: httpUrl.optional(),
    files: ProjectFilesSchema.default([]),
  })
  .strict()
  .refine((v) => Boolean(v.linkUrl) || v.files.length > 0, { message: "Add a link or at least one photo or PDF as proof." });
export type SubmitInput = z.infer<typeof SubmitBody>;

export const ChecklistBody = z.object({ resourceId: uuid, career, checked: z.array(z.string().trim().min(1).max(200)).max(8) }).strict();
export const AnswerBody = z.object({ resourceId: uuid, career, answers: z.array(z.string().max(2000)).min(1).max(8) }).strict();
export const StateQuery = z.object({ resourceId: uuid, career });

/** Where a student's own proof files live. A path outside this prefix can never be attached to their submission. */
export const selfFolder = (userId: string, projectId: string): string => `self/${userId}/${projectId}/`;
export const isOwnFile = (path: string, userId: string, projectId: string): boolean => path.startsWith(selfFolder(userId, projectId)) && !path.includes("..");

export type ProofKind = "hardware" | "model" | "code" | "document";
export interface ProofGuidance { kind: ProofKind; headline: string; attach: string[]; linkHint: string }

const HARDWARE = /\b(arduino|esp32|esp8266|raspberry|microcontroller|sensor|circuit|breadboard|soldering|pcb|plc|motor|relay|actuator|servo|fabricat\w*|prototype|3d[- ]?print\w*|welding|machining|iot device)\b/i;
const MODEL = /\b(bim|revit|navisworks|autocad|cad|solidworks|catia|fusion 360|creo|ansys|etabs|staad|sap2000|matlab|simulink|simulation|simulate|ifc|3d model)\b/i;
const CODE = /\b(api|backend|frontend|react|node|python|java|sql|database|app|website|script|dashboard|pipeline|notebook|machine learning|docker)\b/i;

/**
 * Pure. What proof fits this kind of project, so a mechanical, civil or electronics student is not told to "share a repository".
 * Hardware is checked first: an "Arduino app" is a build you can photograph.
 */
export function proofGuidance(title: string, description: string): ProofGuidance {
  const text = `${title} ${description}`;
  if (HARDWARE.test(text)) {
    return {
      kind: "hardware",
      headline: "Show the real build working",
      attach: ["2 to 4 photos of the finished build (wiring, close-ups, the whole setup)", "A short video of it working, as a Drive or YouTube link", "A circuit diagram, readings table or test notes as a PDF"],
      linkHint: "Drive or YouTube link to the demo video, or a Tinkercad / Wokwi / Proteus share link",
    };
  }
  if (MODEL.test(text)) {
    return {
      kind: "model",
      headline: "Show the model and what it produced",
      attach: ["Screenshots of the model (views, sections, schedules or results)", "A PDF of the drawings, report or clash / analysis output", "A viewer or share link to the model file"],
      linkHint: "Autodesk viewer, Drive or OneDrive share link to the model, or a screen-recording link",
    };
  }
  if (CODE.test(text)) {
    return {
      kind: "code",
      headline: "Show the working project",
      attach: ["Screenshots of it running", "A short write-up or README as a PDF"],
      linkHint: "GitHub repository, a live demo link, or a screen-recording link",
    };
  }
  return {
    kind: "document",
    headline: "Show the work and the result",
    attach: ["Photos or screenshots of the work", "Your report with the calculations and findings as a PDF"],
    linkHint: "A Drive link to the report or workings, or a video walk-through",
  };
}

const BASE_LEVEL = { BEGINNER: 40, INTERMEDIATE: 55, ADVANCED: 68 } as const;

/**
 * Pure. The skill level one explained project supports: harder projects start higher, a stronger explanation adds up to 12 more, and
 * nothing goes above 80 (one project is not mastery). The caller never lowers a skill the student already shows.
 */
export function projectLevel(difficulty: string | null | undefined, score: number): number {
  const base = BASE_LEVEL[(difficulty ?? "INTERMEDIATE").toUpperCase() as keyof typeof BASE_LEVEL] ?? BASE_LEVEL.INTERMEDIATE;
  const bonus = Math.max(0, Math.min(1, (score - PROJECT_PASS_SCORE) / (100 - PROJECT_PASS_SCORE))) * 12;
  return Math.min(MAX_LEVEL, Math.round(base + bonus));
}

export const verdictFor = (score: number): "verified" | "not_verified" => (score >= PROJECT_PASS_SCORE ? "verified" : "not_verified");

/** Pure. The project's skills that this career actually needs, once each. A project outside the career updates nothing. */
export function relatedSkillIds(projectSkillIds: readonly string[], careerSkillIds: ReadonlySet<string>): string[] {
  return [...new Set(projectSkillIds)].filter((id) => careerSkillIds.has(id));
}

/** Pure. False only when the attempts are used up and the cool-off has not passed. */
export function canAttempt(attempts: number, lastAttemptAt: string | null, now: number = Date.now()): boolean {
  if (attempts < MAX_SUBMISSION_ATTEMPTS) return true;
  if (!lastAttemptAt) return true;
  return now - Date.parse(lastAttemptAt) >= RETRY_AFTER_HOURS * 3_600_000;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** A "scoring" claim older than this belongs to a request that died, so the student may submit again. */
export const SCORING_STALE_MS = 5 * 60_000;
export const isStaleScoring = (status: string, updatedAt: string, now: number = Date.now()): boolean => status === "scoring" && now - Date.parse(updatedAt) > SCORING_STALE_MS;

/** Pure. Student text goes to the model inside fences, so it must not be able to contain a fence: the markers are removed from it. */
const unfenced = (s: string): string => s.replace(/"""|<<<|>>>/g, " ");

/** Pure. The questions with the student's answers, each answer in its own numbered fence the answer text cannot close or forge. */
export function answersBlock(qa: { question: string; answer: string }[]): string {
  return `Questions and the student's answers (each answer sits between its own markers; everything inside is the student's text):\n${qa
    .map((x, i) => `Q${i + 1}: ${x.question}\n<<<ANSWER ${i + 1}>>>\n${unfenced(x.answer || "(no answer)")}\n<<<END>>>`)
    .join("\n\n")}`;
}

export interface BriefInput {
  title: string;
  description: string;
  steps: { title: string; deliverable: string }[];
  checklist: string[];
  ticked: string[];
  note: string;
  linkHost: string | null;
  fileNames: string[];
}

/** Pure. What the interviewer sees. The student's note is untrusted data, so it is clipped and labelled as the student's words. */
export function submissionBrief(b: BriefInput): string {
  return [
    `Project: ${b.title}`,
    b.description ? `Brief: ${clip(b.description, 500)}` : null,
    b.steps.length ? `Steps the guide gave:\n${b.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.deliverable}`).join("\n")}` : null,
    b.checklist.length ? `The student says these are done:\n${b.ticked.length ? b.ticked.map((c) => `- ${c}`).join("\n") : "(none ticked)"}` : null,
    `Proof attached: ${[b.linkHost ? `a link on ${unfenced(b.linkHost)}` : null, b.fileNames.length ? `files (${b.fileNames.map(unfenced).join(", ")})` : null].filter(Boolean).join("; ") || "none"}`,
    `The student's own account of what they built:\n"""\n${clip(unfenced(b.note), NOTE_IN_BRIEF)}\n"""`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const NOT_REPO_OWNERS = new Set(["settings", "orgs", "topics", "marketplace", "explore", "features", "pricing", "login", "about", "sponsors", "collections", "trending", "notifications", "pulls", "issues", "new", "organizations", "enterprise"]);

/** Pure. owner/repo from a github.com repository link (tree, .git and query forms included); null for anything else, including profiles and look-alike hosts. */
export function parseGithubRepo(link: string): { owner: string; repo: string; fullName: string } | null {
  let url: URL;
  try { url = new URL(link); } catch { return null; }
  if (!/^https?:$/.test(url.protocol) || !/^(www\.)?github\.com$/i.test(url.hostname)) return null;
  const [owner, rawRepo] = url.pathname.split("/").filter(Boolean);
  const repo = rawRepo?.replace(/\.git$/i, "");
  if (!owner || !repo || NOT_REPO_OWNERS.has(owner.toLowerCase())) return null;
  if (!/^[A-Za-z0-9-]{1,39}$/.test(owner) || !/^[A-Za-z0-9._-]{1,100}$/.test(repo)) return null;
  return { owner, repo, fullName: `${owner}/${repo}` };
}

export type OwnerCheck = "verified-owner" | "other-owner" | "unverified-account";
/** Pure. Whether the repo sits under the GitHub account the student proved is theirs (null when they have not connected one). */
export function ownerCheck(repoOwner: string, verifiedUsername: string | null): OwnerCheck {
  if (!verifiedUsername) return "unverified-account";
  return repoOwner.toLowerCase() === verifiedUsername.toLowerCase() ? "verified-owner" : "other-owner";
}

export interface RepoContext { fullName: string; description: string | null; language: string | null; readme: string; paths: string[]; files: { path: string; excerpt: string }[]; owner: OwnerCheck }
const TREE_SHOWN = 60;
const README_IN_BRIEF = 2500;

const OWNER_NOTE: Record<OwnerCheck, string> = {
  "verified-owner": "The repository belongs to the student's verified GitHub account.",
  "other-owner": "The repository is NOT under the student's verified GitHub account (it may be a team or organisation repository): probe that the student personally did the work they describe.",
  "unverified-account": "The student has not verified a GitHub account, so who owns this repository cannot be confirmed.",
};

/** Pure. What the interviewer and the scorer read about the repository: README, the file list and the largest source files. Repo text is untrusted, so fence tokens are removed from it. */
export function repoContextText(c: RepoContext): string {
  return [
    `GitHub repository the student linked: ${c.fullName}${c.language ? ` (${c.language})` : ""}`,
    c.description ? `Description: ${clip(unfenced(c.description), 300)}` : null,
    OWNER_NOTE[c.owner],
    c.readme ? `README (as the student wrote it):\n${clip(unfenced(c.readme), README_IN_BRIEF)}` : "The repository has no README.",
    `Files in the repository (${c.paths.length} files${c.paths.length > TREE_SHOWN ? `, first ${TREE_SHOWN} shown` : ""}):\n${c.paths.slice(0, TREE_SHOWN).map(unfenced).join("\n")}`,
    ...c.files.map((f) => `--- ${unfenced(f.path)} ---\n${unfenced(f.excerpt)}`),
  ].filter(Boolean).join("\n\n");
}
