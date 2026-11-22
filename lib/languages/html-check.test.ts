import { describe, expect, it } from "vitest";
import { isNonZeroLength, readPage, specificity } from "./html-check";

describe("specificity", () => {
  it("orders ids above classes above elements", () => {
    expect(specificity("#a")).toBeGreaterThan(specificity(".a.b.c"));
    expect(specificity(".a")).toBeGreaterThan(specificity("div p span"));
    expect(specificity("p.warn")).toBeGreaterThan(specificity(".warn"));
  });
});

describe("readPage", () => {
  const page = `<!doctype html><html lang="en"><head><style>
    :root { --brand: #2b6cb0; }
    p { color: green; }
    .note { color: orange; padding: 4px; }
    p.note { color: red; }
    .box { width: 10px; }
    @media (min-width: 700px) { .box { width: 20px; } }
  </style></head><body><p class="note" id="n">Hi   there</p><div class="box" style="margin: 8px"></div></body></html>`;
  const d = readPage(page);
  it("sees the doctype, elements and collapsed text", () => {
    expect(d.hasDoctype).toBe(true);
    expect(d.text(d.one("#n"))).toBe("Hi there");
    expect(d.all("p, div")).toHaveLength(2);
  });
  it("gives the cascade's winner: the more specific rule, not the later or the earlier", () => {
    expect(d.style("p.note", "color")).toBe("red");
    expect(d.style(".note", "padding")).toBe("4px");
  });
  it("keeps media queries apart and reads inline styles", () => {
    expect(d.style(".box", "width")).toBe("10px");
    expect(d.style(".box", "width", { media: /min-width:\s*700px/ })).toBe("20px");
    expect(d.style(".box", "margin")).toBe("8px");
  });
  it("resolves custom properties and reports a missing property as null", () => {
    expect(readPage("<style>:root{--c:blue} h1{color:var(--c)}</style><h1>x</h1>").styleResolved("h1", "color")).toBe("blue");
    expect(d.style(".box", "color")).toBeNull();
    expect(d.style(".nothing", "color")).toBeNull();
  });
  it("never throws on broken input", () => {
    const broken = readPage("<style>p { color: red </style><p>x");
    expect(broken.parseError).toMatch(/CSS/);
    expect(readPage("").all("p")).toEqual([]);
  });
  it("tells a real length from zero", () => {
    expect([isNonZeroLength("8px"), isNonZeroLength("0"), isNonZeroLength("0px"), isNonZeroLength(null), isNonZeroLength("1rem 0")]).toEqual([true, false, false, false, true]);
  });
});

describe("script facts (read from syntax, never run)", () => {
  const d = readPage(`<body><input id="t"><script>
    const input = document.querySelector("#t");
    const list = document.getElementById("list");
    try { const saved = JSON.parse(localStorage.getItem("k")); } catch (e) {}
    document.querySelector("#add").addEventListener("click", () => {
      const li = document.createElement("li");
      li.textContent = input.value.trim();
      list.append(li);
      input.value = "";
      localStorage.setItem("k", JSON.stringify([1]));
    });
  </script></body>`);
  it("lists calls with their string arguments", () => {
    expect(d.js.error).toBeNull();
    expect(d.js.callsTo("querySelector").map((c) => c.firstString)).toEqual(["#t", "#add"]);
    expect(d.js.callsTo("addEventListener")[0].firstString).toBe("click");
    expect(d.js.callsTo("append")).toHaveLength(1);
  });
  it("sees assignments, and whether the value is the empty string", () => {
    expect(d.js.assignsTo("textContent")).toBe(1);
    expect(d.js.assigns.find((a) => a.target === "input.value")?.empty).toBe(true);
  });
  it("sees which calls are inside a try block", () => {
    expect(d.js.callsInTry).toEqual(expect.arrayContaining(["JSON.parse", "localStorage.getItem"]));
    expect(d.js.callsInTry).not.toContain("localStorage.setItem");
  });
  it("reports a syntax error instead of throwing", () => {
    expect(readPage("<script>let = ;</script>").js.error).toMatch(/./);
  });
});
