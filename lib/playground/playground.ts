import { runnableLanguage, type RunnableLanguage } from "@/lib/practice/practice";

/** What a lesson's code can be shown in: the languages the server runner runs, the web languages, and SQL (shown as an example). */
export type PlaygroundLanguage = RunnableLanguage | "html" | "css" | "sql";

const DOM_USE = /\bdocument\.|\bwindow\.|<script|addEventListener\(/;

/**
 * Pure. The language of a lesson's code: the topic name first, then the shape of the code. JavaScript that works on the page is returned as
 * "html", since it needs a page to run in. Null when it is not code we can show.
 */
export function playgroundLanguage(topicTitle: string, code?: string | null): PlaygroundLanguage | null {
  if (/\bhtml\b/i.test(topicTitle)) return "html";
  if (/\bcss\b/i.test(topicTitle)) return "css";
  if (/\bsql\b/i.test(topicTitle) && !/\bnosql\b/i.test(topicTitle)) return "sql";
  const named = runnableLanguage(topicTitle);
  if (named) return named === "javascript" && code && DOM_USE.test(code) ? "html" : named;
  if (!code) return null;
  if (/^\s*select\b[\s\S]*\bfrom\b|^\s*(insert into|update|create table|delete from)\b/im.test(code)) return "sql";
  if (/<!doctype html|<\s*(html|body|div|p|h[1-6]|ul|ol|form|table|button|span|a|img)\b/i.test(code)) return "html";
  if (/(^|\})\s*[.#]?[a-z][\w-]*(\s*[,>+~ ]\s*[.#]?[a-z][\w-]*)*\s*\{[^{}]*:[^{}]*;?[^{}]*\}/i.test(code) && !/[;)]\s*$/.test(code.split("\n")[0])) return "css";
  const shaped = runnableLanguage("", code);
  return shaped === "javascript" && DOM_USE.test(code) ? "html" : shaped;
}

/** Languages that run in the student's own browser, so they are instant and never depend on a shared server. */
export const canRunInBrowser = (l: PlaygroundLanguage): boolean => l === "python" || l === "javascript" || l === "html" || l === "css";

/** The preview page may run its own script and style, and cannot fetch, load remote files or open connections. */
export const PREVIEW_SANDBOX_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:";
const META = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_SANDBOX_CSP}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`;
const BASE_STYLE = "<style>body{font-family:system-ui,sans-serif;margin:12px;line-height:1.5;color:#111}</style>";

/** Pure. The page shown for HTML and CSS examples. CSS gets a little page to style; HTML fragments get a body; a full page is kept. */
export function buildPreviewDoc(language: "html" | "css", code: string): string {
  if (language === "css") {
    return `<!doctype html><html><head>${META}${BASE_STYLE}<style>${code}</style></head><body><h1>Heading</h1><p>A paragraph of text with a <a href="#">link</a>.</p><ul><li>One</li><li>Two</li></ul><button>Button</button></body></html>`;
  }
  if (/<!doctype html|<html[\s>]/i.test(code)) {
    return /<head[\s>]/i.test(code) ? code.replace(/<head([^>]*)>/i, `<head$1>${META}`) : code.replace(/<html([^>]*)>/i, `<html$1><head>${META}</head>`);
  }
  return `<!doctype html><html><head>${META}${BASE_STYLE}</head><body>${code}</body></html>`;
}

/**
 * Pure. The program Python runs for a student's code: input() reads the lines from the input box (and says so plainly when they run out),
 * and the code runs in a fresh scope, so nothing from the previous Run is still defined. Code and lines are embedded as JSON inside a string
 * literal, so no quote, backslash or line break in them can break out of it.
 */
export function pythonProgram(code: string, stdin: string): string {
  const lines = JSON.stringify(JSON.stringify(stdin.replace(/\r\n/g, "\n").split("\n").filter((_, i, all) => !(i === all.length - 1 && all[i] === ""))));
  return [
    "import builtins as _b, json as _j",
    `_lines = iter(_j.loads(${lines}))`,
    "def _input(prompt=''):",
    "    try:",
    "        return next(_lines)",
    "    except StopIteration:",
    "        raise EOFError('This program asks for input but there is no more. Type the input in the box under the editor, one line per input().')",
    "_b.input = _input",
    `exec(compile(_j.loads(${JSON.stringify(JSON.stringify(code))}), 'main.py', 'exec'), {'__name__': '__main__'})`,
  ].join("\n");
}

/** Pure. A Python error trimmed to the student's own code: everything from the first line of main.py, without the wrapper's frames. */
export function friendlyPythonError(message: string): string {
  const at = message.indexOf('File "main.py"');
  const tail = (at >= 0 ? message.slice(at) : message).trim();
  return tail.split("\n").filter((l) => !/\/lib\/python|<exec>|pyodide/i.test(l)).join("\n").slice(0, 1500);
}
