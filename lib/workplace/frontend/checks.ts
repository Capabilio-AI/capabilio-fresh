import { z } from "zod";
import postcss, { type AnyNode, type AtRule, type Rule } from "postcss";
import { parseHTML } from "linkedom";
import type { CheckResult, ConfigFile } from "../file-tasks/types";

const PATTERN = z
  .string()
  .min(1)
  .max(120)
  // nested quantifiers and backreferences can make a regex run for ages on hostile input
  .refine((p) => !/\([^)]*[+*][^)]*\)[+*{]/.test(p) && !/\\[1-9]/.test(p), "pattern is not allowed")
  .refine((p) => {
    try {
      new RegExp(p, "i");
      return true;
    } catch {
      return false;
    }
  }, "not a valid pattern");

const label = z.string().min(6).max(140);
const file = z.string().min(1).max(60);
const SELECTOR = z.string().min(1).max(120).regex(/^[\w\s.#:>+~*,()[\]="'^$|\-/@]+$/, "selector has unusual characters");

/** What a frontend ticket requires of the files. Declarative on purpose: the AI describes the checks, safe code runs them, nothing the learner or the AI wrote is executed. */
export const FrontendCheckSchema = z.discriminatedUnion("kind", [
  /** elements of an HTML file, found with a CSS selector */
  z.object({ kind: z.literal("html"), label, file, selector: SELECTOR, op: z.enum(["exists", "not_exists", "count_gte", "count_equals", "text_contains", "text_matches", "attr_equals", "attr_matches", "attr_exists", "attr_missing"]), attr: z.string().regex(/^[a-z][a-z0-9-]{0,30}$/).optional(), value: z.union([z.string().max(120), z.number()]).optional() }),
  /** a declaration inside a rule of a CSS file, optionally only inside an @media block */
  z.object({ kind: z.literal("css"), label, file, selector: SELECTOR.optional(), media: PATTERN.optional(), property: z.string().regex(/^(--)?[a-z][a-z0-9-]{0,40}$/), op: z.enum(["exists", "not_exists", "equals", "matches"]), value: z.string().max(120).optional() }),
  /** an at-rule such as @media (min-width: ...) or @keyframes */
  z.object({ kind: z.literal("css_at"), label, file, name: z.enum(["media", "supports", "keyframes", "font-face", "import"]), pattern: PATTERN.optional(), op: z.enum(["exists", "not_exists"]).optional() }),
  /** a pattern in the raw text of any file (JavaScript, for example) */
  z.object({ kind: z.literal("regex"), label, file, pattern: PATTERN, op: z.enum(["matches", "not_matches"]) }),
]);
export type FrontendCheck = z.infer<typeof FrontendCheckSchema>;

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();
const re = (p: string) => new RegExp(p, "i");

function htmlCheck(c: Extract<FrontendCheck, { kind: "html" }>, content: string): boolean {
  const { document } = parseHTML(content);
  const found = [...document.querySelectorAll(c.selector)] as Element[];
  const want = c.value;
  const attr = (e: Element) => (c.attr ? e.getAttribute(c.attr) : null);
  switch (c.op) {
    case "exists": return found.length > 0;
    case "not_exists": return found.length === 0;
    case "count_gte": return found.length >= Number(want);
    case "count_equals": return found.length === Number(want);
    case "text_contains": return found.some((e) => collapse(e.textContent ?? "").toLowerCase().includes(String(want).toLowerCase()));
    case "text_matches": return found.some((e) => re(String(want)).test(collapse(e.textContent ?? "")));
    case "attr_exists": return found.length > 0 && found.every((e) => attr(e) !== null);
    case "attr_missing": return found.length > 0 && found.some((e) => attr(e) === null);
    case "attr_equals": return found.some((e) => attr(e) === String(want));
    case "attr_matches": return found.some((e) => attr(e) !== null && re(String(want)).test(attr(e)!));
  }
}

/** Selectors written differently (spacing around combinators, a comma list) still compare equal. */
const normSelector = (s: string) => collapse(s).replace(/\s*([>+~])\s*/g, "$1");

function inMedia(rule: Rule, pattern: string): boolean {
  for (let node: AnyNode | undefined = rule.parent; node; node = node.parent as AnyNode | undefined) {
    if (node.type === "atrule" && (node as AtRule).name === "media" && re(pattern).test(collapse((node as AtRule).params))) return true;
  }
  return false;
}

function cssRules(content: string, selector?: string, media?: string): Rule[] {
  const rules: Rule[] = [];
  postcss.parse(content).walkRules((rule) => {
    if (selector && !rule.selectors.some((s) => normSelector(s) === normSelector(selector))) return;
    if (media && !inMedia(rule, media)) return;
    rules.push(rule);
  });
  return rules;
}

function cssCheck(c: Extract<FrontendCheck, { kind: "css" }>, content: string): boolean {
  const values: string[] = [];
  for (const rule of cssRules(content, c.selector, c.media)) rule.walkDecls((d) => { if (d.prop.toLowerCase() === c.property.toLowerCase()) values.push(collapse(d.value).toLowerCase()); });
  const want = collapse(c.value ?? "").toLowerCase();
  switch (c.op) {
    case "exists": return values.length > 0;
    case "not_exists": return values.length === 0;
    case "equals": return values.includes(want);
    case "matches": return values.some((v) => re(c.value ?? "").test(v));
  }
}

function cssAtCheck(c: Extract<FrontendCheck, { kind: "css_at" }>, content: string): boolean {
  let hit = false;
  postcss.parse(content).walkAtRules(c.name, (rule) => {
    if (!c.pattern || re(c.pattern).test(collapse(rule.params))) hit = true;
  });
  return c.op === "not_exists" ? !hit : hit;
}

export function runFrontendChecks(files: readonly ConfigFile[], checks: readonly FrontendCheck[]): CheckResult[] {
  return checks.map((c) => {
    const f = files.find((x) => x.name === c.file);
    if (!f) return { label: c.label, passed: false };
    try {
      const passed = c.kind === "html" ? htmlCheck(c, f.content) : c.kind === "css" ? cssCheck(c, f.content) : c.kind === "css_at" ? cssAtCheck(c, f.content) : (c.op === "matches") === re(c.pattern).test(f.content);
      return { label: c.label, passed };
    } catch {
      return { label: c.label, passed: false };
    }
  });
}

/** A problem when the check cannot apply to a file of this language, else null. */
export function frontendFit(c: FrontendCheck, language: string): string | null {
  if (c.kind === "html" && language !== "html") return `an html check was used on a ${language} file`;
  if ((c.kind === "css" || c.kind === "css_at") && language !== "css") return `a ${c.kind} check was used on a ${language} file`;
  return null;
}

/** A problem when the content is not usable for its language, else null. */
export function frontendParses(language: string, content: string): string | null {
  try {
    if (language === "css") postcss.parse(content);
    if (language === "html" && !/<[a-z][\s\S]*>/i.test(content)) return "does not look like HTML";
    return null;
  } catch (e) {
    return `does not parse: ${(e as Error).message.slice(0, 80)}`;
  }
}
