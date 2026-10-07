import type { ViewCheck } from "./builders";

export interface DomAssertion {
  id: string;
  selector: string;
  minCount?: number;
  textIncludes?: string;
  attr?: { name: string; value: string };
}

/** Pure. Pulls the assertions authors published in `config.public.assert` (selector-based, so students can read what is being checked). */
export function assertionsFrom(checks: ViewCheck[]): DomAssertion[] {
  return checks.flatMap((c) => {
    const a = c.public?.assert as Partial<DomAssertion> | undefined;
    return c.type === "DOM_ASSERTION" && a && typeof a.selector === "string" ? [{ id: c.id, selector: a.selector, minCount: a.minCount, textIncludes: a.textIncludes, attr: a.attr }] : [];
  });
}

/** Egress denied: the preview may run inline script and style and show data: images, but cannot fetch, load remote files or open connections. */
export const PREVIEW_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:";
const CSP_META = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`;

const escapeScript = (code: string) => code.replace(/<\/script/gi, "<\\/script");

/** Runs inside the sandboxed preview and reports each assertion's result to the parent. The parent only trusts messages from its own iframe. */
const RUNNER = (assertions: DomAssertion[]) => `
window.addEventListener("load", function () {
  var assertions = ${JSON.stringify(assertions).replace(/</g, "\\u003c")};
  var results = {};
  assertions.forEach(function (a) {
    try {
      var els = Array.prototype.slice.call(document.querySelectorAll(a.selector));
      var ok = els.length >= (a.minCount || 1);
      if (ok && a.textIncludes) ok = els.some(function (e) { return (e.textContent || "").indexOf(a.textIncludes) !== -1; });
      if (ok && a.attr) ok = els.some(function (e) { return e.getAttribute(a.attr.name) === a.attr.value; });
      results[a.id] = ok;
    } catch (err) { results[a.id] = false; }
  });
  parent.postMessage({ source: "arena-preview", results: results }, "*");
});`;

/**
 * Pure. Builds the single srcdoc the preview iframe renders: the student's HTML with their CSS and JS files inlined (the iframe is sandboxed
 * without same-origin, so it cannot reach the app), plus the assertion runner.
 */
export function buildPreviewDocument(files: Record<string, string>, assertions: DomAssertion[]): string {
  let html = files["index.html"] ?? "<!doctype html><html><body><p>Add an index.html</p></body></html>";
  html = html.replace(/<link\b[^>]*href=["']([^"']+\.css)["'][^>]*>/gi, (tag, href: string) => (href in files ? `<style>${files[href].replace(/<\/style/gi, "<\\/style")}</style>` : tag));
  html = html.replace(/<script\b[^>]*src=["']([^"']+\.js)["'][^>]*>\s*<\/script>/gi, (tag, src: string) => (src in files ? `<script>${escapeScript(files[src])}</script>` : tag));
  const runner = `<script>${escapeScript(RUNNER(assertions))}</script>`;
  html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${runner}</body>`) : html + runner;
  // the policy goes first in <head> so it governs everything after it
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}${CSP_META}`);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${CSP_META}</head>`);
  return CSP_META + html;
}
