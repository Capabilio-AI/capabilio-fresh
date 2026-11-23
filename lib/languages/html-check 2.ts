import { parseHTML } from "linkedom";
import postcss from "postcss";
import { parse as parseJs } from "acorn";

/** One CSS rule as the checker sees it: a selector, where it sits (inside a media query or not), and its declarations in order. */
interface Rule { selector: string; media: string | null; order: number; decls: [string, string][] }

export interface PageDoc {
  source: string;
  hasDoctype: boolean;
  /** why the page could not be read at all, if it could not */
  parseError: string | null;
  all(selector: string): Element[];
  one(selector: string): Element | null;
  /** an element's text with runs of spaces collapsed */
  text(el: Element | null): string;
  /** the value the cascade gives `prop` on the first element matching `selector`, as written (so var(--x) stays var(--x)); null when no rule or inline style sets it */
  style(selector: string, prop: string, opts?: { media?: RegExp }): string | null;
  /** the same, with any var(--name) replaced by the custom property defined on :root or html */
  styleResolved(selector: string, prop: string, opts?: { media?: RegExp }): string | null;
  /** the value of the first of several properties that is set (for example padding, then padding-top) */
  styleAny(selector: string, props: string[], opts?: { media?: RegExp }): string | null;
  /** a custom property defined on :root or html, such as --brand */
  customProp(name: string): string | null;
  /** what the page's inline scripts do, read from their syntax tree; the code is never run */
  js: ScriptFacts;
}

/** A call such as document.querySelector("#a"): the callee as written (a.b.c), and the arguments that are plain strings. */
export interface CallFact { callee: string; strings: string[]; firstString: string | null }
/** The facts about a script a requirement may ask for. Reading is by syntax only, so a student's code is never executed on the server. */
export interface ScriptFacts {
  /** why the scripts could not be read (a syntax error), or null */
  error: string | null;
  calls: CallFact[];
  /** calls whose callee ends in .name, such as callsTo("addEventListener") */
  callsTo(name: string): CallFact[];
  /** targets of assignments, such as "list.textContent" or "input.value", with whether the assigned value is the empty string */
  assigns: { target: string; empty: boolean }[];
  /** the calls made inside any try block, as callees */
  callsInTry: string[];
  /** true when an assignment to `.name` exists (textContent, innerHTML ...) with a non-empty value */
  assignsTo(name: string): number;
}

type AnyNode = { type: string; [k: string]: unknown };
const isNode = (v: unknown): v is AnyNode => typeof v === "object" && v !== null && typeof (v as AnyNode).type === "string";

function chain(n: unknown): string {
  if (!isNode(n)) return "";
  if (n.type === "Identifier") return String(n.name);
  if (n.type === "ThisExpression") return "this";
  if (n.type === "MemberExpression") return `${chain(n.object)}.${n.computed ? "[]" : chain(n.property)}`;
  if (n.type === "CallExpression") return `${chain(n.callee)}()`;
  return "";
}

/** Reads inline script text into the facts above; a syntax error is reported, not thrown. */
export function readScripts(code: string): ScriptFacts {
  const calls: CallFact[] = [];
  const assigns: { target: string; empty: boolean }[] = [];
  const callsInTry: string[] = [];
  let error: string | null = null;
  const walk = (node: unknown, inTry: boolean): void => {
    if (Array.isArray(node)) { for (const n of node) walk(n, inTry); return; }
    if (!isNode(node)) return;
    let nextInTry = inTry;
    if (node.type === "TryStatement") { walk(node.block, true); walk(node.handler, inTry); walk(node.finalizer, inTry); return; }
    if (node.type === "CallExpression") {
      const callee = chain(node.callee);
      const args = (node.arguments as unknown[]) ?? [];
      const strings = args.filter((a): a is AnyNode & { value: string } => isNode(a) && a.type === "Literal" && typeof a.value === "string").map((a) => a.value);
      const first = args[0];
      calls.push({ callee, strings, firstString: isNode(first) && first.type === "Literal" && typeof first.value === "string" ? first.value : null });
      if (inTry) callsInTry.push(callee);
    }
    if (node.type === "AssignmentExpression" && node.operator === "=") {
      const right = node.right;
      assigns.push({ target: chain(node.left), empty: isNode(right) && right.type === "Literal" && right.value === "" });
    }
    for (const [k, v] of Object.entries(node)) if (k !== "type" && typeof v === "object") walk(v, nextInTry);
  };
  try {
    walk(parseJs(code, { ecmaVersion: "latest", sourceType: "script", allowReturnOutsideFunction: true }), false);
  } catch (e) { error = (e as Error).message; }
  return {
    error, calls, assigns, callsInTry,
    callsTo: (name) => calls.filter((c) => c.callee === name || c.callee.endsWith(`.${name}`)),
    assignsTo: (name) => assigns.filter((a) => a.target.endsWith(`.${name}`) && !a.empty).length,
  };
}

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/** Pure. Specificity as one comparable number: ids, then classes/attributes/pseudo-classes, then element names. */
export function specificity(selector: string): number {
  const ids = (selector.match(/#[\w-]+/g) ?? []).length;
  const classes = (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length;
  const types = (selector.replace(/\[[^\]]*\]|[.#:][\w-]+(\([^)]*\))?/g, " ").match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) ?? []).length;
  return ids * 10000 + classes * 100 + types;
}

function readRules(css: string): Rule[] {
  const rules: Rule[] = [];
  let order = 0;
  const root = postcss.parse(css);
  root.walkRules((rule) => {
    let media: string | null = null;
    for (let p = rule.parent; p && p.type !== "root"; p = p.parent) if (p.type === "atrule" && (p as postcss.AtRule).name === "media") media = (p as postcss.AtRule).params;
    const decls: [string, string][] = [];
    rule.walkDecls((d) => { decls.push([d.prop.toLowerCase(), d.value.trim()]); });
    for (const selector of rule.selectors) rules.push({ selector: selector.trim(), media, order: order++, decls });
  });
  return rules;
}

const matches = (el: Element, selector: string): boolean => { try { return el.matches(selector); } catch { return false; } };

/** Parses a student's page once, so every requirement of a problem reads the same document. Never throws: a page that cannot be read says so. */
export function readPage(source: string): PageDoc {
  let parseError: string | null = null;
  let document: Document;
  try { document = parseHTML(source).document as unknown as Document; } catch (e) { parseError = (e as Error).message; document = parseHTML("<html></html>").document as unknown as Document; }
  let rules: Rule[] = [];
  try {
    const css = [...document.querySelectorAll("style")].map((s) => s.textContent ?? "").join("\n");
    rules = readRules(css);
  } catch (e) { parseError = parseError ?? `CSS could not be read: ${(e as Error).message.split("\n")[0]}`; }

  const all = (sel: string): Element[] => { try { return [...document.querySelectorAll(sel)]; } catch { return []; } };
  const one = (sel: string): Element | null => all(sel)[0] ?? null;
  const customProp = (name: string): string | null => {
    let found: string | null = null;
    for (const r of rules) if (r.media === null && (r.selector === ":root" || r.selector === "html")) for (const [p, v] of r.decls) if (p === name) found = v;
    return found;
  };
  const style = (selector: string, prop: string, opts: { media?: RegExp } = {}): string | null => {
    const el = one(selector);
    if (!el) return null;
    const inMedia = (r: Rule) => (opts.media ? r.media !== null && opts.media.test(r.media) : r.media === null);
    const found = rules.filter((r) => inMedia(r) && matches(el, r.selector) && r.decls.some(([p]) => p === prop)).sort((a, b) => specificity(a.selector) - specificity(b.selector) || a.order - b.order).at(-1);
    let value = found ? ([...found.decls].reverse().find(([p]) => p === prop)?.[1] ?? null) : null;
    if (!opts.media) {
      const inline = el.getAttribute("style");
      if (inline) { try { postcss.parse(`x{${inline}}`).walkDecls((d) => { if (d.prop.toLowerCase() === prop) value = d.value.trim(); }); } catch { /* an unreadable inline style sets nothing */ } }
    }
    return value;
  };
  const resolve = (v: string | null): string | null => (v === null ? null : v.replace(/var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/g, (_, n: string) => customProp(n) ?? "var(unresolved)"));
  // a page nested deeper than the parser can walk throws a RangeError: treat that as "no script found" instead of failing the request
  let scriptText = "";
  try { scriptText = [...document.querySelectorAll("script")].filter((el) => !el.getAttribute("src")).map((el) => el.textContent ?? "").join("\n"); } catch { /* no script text */ }
  return {
    js: readScripts(scriptText), source, parseError, hasDoctype: /^\s*<!doctype\s+html/i.test(source), all, one, text: (el) => (el ? collapse(el.textContent ?? "") : ""),
    style, styleResolved: (s, p, o) => resolve(style(s, p, o)), styleAny: (s, ps, o) => { for (const p of ps) { const v = style(s, p, o); if (v !== null) return v; } return null; }, customProp,
  } as PageDoc;
}

/** Pure. Whether a CSS length is greater than zero (0, 0px and none do not count). */
export const isNonZeroLength = (v: string | null): boolean => v !== null && /\d/.test(v) && !/^(0(px|em|rem|%)?\s*)+$/.test(v.trim()) && v.trim() !== "none";
