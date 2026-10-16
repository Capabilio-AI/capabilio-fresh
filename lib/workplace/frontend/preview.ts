import type { ConfigFile } from "../file-tasks/types";

const escapeEnd = (code: string, tag: "script" | "style") => code.replace(new RegExp(`</${tag}`, "gi"), `<\\/${tag}`);

/**
 * The page as one document, so it can be shown in a sandboxed iframe: linked stylesheets and scripts that are among the files are inlined, and
 * anything else is left alone. It is only a preview for the learner; grading never looks at what the browser makes of it.
 */
export function buildPreviewDoc(files: readonly ConfigFile[], entry?: string): string {
  const page = files.find((f) => f.name === entry) ?? files.find((f) => /\.html?$/i.test(f.name));
  if (!page) return "";
  const byName = new Map(files.map((f) => [f.name.split("/").pop() ?? f.name, f.content]));
  const base = (href: string) => href.split(/[?#]/)[0].split("/").pop() ?? href;
  return page.content
    .replace(/<link\b[^>]*>/gi, (tag) => {
      const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
      return href && /rel\s*=\s*["']stylesheet["']/i.test(tag) && byName.has(base(href)) ? `<style>${escapeEnd(byName.get(base(href))!, "style")}</style>` : tag;
    })
    .replace(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, _a, src) => (byName.has(base(src)) ? `<script>${escapeEnd(byName.get(base(src))!, "script")}</script>` : tag));
}
