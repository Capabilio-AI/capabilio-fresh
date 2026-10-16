import { DIFFICULTY_LABEL, type GenerationContext } from "@/lib/arena-workstations/types";
import { makeRng } from "../rng";
import { generateFileTask, realDeps, validateFileTask, type Deps, type FileTaskKit } from "../file-tasks/generate";
import { FrontendCheckSchema, frontendFit, frontendParses, runFrontendChecks, type FrontendCheck } from "./checks";
import type { FrontendDraft } from "./tickets";

export { realDeps, type Deps };

const SETTINGS = ["a bakery's online shop", "a yoga studio's booking page", "a college fest landing page", "a bike-rental start-up", "a hospital's appointment page", "a local news site", "a city library's catalogue", "a food-truck menu", "a travel agency's tour page", "a coaching institute's course page", "a neighbourhood grocery's offers page", "a music school's signup page"];
const AREAS: Record<string, { files: string; ideas: string[] }> = {
  "html-semantics": { files: "one index.html (language html), no CSS needed", ideas: ["landmarks: header, nav, main, article, aside, footer", "a heading hierarchy with one h1 and h2/h3 sections", "a data table with caption, thead, th scope and tbody", "figure and figcaption for images, time and address elements", "lists for navigation and steps (ul, ol) instead of line breaks", "details and summary for an FAQ"] },
  "css-layout": { files: "index.html (language html) and style.css (language css)", ideas: ["a flexbox toolbar or navbar with alignment and gap", "a CSS grid dashboard with named areas or template columns", "centring a card both ways", "a sticky header and a footer that stays at the bottom", "equal-height cards in a row with gap", "CSS custom properties for colours and spacing used across rules"] },
  "responsive-design": { files: "index.html (language html) and style.css (language css)", ideas: ["a mobile-first layout that gains columns at a min-width breakpoint", "fluid images (max-width: 100%) and the viewport meta tag", "clamp() for fluid font sizes", "grid with repeat(auto-fit, minmax(...)) that needs no media query", "a navigation that stacks on phones and runs in a row on wider screens", "prefers-color-scheme or prefers-reduced-motion media queries"] },
  accessibility: { files: "index.html (language html), optionally style.css (language css)", ideas: ["alt text on images and empty alt on decorative ones", "an accessible name for icon-only buttons (aria-label)", "a skip link and a lang attribute", "visible focus styles with :focus-visible in CSS", "landmarks and a single h1 so screen reader users can navigate", "not relying on colour alone: text or icons for error states"] },
  forms: { files: "index.html (language html)", ideas: ["labels tied to inputs with for/id", "the right input types (email, tel, number, date) with required, min, max or pattern", "fieldset and legend for a group of radio buttons", "autocomplete attributes for a checkout form", "an error message linked with aria-describedby", "select, textarea and a submit button with type=submit"] },
  "frontend-debugging": { files: "index.html (language html) and style.css (language css) containing a few realistic mistakes", ideas: ["a stylesheet link pointing at the wrong file name", "a selector that never matches (class typo, missing dot)", "a misspelt CSS property that is silently ignored", "an unclosed tag that changes the nesting", "a missing viewport meta tag or lang attribute", "a rule that never applies because of a typo in an id or class in the HTML"] },
};

const SYSTEM = `You design one realistic frontend task for a learner, as a request from a colleague at a fictional Indian company. The learner edits HTML and CSS files; a program parses the files and checks them against rules you write. You do not write code that runs: you describe the files and the checks.

Output:
- "files": 1-3 files. Each has a "name", a "language" (html, css or javascript), a "starter" (what the learner begins with: a skeleton, or for debugging a page with realistic mistakes) and a "solution" (a fully correct version). Keep each file under 45 lines. An html file that uses a stylesheet links it by its real file name.
- "checks": 5-10 rules the solution must satisfy and the starter must mostly fail. Each has a "label" that states the requirement in plain words (the learner sees these, so the task must be fully explained by the deliverable and the labels) and one of these kinds:
  * {"kind":"html","file","selector","op","attr","value"}: elements of an html file found with a CSS selector (use ordinary selectors such as "nav a", "img:not([alt])", "input[type=email]", "main article"). op is exists, not_exists, count_gte, count_equals (value is a number), text_contains, text_matches, attr_equals, attr_matches (needs attr and value), attr_exists (every match has the attribute), or attr_missing.
  * {"kind":"css","file","selector","media","property","op","value"}: a declaration inside a rule of a css file. selector is optional (any rule when omitted) and must be written as in the stylesheet; "media" is an optional regex over the @media condition such as "min-width"; op is exists, not_exists, equals (the whole value, case-insensitive) or matches (regex).
  * {"kind":"css_at","file","name","pattern"}: an at-rule: name is media, supports, keyframes, font-face or import; pattern is an optional regex over its parameters; op is exists (default) or not_exists.
  * {"kind":"regex","file","pattern","op"}: matches or not_matches against the raw text of a file (use for JavaScript).
- To require that something is NOT present or not a value, use not_exists, or attr_missing, or an op with a regex using a negative lookahead; never use matches for a negative requirement. Regexes must be short and simple (no nested quantifiers, no backreferences). Use html checks only on html files and css checks only on css files.
- The solution must pass every check. The starter must fail at least two. No check may depend on a detail the deliverable does not mention. Do not ask for more elements or rules than the task needs.
Write "title" (specific), "scenario" (the colleague's message in their own voice, 2-4 sentences: what is wrong and why it matters) and "deliverable" (one or two sentences telling the learner what to edit). Output JSON only, exactly the requested shape.`;

const SOLVER_SYSTEM = `You are a frontend developer. Edit the files so they do what the task asks. Follow every requirement stated in the task literally. Return JSON only: {"files": [{"name": "<same file name>", "content": "<the complete corrected file>"}]}.`;

function brief(ctx: GenerationContext): string {
  const rng = makeRng(ctx.ticketSeed ?? 1);
  const area = AREAS[ctx.areaKey ?? "html-semantics"] ?? AREAS["html-semantics"];
  return `Role: ${ctx.roleName}. Area: ${ctx.areaName}. Difficulty: ${DIFFICULTY_LABEL[ctx.difficulty]}. Experience of the learner: ${ctx.level ?? "fresher"}.
Files: ${area.files}. Setting: ${rng.pick(SETTINGS)}. Core idea to exercise: ${rng.pick(area.ideas)}.
${ctx.avoidTitles.length ? `Do not reuse or rephrase these earlier titles, and pick a different problem:\n- ${ctx.avoidTitles.slice(0, 20).join("\n- ")}` : ""}`;
}

const kit: FileTaskKit<FrontendCheck> = {
  languages: ["html", "css", "javascript"],
  checkSchema: FrontendCheckSchema,
  run: runFrontendChecks,
  fit: frontendFit,
  parses: frontendParses,
  debugAreas: ["frontend-debugging"],
  system: SYSTEM,
  solverSystem: SOLVER_SYSTEM,
  brief,
};

export const validate = (raw: Parameters<typeof validateFileTask<FrontendCheck>>[1], area: string, avoid: readonly string[], solve: Parameters<typeof validateFileTask<FrontendCheck>>[4]) => validateFileTask(kit, raw, area, avoid, solve);

/** One fresh exercise for this user's area and level, served only if its own solution passes its own checks and an independent solver agrees. */
export const generateAiFrontend = (ctx: GenerationContext, deps: Deps = realDeps, previousProblem?: string): Promise<FrontendDraft> => generateFileTask(kit, ctx, deps, previousProblem);
