import { describe, expect, it } from "vitest";
import { frontendFit, frontendParses, runFrontendChecks, type FrontendCheck } from "./checks";

const html = `<!doctype html><html lang="en"><head><title>Shop</title></head><body>
<header><nav aria-label="Main"><a href="/">Home</a><a href="/cart">Cart</a></nav></header>
<main><h1>Welcome   to  the shop</h1><img src="a.png" alt="A red shoe"><img src="b.png">
<form><label for="email">Email</label><input id="email" type="email" required></form></main></body></html>`;
const css = `:root { --brand: #e4572e; }
.card, .box { display: flex; gap: 8px; }
.nav > a { color: var(--brand); }
@media (min-width: 768px) { .card { flex-direction: row; } }
@keyframes pulse { from { opacity: 0.5 } to { opacity: 1 } }`;
const files = [{ name: "index.html", content: html }, { name: "style.css", content: css }, { name: "app.js", content: "document.querySelector('form').addEventListener('submit', (e) => e.preventDefault());" }];

describe("frontend checks", () => {
  it("checks HTML structure, text and attributes with selectors", () => {
    const checks: FrontendCheck[] = [
      { kind: "html", label: "has a main landmark", file: "index.html", selector: "main", op: "exists" },
      { kind: "html", label: "page has one h1 saying welcome", file: "index.html", selector: "h1", op: "text_contains", value: "welcome to the shop" },
      { kind: "html", label: "every image has alt", file: "index.html", selector: "img", op: "attr_exists", attr: "alt" },
      { kind: "html", label: "some image lacks alt", file: "index.html", selector: "img", op: "attr_missing", attr: "alt" },
      { kind: "html", label: "no images without alt", file: "index.html", selector: "img:not([alt])", op: "not_exists" },
      { kind: "html", label: "nav has two links", file: "index.html", selector: "nav a", op: "count_equals", value: 2 },
      { kind: "html", label: "label is tied to the input", file: "index.html", selector: "label[for=email]", op: "exists" },
      { kind: "html", label: "html declares a language", file: "index.html", selector: "html", op: "attr_matches", attr: "lang", value: "^en" },
      { kind: "html", label: "email input is required", file: "index.html", selector: "input[type=email]", op: "attr_exists", attr: "required" },
      { kind: "html", label: "a selector that is not valid", file: "index.html", selector: "div[[", op: "exists" },
    ];
    expect(runFrontendChecks(files, checks).map((r) => r.passed)).toEqual([true, true, false, true, false, true, true, true, true, false]);
  });

  it("checks CSS declarations, selector lists, media blocks and at-rules", () => {
    const checks: FrontendCheck[] = [
      { kind: "css", label: "card is a flex container", file: "style.css", selector: ".card", property: "display", op: "equals", value: "flex" },
      { kind: "css", label: "box is in the same rule as card", file: "style.css", selector: ".box", property: "gap", op: "exists" },
      { kind: "css", label: "links in nav use the brand colour", file: "style.css", selector: ".nav > a", property: "color", op: "matches", value: "var\\(--brand\\)" },
      { kind: "css", label: "nav selector with other spacing", file: "style.css", selector: ".nav>a", property: "color", op: "exists" },
      { kind: "css", label: "card changes direction on wide screens", file: "style.css", selector: ".card", media: "min-width:\\s*768px", property: "flex-direction", op: "equals", value: "row" },
      { kind: "css", label: "a custom property is defined", file: "style.css", selector: ":root", property: "--brand", op: "exists" },
      { kind: "css", label: "no float is used", file: "style.css", property: "float", op: "not_exists" },
      { kind: "css_at", label: "has a media query for tablets", file: "style.css", name: "media", pattern: "min-width" },
      { kind: "css_at", label: "has keyframes", file: "style.css", name: "keyframes", pattern: "^pulse$" },
      { kind: "css_at", label: "no imports are used", file: "style.css", name: "import", op: "not_exists" },
      { kind: "css", label: "grid is not used on card", file: "style.css", selector: ".card", property: "display", op: "equals", value: "grid" },
    ];
    expect(runFrontendChecks(files, checks).map((r) => r.passed)).toEqual([true, true, true, true, true, true, true, true, true, true, false]);
  });

  it("checks script text with a pattern, and fails safely on a missing or broken file", () => {
    expect(runFrontendChecks(files, [{ kind: "regex", label: "form submit is handled in script", file: "app.js", pattern: "addEventListener\\(['\"]submit", op: "matches" }])[0].passed).toBe(true);
    expect(runFrontendChecks(files, [{ kind: "css", label: "a rule in a file that is missing", file: "other.css", property: "color", op: "exists" }])[0].passed).toBe(false);
    expect(runFrontendChecks([{ name: "s.css", content: "a { color: " }, ...files], [{ kind: "css", label: "unfinished css never crashes", file: "s.css", property: "color", op: "exists" }]).length).toBe(1);
  });

  it("knows which checks fit which files and which content parses", () => {
    expect(frontendFit({ kind: "css_at", label: "x".repeat(8), file: "a", name: "media" }, "html")).toMatch(/css_at check was used/);
    expect(frontendFit({ kind: "html", label: "x".repeat(8), file: "a", selector: "p", op: "exists" }, "html")).toBeNull();
    expect(frontendParses("css", "a { color: ")).toMatch(/does not parse/);
    expect(frontendParses("html", "just words")).toMatch(/HTML/);
  });
});
