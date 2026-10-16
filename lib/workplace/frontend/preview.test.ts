import { describe, expect, it } from "vitest";
import { buildPreviewDoc } from "./preview";

describe("buildPreviewDoc", () => {
  const files = [
    { name: "index.html", content: '<html><head><link rel="stylesheet" href="style.css"><link rel="icon" href="x.ico"></head><body><p>Hi</p><script src="./app.js"></script><script src="https://cdn.example/x.js"></script></body></html>' },
    { name: "style.css", content: "p { color: red; } /* </style> */" },
    { name: "app.js", content: "document.title = '</script>';" },
  ];
  it("inlines the stylesheet and script that are among the files and leaves other links alone", () => {
    const doc = buildPreviewDoc(files);
    expect(doc).toContain("<style>p { color: red;");
    expect(doc).toContain("<script>document.title");
    expect(doc).toContain('<link rel="icon" href="x.ico">');
    expect(doc).toContain('<script src="https://cdn.example/x.js"></script>');
  });
  it("cannot be broken out of by a closing tag inside a file", () => {
    const doc = buildPreviewDoc(files);
    expect(doc).not.toMatch(/<\/style>[^<]*\*\//);
    expect(doc).toContain("<\\/script>");
  });
  it("returns nothing when there is no page", () => {
    expect(buildPreviewDoc([{ name: "a.css", content: "" }])).toBe("");
  });
});
