import type { HtmlChallenge } from "../types";
import { isNonZeroLength, type PageDoc } from "../html-check";

const lc = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
/** the input a label with this text points at (by for/id), or null */
const labelled = (d: PageDoc, words: string): Element | null => {
  const label = d.all("label").find((l) => lc(d.text(l)).includes(words));
  const id = label?.getAttribute("for");
  return id ? d.all("input, select, textarea").find((e) => e.getAttribute("id") === id) ?? null : null;
};
const num = (v: string | null | undefined) => (v === null || v === undefined ? NaN : Number.parseFloat(v));

// ---------------------------------------------------------------------------------------------------------------------------------
const PROFILE_REF = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Asha Rao | Portfolio</title>
</head>
<body>
  <h1>Asha Rao</h1>
  <img src="asha.jpg" alt="Photo of Asha" width="120" height="120">
  <h2>Skills</h2>
  <ul>
    <li>HTML</li>
    <li>CSS</li>
    <li>JavaScript</li>
  </ul>
  <h2>Projects</h2>
  <table>
    <thead><tr><th>Project</th><th>Year</th></tr></thead>
    <tbody>
      <tr><td>Weather app</td><td>2025</td></tr>
      <tr><td>Quiz game</td><td>2026</td></tr>
    </tbody>
  </table>
  <p>Find the code on <a href="https://github.com/asha-rao">GitHub</a>.</p>
</body>
</html>
`;

const profile: HtmlChallenge = {
  kind: "html",
  title: "A portfolio page",
  statement: "Build a one-page portfolio for a student called Asha Rao. Use the right element for each part of the page, and make the page meet every requirement in the list. Press Check my page to see which requirements you meet.",
  starter: "<!-- Write the whole page below, starting with the doctype. -->\n",
  reference: PROFILE_REF,
  requirements: [
    { text: "The page starts with <!doctype html>.", test: (d) => d.hasDoctype },
    { text: "The <html> element has a lang attribute.", test: (d) => lc(d.one("html")?.getAttribute("lang")).length > 0 },
    { text: "The head has <meta charset=\"utf-8\"> and a <title> that reads “Asha Rao | Portfolio”.", test: (d) => lc(d.one("meta[charset]")?.getAttribute("charset")) === "utf-8" && lc(d.text(d.one("title"))) === "asha rao | portfolio" },
    { text: "There is exactly one <h1>, and it reads “Asha Rao”.", test: (d) => d.all("h1").length === 1 && lc(d.text(d.one("h1"))) === "asha rao" },
    { text: "There are at least two <h2> headings, and the <h1> comes before them.", test: (d) => { const hs = d.all("h1, h2"); return hs[0]?.tagName.toLowerCase() === "h1" && hs.filter((h) => h.tagName.toLowerCase() === "h2").length >= 2; } },
    { text: "A bulleted list (<ul>) names three skills: HTML, CSS and JavaScript.", test: (d) => d.all("ul").some((ul) => { const t = [...ul.querySelectorAll("li")].map((li) => lc(d.text(li))); return ["html", "css", "javascript"].every((s) => t.includes(s)); }) },
    { text: "An <img> has a src and the alt text “Photo of Asha”.", test: (d) => d.all("img").some((i) => lc(i.getAttribute("src")).length > 0 && lc(i.getAttribute("alt")) === "photo of asha") },
    { text: "A link goes to https://github.com/asha-rao and its text is “GitHub”.", test: (d) => d.all("a").some((a) => a.getAttribute("href") === "https://github.com/asha-rao" && lc(d.text(a)) === "github") },
    { text: "A table has a <thead> with the column headings Project and Year (as <th>), and a <tbody> with at least two rows.", test: (d) => { const t = d.one("table"); if (!t) return false; const heads = [...t.querySelectorAll("thead th")].map((h) => lc(d.text(h))); return heads.includes("project") && heads.includes("year") && t.querySelectorAll("tbody tr").length >= 2; } },
  ],
  commonMistakes: [
    PROFILE_REF.replace('alt="Photo of Asha" ', ""),
    PROFILE_REF.replace("<!doctype html>\n", ""),
    PROFILE_REF.replace("<thead><tr><th>Project</th><th>Year</th></tr></thead>", "<tr><td>Project</td><td>Year</td></tr>"),
    PROFILE_REF.replace("<h1>Asha Rao</h1>", "<h2>Asha Rao</h2>"),
    PROFILE_REF.replace('<meta charset="utf-8">', ""),
    PROFILE_REF.replace('<html lang="en">', "<html>"),
    PROFILE_REF.replace("    <li>JavaScript</li>\n", ""),
    PROFILE_REF.replace(">GitHub</a>", ">click here</a>"),
    PROFILE_REF.replace('href="https://github.com/asha-rao"', 'href="http://github.com/asha-rao"'),
  ],
};

// ---------------------------------------------------------------------------------------------------------------------------------
const FORM_REF = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Register</title></head>
<body>
  <header><h1>Campus drive registration</h1></header>
  <main>
    <form action="/register" method="post">
      <p><label for="n">Full name</label> <input id="n" name="name" type="text" required></p>
      <p><label for="e">Email address</label> <input id="e" name="email" type="email" required></p>
      <p><label for="a">Age</label> <input id="a" name="age" type="number" min="16" max="60"></p>
      <fieldset>
        <legend>Year of study</legend>
        <label><input type="radio" name="year" value="3"> 3rd year</label>
        <label><input type="radio" name="year" value="4"> 4th year</label>
      </fieldset>
      <p><label for="b">Branch</label>
        <select id="b" name="branch"><option>CSE</option><option>ECE</option><option>EEE</option></select></p>
      <p><label for="m">About you</label> <textarea id="m" name="about" rows="3"></textarea></p>
      <button type="submit">Register</button>
    </form>
  </main>
  <footer><p>Questions? Ask the placement cell.</p></footer>
</body>
</html>
`;

const form: HtmlChallenge = {
  kind: "html",
  title: "A registration form",
  statement: "Build a registration form for a campus drive. Every field needs a label connected to it, the right input type, and the checking the browser can do for you. Use the page landmarks so a screen reader can find each part. Meet every requirement in the list.",
  starter: "<!doctype html>\n<html lang=\"en\">\n<head><meta charset=\"utf-8\"><title>Register</title></head>\n<body>\n  <!-- header, main with the form, and footer go here -->\n</body>\n</html>\n",
  reference: FORM_REF,
  requirements: [
    { text: "The page has a <header> containing an <h1>, a <main> containing the <form>, and a <footer>.", test: (d) => !!d.one("header h1") && !!d.one("main form") && !!d.one("footer") },
    { text: "The form has a text input for the name, with a label connected by for and id, and it is required.", test: (d) => { const i = labelled(d, "name"); return !!i && i.tagName.toLowerCase() === "input" && lc(i.getAttribute("type")) === "text" && i.hasAttribute("required"); } },
    { text: "The form has an input of type email for the email address, labelled and required.", test: (d) => { const i = labelled(d, "email"); return !!i && lc(i.getAttribute("type")) === "email" && i.hasAttribute("required"); } },
    { text: "The form has an input of type number for the age, labelled, that only allows 16 to 60 (min and max).", test: (d) => { const i = labelled(d, "age"); return !!i && lc(i.getAttribute("type")) === "number" && num(i.getAttribute("min")) === 16 && num(i.getAttribute("max")) === 60; } },
    { text: "A <fieldset> with a <legend> mentioning “year” holds at least two radio buttons that share the name year, and each radio has a label.", test: (d) => d.all("fieldset").some((f) => { const legend = lc(d.text(f.querySelector("legend"))); const radios = [...f.querySelectorAll('input[type="radio"]')]; return legend.includes("year") && radios.length >= 2 && radios.every((r) => r.getAttribute("name") === "year" && (!!r.closest("label") || d.all("label").some((l) => l.getAttribute("for") === r.getAttribute("id") && r.getAttribute("id")))); }) },
    { text: "A <select> labelled “branch” offers at least three options.", test: (d) => { const s = labelled(d, "branch"); return !!s && s.tagName.toLowerCase() === "select" && s.querySelectorAll("option").length >= 3; } },
    { text: "A <textarea> is labelled “about”.", test: (d) => labelled(d, "about")?.tagName.toLowerCase() === "textarea" },
    { text: "The form ends with a submit button (a <button type=\"submit\"> with text, or an input of type submit).", test: (d) => d.all('form button[type="submit"], form input[type="submit"]').some((b) => lc(d.text(b)).length > 0 || lc(b.getAttribute("value")).length > 0) },
  ],
  commonMistakes: [
    FORM_REF.replace('<label for="n">Full name</label> <input id="n"', '<label>Full name</label> <input id="n"'),
    FORM_REF.replace('type="email" required', 'type="text" required'),
    FORM_REF.replace('name="year" value="4"', 'name="year4" value="4"'),
    FORM_REF.replace("<main>", "<div>").replace("</main>", "</div>"),
    FORM_REF.replace('min="16" max="60"', ""),
    FORM_REF.replace('<button type="submit">Register</button>', ""),
    FORM_REF.replace("<option>EEE</option>", ""),
    FORM_REF.replace('<label for="m">About you</label>', "<label>About you</label>"),
  ],
};

// ---------------------------------------------------------------------------------------------------------------------------------
const CARD_PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Card</title>
  <style>
__CSS__
  </style>
</head>
<body>
  <h1>Placement drive</h1>
  <p class="note">Bring two copies of your resume.</p>
  <div class="card">
    <h2>Register today</h2>
    <button>Apply now</button>
  </div>
</body>
</html>
`;
const CARD_CSS_REF = `    * { box-sizing: border-box; }
    :root { --brand: #2b6cb0; }
    body { font-family: system-ui, sans-serif; line-height: 1.6; }
    h1 { color: var(--brand); }
    .note { background: #fffbeb; }
    .card { width: 320px; padding: 16px; border: 2px solid var(--brand); margin: 12px; }
    button { background: var(--brand); color: white; border: 0; padding: 8px 14px; }`;

const cssBasics: HtmlChallenge = {
  kind: "html",
  title: "Style a card",
  statement: "The page below has a heading, a note and a card with a button. Write the CSS inside the <style> element so that it meets every requirement in the list. Keep the HTML as it is.",
  starter: CARD_PAGE.replace("__CSS__", "    /* write your CSS here */"),
  reference: CARD_PAGE.replace("__CSS__", CARD_CSS_REF),
  requirements: [
    { text: "Every element uses border-box sizing: the rule for * (or for .card) sets box-sizing: border-box.", test: (d) => lc(d.style("*", "box-sizing") ?? d.style(".card", "box-sizing")) === "border-box" },
    { text: "The :root rule defines a custom property named --brand with a colour.", test: (d) => (d.customProp("--brand") ?? "").length > 0 },
    { text: "The heading h1 takes its colour from var(--brand).", test: (d) => (d.style("h1", "color") ?? "").replace(/\s/g, "") === "var(--brand)" },
    { text: "The button’s background takes its colour from var(--brand).", test: (d) => /var\(--brand\)/.test(d.styleAny("button", ["background", "background-color"]) ?? "") },
    { text: "The .card has a width, some padding, a visible border and a margin.", test: (d) => isNonZeroLength(d.style(".card", "width")) && isNonZeroLength(d.styleAny(".card", ["padding", "padding-top", "padding-left"])) && isNonZeroLength(d.styleAny(".card", ["border", "border-width", "border-top", "border-left"])) && isNonZeroLength(d.styleAny(".card", ["margin", "margin-top", "margin-left"])) },
    { text: "The body sets a font-family and a line-height of at least 1.4 (a plain number such as 1.6).", test: (d) => (d.style("body", "font-family") ?? "").length > 0 && /^\d*\.?\d+$/.test(d.style("body", "line-height") ?? "") && num(d.style("body", "line-height")) >= 1.4 },
    { text: "The .note paragraph has its own background colour.", test: (d) => (d.styleAny(".note", ["background", "background-color"]) ?? "").length > 0 },
  ],
  commonMistakes: [
    CARD_PAGE.replace("__CSS__", CARD_CSS_REF.replace("* { box-sizing: border-box; }", "")),
    CARD_PAGE.replace("__CSS__", CARD_CSS_REF.replace("h1 { color: var(--brand); }", "h1 { color: #2b6cb0; }")),
    CARD_PAGE.replace("__CSS__", CARD_CSS_REF.replace("line-height: 1.6;", "line-height: 1;")),
    CARD_PAGE.replace("__CSS__", CARD_CSS_REF.replace("padding: 16px; ", "")),
    CARD_PAGE.replace("__CSS__", CARD_CSS_REF.replace(":root { --brand: #2b6cb0; }", "body { --brand: #2b6cb0; }")),
    CARD_PAGE.replace("__CSS__", CARD_CSS_REF.replace("line-height: 1.6;", "line-height: 24px;")),
    CARD_PAGE.replace("__CSS__", CARD_CSS_REF.replace("button { background: var(--brand);", "button { background: #2b6cb0;")),
    CARD_PAGE.replace("__CSS__", CARD_CSS_REF.replace(".note { background: #fffbeb; }", "")),
  ],
};

// ---------------------------------------------------------------------------------------------------------------------------------
const LAYOUT_PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
__META__
  <title>Layout</title>
  <style>
__CSS__
  </style>
</head>
<body>
  <nav class="nav"><strong>Capabilio</strong><div class="links"><a href="#">Courses</a> <a href="#">Arena</a></div></nav>
  <div class="gallery"><div>1</div><div>2</div><div>3</div><div>4</div><div>5</div><div>6</div></div>
  <div class="cols"><div>Left</div><div>Right</div></div>
  <img src="banner.jpg" alt="A wide banner">
</body>
</html>
`;
const META = '  <meta name="viewport" content="width=device-width, initial-scale=1">';
const LAYOUT_CSS_REF = `    .nav { display: flex; justify-content: space-between; align-items: center; }
    .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
    .cols { display: grid; gap: 10px; }
    @media (min-width: 700px) { .cols { grid-template-columns: 1fr 1fr; } }
    img { max-width: 100%; height: auto; }`;
const layoutPage = (css: string, meta = META) => LAYOUT_PAGE.replace("__META__", meta).replace("__CSS__", css);

const cssLayout: HtmlChallenge = {
  kind: "html",
  title: "A responsive layout",
  statement: "The page below has a navigation bar, a gallery, two columns and a picture. Write the CSS (and the one line in the head that phones need) so the page meets every requirement in the list. Start from a single column and add the second column only when the window is wide.",
  starter: layoutPage("    /* write your CSS here */", "  <!-- the line phones need goes here -->"),
  reference: layoutPage(LAYOUT_CSS_REF),
  requirements: [
    { text: "The head has a viewport meta tag (name=\"viewport\", content including width=device-width).", test: (d) => /width=device-width/.test(d.one('meta[name="viewport"]')?.getAttribute("content") ?? "") },
    { text: "The .nav is a flex container (display: flex) that puts space between its two children and centres them vertically.", test: (d) => /(inline-)?flex/.test(d.style(".nav", "display") ?? "") && lc(d.style(".nav", "justify-content")) === "space-between" && lc(d.style(".nav", "align-items")) === "center" },
    { text: "The .gallery is a grid whose columns adapt by themselves: repeat(auto-fit or auto-fill, minmax(…)).", test: (d) => lc(d.style(".gallery", "display")) === "grid" && /repeat\(\s*auto-(fit|fill)\s*,\s*minmax\(/i.test(d.style(".gallery", "grid-template-columns") ?? "") },
    { text: "The .gallery has a gap between its items.", test: (d) => isNonZeroLength(d.styleAny(".gallery", ["gap", "grid-gap", "column-gap"])) },
    { text: "The .cols are a single column on a small window: outside any media query .cols does not set two columns.", test: (d) => { const v = lc(d.style(".cols", "grid-template-columns")); return v === "" || v === "none" || /^(1fr|100%|minmax\([^)]*\))$/.test(v); } },
    { text: "From a window width of 600px to 1000px, a min-width media query gives .cols two equal columns (1fr 1fr or repeat(2, 1fr)).", test: (d) => { for (const px of [600, 700, 800, 900, 1000]) { const v = d.style(".cols", "grid-template-columns", { media: new RegExp(`min-width:\\s*${px}px`) }); if (v && /^(1fr\s+1fr|repeat\(\s*2\s*,\s*1fr\s*\))$/i.test(v.trim())) return true; } return false; } },
    { text: "Images never overflow their container: the img rule sets max-width: 100%.", test: (d) => lc(d.style("img", "max-width")) === "100%" },
  ],
  commonMistakes: [
    layoutPage(LAYOUT_CSS_REF, ""),
    layoutPage(LAYOUT_CSS_REF.replace("justify-content: space-between;", "")),
    layoutPage(LAYOUT_CSS_REF.replace("repeat(auto-fit, minmax(140px, 1fr))", "1fr 1fr 1fr")),
    layoutPage(LAYOUT_CSS_REF.replace(".cols { display: grid; gap: 10px; }", ".cols { display: grid; gap: 10px; grid-template-columns: 1fr 1fr; }")),
    layoutPage(LAYOUT_CSS_REF.replace("@media (min-width: 700px)", "@media (max-width: 700px)")),
    layoutPage(LAYOUT_CSS_REF.replace("max-width: 100%;", "width: 100%;")),
    layoutPage(LAYOUT_CSS_REF.replace("min-width: 700px", "min-width: 300px")),
    layoutPage(LAYOUT_CSS_REF.replace("1fr)); gap: 10px; }", "1fr)); }")),
  ],
};

export const challenges: Record<string, HtmlChallenge> = {
  "html-basics": profile,
  "html-forms": form,
  "css-basics": cssBasics,
  "css-layout": cssLayout,
};
