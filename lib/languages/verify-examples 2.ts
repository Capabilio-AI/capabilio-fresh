import { Parser } from "htmlparser2";
import postcss from "postcss";
import { Script } from "node:vm";

/** Elements that never have an end tag. */
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/** Elements whose end tag HTML lets an author leave out: closing one of these implicitly is not a mistake. */
const OPTIONAL_END = new Set(["p", "li", "td", "th", "tr", "thead", "tbody", "tfoot", "option", "dt", "dd", "colgroup", "caption"]);

/**
 * Pure. What is wrong with an HTML lesson example, as plain sentences; an empty list means it passed. It is a check for the mistakes an author
 * actually makes, not a full validator: an element left open, an image with no alt text, a label pointing at nothing, a repeated id, CSS that does
 * not parse and a script with a syntax error. It does not run the page.
 */
export function checkHtmlExample(html: string): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const labelFor: string[] = [];
  let inStyle = false;
  let inScript = false;
  let text = "";

  const parser = new Parser({
    onopentag(name, attrs) {
      if (name === "style") { inStyle = true; text = ""; }
      if (name === "script" && !attrs.src) { inScript = true; text = ""; }
      if (name === "img" && attrs.alt === undefined) problems.push("an img has no alt attribute");
      if (attrs.id) {
        if (ids.has(attrs.id)) problems.push(`the id "${attrs.id}" is used twice`);
        ids.add(attrs.id);
      }
      if (name === "label" && attrs.for) labelFor.push(attrs.for);
      if (attrs.style) {
        try { postcss.parse(`x{${attrs.style}}`); } catch (e) { problems.push(`inline style does not parse: ${(e as Error).message.split("\n")[0]}`); }
      }
    },
    ontext(t) { if (inStyle || inScript) text += t; },
    onclosetag(name, implied) {
      if (implied && !VOID.has(name) && !OPTIONAL_END.has(name)) problems.push(`<${name}> is never closed`);
      if (name === "style" && inStyle) {
        inStyle = false;
        try { postcss.parse(text); } catch (e) { problems.push(`CSS does not parse: ${(e as Error).message.split("\n")[0]}`); }
      }
      if (name === "script" && inScript) {
        inScript = false;
        try { new Script(text); } catch (e) { problems.push(`script has a syntax error: ${(e as Error).message}`); }
      }
    },
  }, { lowerCaseTags: true });
  parser.write(html);
  parser.end();

  for (const f of labelFor) if (!ids.has(f)) problems.push(`a label points at the id "${f}", which does not exist`);
  return problems;
}
