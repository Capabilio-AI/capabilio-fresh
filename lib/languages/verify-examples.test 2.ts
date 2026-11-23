import { describe, expect, it } from "vitest";
import { checkHtmlExample } from "./verify-examples";

describe("checkHtmlExample", () => {
  it("passes a clean page", () => {
    const page = '<style>p{color:red}</style><label for="n">Name</label><input id="n"><p>one<p>two<img src="a.png" alt="A"><script>const x = 1;</script>';
    expect(checkHtmlExample(page)).toEqual([]);
  });
  it("finds an element left open", () => {
    expect(checkHtmlExample("<div><span>hi</div>")).toContain("<span> is never closed");
  });
  it("finds an image without alt, a repeated id and a label with no target", () => {
    const found = checkHtmlExample('<img src="a.png"><p id="a"></p><p id="a"></p><label for="zzz">x</label>');
    expect(found).toEqual(expect.arrayContaining(["an img has no alt attribute", 'the id "a" is used twice', 'a label points at the id "zzz", which does not exist']));
  });
  it("finds CSS that does not parse and a script with a syntax error", () => {
    expect(checkHtmlExample("<style>p { color: red </style>").some((p) => p.startsWith("CSS does not parse"))).toBe(true);
    expect(checkHtmlExample("<script>let = ;</script>").some((p) => p.startsWith("script has a syntax error"))).toBe(true);
  });
});
