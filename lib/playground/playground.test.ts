import { describe, expect, it } from "vitest";
import { PREVIEW_SANDBOX_CSP, buildPreviewDoc, canRunInBrowser, friendlyPythonError, playgroundLanguage, pythonProgram } from "./playground";

describe("playgroundLanguage", () => {
  it("reads web languages from the topic name first", () => {
    expect(playgroundLanguage("HTML Forms")).toBe("html");
    expect(playgroundLanguage("CSS Flexbox")).toBe("css");
    expect(playgroundLanguage("Python Lists")).toBe("python");
    expect(playgroundLanguage("SQL Joins")).toBe("sql");
    expect(playgroundLanguage("C++ Pointers")).toBe("cpp");
  });
  it("reads it from the code when the name does not say", () => {
    expect(playgroundLanguage("Layout", "<div class=\"a\">hi</div>")).toBe("html");
    expect(playgroundLanguage("Basics", "SELECT name FROM students WHERE id = 1")).toBe("sql");
    expect(playgroundLanguage("Basics", "body { color: red; }")).toBe("css");
    expect(playgroundLanguage("Basics", "def f():\n    pass")).toBe("python");
  });
  it("treats JavaScript that touches the page as a page to preview", () => {
    expect(playgroundLanguage("JavaScript DOM", "document.getElementById('a').textContent = 'x'")).toBe("html");
    expect(playgroundLanguage("JavaScript Loops", "for (let i=0;i<3;i++) console.log(i)")).toBe("javascript");
  });
  it("is null for topics that are not code", () => {
    expect(playgroundLanguage("Structural Analysis")).toBeNull();
  });
});

describe("canRunInBrowser", () => {
  it("is true for the languages that need no server", () => {
    for (const l of ["python", "javascript", "html", "css"] as const) expect(canRunInBrowser(l)).toBe(true);
    for (const l of ["c", "cpp", "java", "typescript", "sql"] as const) expect(canRunInBrowser(l)).toBe(false);
  });
});

describe("buildPreviewDoc", () => {
  it("wraps CSS in a small page so it has something to style", () => {
    const doc = buildPreviewDoc("css", "h1 { color: red; }");
    expect(doc).toContain("h1 { color: red; }");
    expect(doc).toContain("<h1>");
  });
  it("keeps a full HTML page as it is, and wraps a fragment", () => {
    expect(buildPreviewDoc("html", "<!DOCTYPE html><html><body>x</body></html>")).toContain("<body>x</body>");
    expect(buildPreviewDoc("html", "<p>hello</p>")).toContain("<body><p>hello</p></body>");
  });
  it("runs page script, and shuts the network out", () => {
    const doc = buildPreviewDoc("html", "<p id=a></p><script>document.getElementById('a').textContent='hi'</script>");
    expect(doc).toContain(PREVIEW_SANDBOX_CSP);
    expect(PREVIEW_SANDBOX_CSP).toContain("default-src 'none'");
  });
  it("cannot be closed early by the student's own script tag", () => {
    expect(buildPreviewDoc("html", "<script>1</script>")).toContain("<script>1</script>");
  });
});

describe("pythonProgram", () => {
  it("runs the student's code in a fresh scope with input() reading the input box", () => {
    const p = pythonProgram("name = input()\nprint(name)", "Ada\nBob");
    expect(p).toContain("exec(compile(");
    expect(p).toContain("{'__name__': '__main__'}");
    expect(p).toContain("builtins");
    expect(p).toContain("Ada");
  });
  it("tells the student plainly when the program wants more input than was typed", () => {
    expect(pythonProgram("input()", "")).toContain("no more");
  });
  it("cannot be broken out of by quotes, backslashes, triple quotes or line breaks", () => {
    const nasty = 'print("""hi""")\nx = \'a\\\'\n# \\ "\'';
    const p = pythonProgram(nasty, 'a"b\\c\n\'d');
    // the student's code appears only inside one JSON-encoded string literal
    expect(p.split("\n").length).toBe(pythonProgram("x", "").split("\n").length);
    expect(p).toContain(JSON.stringify(JSON.stringify(nasty)));
  });
});

describe("friendlyPythonError", () => {
  it("keeps the student's own frames and drops the wrapper's", () => {
    const raw = 'PythonError: Traceback (most recent call last):\n  File "/lib/python312.zip/_pyodide/_base.py", line 574, in eval_code\n  File "<exec>", line 9, in <module>\n  File "main.py", line 2, in <module>\nNameError: name \'x\' is not defined';
    const out = friendlyPythonError(raw);
    expect(out).toContain('File "main.py", line 2');
    expect(out).toContain("NameError");
    expect(out).not.toContain("_pyodide");
  });
});
