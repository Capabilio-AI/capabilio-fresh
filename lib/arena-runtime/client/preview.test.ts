import { describe, expect, it } from "vitest";
import { assertionsFrom, buildPreviewDocument } from "./preview";
import { buildSubmission, isLiveCheck, type ViewCheck } from "./builders";

const check = (over: Partial<ViewCheck>): ViewCheck => ({ id: "c1", stepId: null, type: "DOM_ASSERTION", visible: true, label: "l", public: null, ...over });

describe("assertionsFrom", () => {
  it("reads published DOM assertions and ignores other checks", () => {
    const checks = [check({ public: { assert: { selector: "h1", textIncludes: "Hi" } } }), check({ id: "c2", type: "NUMERIC_ANSWER", public: { assert: { selector: "x" } } }), check({ id: "c3", public: null })];
    expect(assertionsFrom(checks)).toEqual([{ id: "c1", selector: "h1", minCount: undefined, textIncludes: "Hi", attr: undefined }]);
    expect(isLiveCheck(checks[0])).toBe(true);
    expect(isLiveCheck(checks[2])).toBe(false);
  });
});

describe("buildPreviewDocument", () => {
  it("inlines linked css and js and appends the runner before </body>", () => {
    const doc = buildPreviewDocument(
      { "index.html": '<html><head><link rel="stylesheet" href="s.css"></head><body><h1>x</h1><script src="a.js"></script></body></html>', "s.css": "h1{color:red}", "a.js": "var a=1;" },
      [{ id: "c1", selector: "h1" }]
    );
    expect(doc).toContain("<style>h1{color:red}</style>");
    expect(doc).toContain("<script>var a=1;</script>");
    expect(doc.indexOf("arena-preview")).toBeLessThan(doc.indexOf("</body>"));
    expect(doc).not.toContain('href="s.css"');
  });
  it("leaves references to files it does not have alone, and cannot be broken out of by </script> in a file", () => {
    const doc = buildPreviewDocument({ "index.html": '<body><script src="https://cdn.example/x.js"></script><script src="a.js"></script></body>', "a.js": 'document.write("</script><b>")' }, []);
    expect(doc).toContain('src="https://cdn.example/x.js"');
    expect(doc).toContain("<\\/script><b>");
  });
  it("embeds assertions without allowing markup injection", () => {
    expect(buildPreviewDocument({ "index.html": "<body></body>" }, [{ id: "c1", selector: "a</script><script>alert(1)" }])).not.toContain("</script><script>alert(1)");
  });
  it("denies network egress with a CSP that comes first in the head", () => {
    const doc = buildPreviewDocument({ "index.html": "<!doctype html><html><head><title>t</title></head><body></body></html>" }, []);
    expect(doc).toContain(`default-src 'none'`);
    expect(doc.indexOf("Content-Security-Policy")).toBeLessThan(doc.indexOf("<title>"));
    expect(doc.startsWith("<!doctype html>")).toBe(true); // doctype kept first, so no quirks mode
    expect(buildPreviewDocument({ "index.html": "<p>no head</p>" }, [])).toContain("Content-Security-Policy");
  });
  it("renders a placeholder when there is no index.html", () => expect(buildPreviewDocument({}, [])).toContain("Add an index.html"));
});

describe("buildSubmission", () => {
  const checks = [check({ id: "q1", type: "CHOICE_ANSWER" }), check({ id: "n1", type: "NUMERIC_ANSWER" }), check({ id: "s1", type: "QUERY_RESULT" }), check({ id: "d1" }), check({ id: "f1", type: "FILE_STATE" })];
  it("sends only answers for real checks and drops scratch work", () => {
    expect(buildSubmission("CALCULATION_WORKSHEET", { answers: { n1: "5", bogus: "9" }, working: "secret notes" }, checks)).toEqual({ answers: { n1: "5" } });
    expect(buildSubmission("QUESTION_FLOW", { answers: { q1: ["a"] } }, checks)).toEqual({ answers: { q1: ["a"] } });
  });
  it("builds SQL and code submissions", () => {
    expect(buildSubmission("SQL_CONSOLE", { queries: { s1: "select 1", other: "x" } }, checks)).toEqual({ queries: { s1: "select 1" } });
    expect(buildSubmission("CODE_EDITOR_PREVIEW", { files: { "index.html": "x" }, results: { d1: true, f1: true } }, checks)).toEqual({ files: { "index.html": "x" }, reported: { d1: true } });
  });
  it("tolerates a missing or malformed draft", () => {
    expect(buildSubmission("SQL_CONSOLE", null, checks)).toEqual({ queries: {} });
    expect(buildSubmission("CODE_EDITOR_PREVIEW", "nonsense", checks)).toEqual({ files: {}, reported: {} });
  });
});
