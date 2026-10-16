import type { FileContent, FileDraft, FileTemplate } from "../file-tasks/types";
import { MAX_SUBMISSIONS } from "../file-tasks/types";
import type { FrontendCheck } from "./checks";

export type FrontendDraft = FileDraft<FrontendCheck>;
export type FrontendTemplate = FileTemplate<FrontendCheck>;

const WEB = { name: "Ananya Iyer", title: "Web Product Manager" };
const DESIGN = { name: "Rohan Mehta", title: "Design Lead" };
const ACCESS = { name: "Sana Khan", title: "Accessibility Champion" };

const make = (title: string, requester: FrontendDraft["requester"], scenario: string, deliverable: string, tags: string[], files: FileContent["files"], checks: FrontendCheck[]): FrontendDraft => ({
  title, requester, scenario, skillTags: tags,
  content: { files, requirements: checks.map((c) => c.label), deliverable, maxSubmissions: MAX_SUBMISSIONS },
  key: { checks },
});
const html = (name: string, content: string) => ({ name, language: "html" as const, content });
const css = (name: string, content: string) => ({ name, language: "css" as const, content });

/** Fixed tickets are the safety net when the AI cannot produce a valid one; each has a known-good solution that the tests run through the checks. */
export const FRONTEND_TEMPLATES: FrontendTemplate[] = [
  {
    id: "frontend-semantic-page", areas: ["html-semantics"], difficulty: "easy", minLevel: "fresher",
    draft: make("Give the recipe page real structure", WEB, "Hi, our recipe page is built entirely from divs. Search engines and screen readers cannot tell the navigation from the article. Please rebuild the markup with proper semantic elements.", "Edit index.html to meet the requirements below.", ["HTML", "Semantic elements", "SEO"],
      [html("index.html", "<!doctype html>\n<html lang=\"en\">\n<head><meta charset=\"utf-8\"><title>Spice Kitchen</title></head>\n<body>\n<div class=\"header\">\n  <div class=\"title\">Spice Kitchen</div>\n  <div class=\"menu\"><a href=\"/\">Home</a> <a href=\"/recipes\">Recipes</a></div>\n</div>\n<div class=\"content\">\n  <div class=\"post\">\n    <div class=\"heading\">Masala Dosa</div>\n    <p>Soak the rice and lentils overnight, then grind and ferment.</p>\n  </div>\n</div>\n<div class=\"footer\">© Spice Kitchen</div>\n</body>\n</html>\n")],
      [
        { kind: "html", label: "The page header uses a <header> element", file: "index.html", selector: "header", op: "exists" },
        { kind: "html", label: "The menu links are inside a <nav> with at least two links", file: "index.html", selector: "nav a", op: "count_gte", value: 2 },
        { kind: "html", label: "The page content is inside a <main> element", file: "index.html", selector: "main", op: "exists" },
        { kind: "html", label: "The recipe is an <article>", file: "index.html", selector: "main article", op: "exists" },
        { kind: "html", label: "The page has exactly one <h1>", file: "index.html", selector: "h1", op: "count_equals", value: 1 },
        { kind: "html", label: "The footer uses a <footer> element", file: "index.html", selector: "footer", op: "exists" },
        { kind: "html", label: "No div is still used as the header or footer", file: "index.html", selector: "div.header, div.footer", op: "not_exists" },
      ]),
    solution: [{ name: "index.html", content: "<!doctype html>\n<html lang=\"en\">\n<head><meta charset=\"utf-8\"><title>Spice Kitchen</title></head>\n<body>\n<header>\n  <p>Spice Kitchen</p>\n  <nav><a href=\"/\">Home</a> <a href=\"/recipes\">Recipes</a></nav>\n</header>\n<main>\n  <article>\n    <h1>Masala Dosa</h1>\n    <p>Soak the rice and lentils overnight, then grind and ferment.</p>\n  </article>\n</main>\n<footer>© Spice Kitchen</footer>\n</body>\n</html>\n" }],
  },
  {
    id: "frontend-flex-navbar", areas: ["css-layout"], difficulty: "easy", minLevel: "fresher",
    draft: make("Lay the navigation bar out in a row", DESIGN, "Hello, the logo and menu links are stacked on top of each other. They should sit on one line, with the logo on the left and the links on the right, vertically centred and with space between the links.", "Edit style.css to meet the requirements below.", ["CSS", "Flexbox", "Layout"],
      [html("index.html", "<!doctype html>\n<html lang=\"en\">\n<head><meta charset=\"utf-8\"><title>Studio</title><link rel=\"stylesheet\" href=\"style.css\"></head>\n<body>\n<nav class=\"navbar\">\n  <a class=\"logo\" href=\"/\">Studio</a>\n  <ul class=\"links\"><li><a href=\"/work\">Work</a></li><li><a href=\"/about\">About</a></li><li><a href=\"/contact\">Contact</a></li></ul>\n</nav>\n</body>\n</html>\n"), css("style.css", ".navbar {\n  background: #111;\n  padding: 12px 24px;\n}\n.links {\n  list-style: none;\n  margin: 0;\n  padding: 0;\n}\n")],
      [
        { kind: "css", label: "The navbar is a flex container", file: "style.css", selector: ".navbar", property: "display", op: "equals", value: "flex" },
        { kind: "css", label: "The logo and links are pushed to opposite ends (space-between)", file: "style.css", selector: ".navbar", property: "justify-content", op: "equals", value: "space-between" },
        { kind: "css", label: "The navbar items are vertically centred", file: "style.css", selector: ".navbar", property: "align-items", op: "equals", value: "center" },
        { kind: "css", label: "The links list is a flex row too", file: "style.css", selector: ".links", property: "display", op: "equals", value: "flex" },
        { kind: "css", label: "The links have a gap between them", file: "style.css", selector: ".links", property: "gap", op: "exists" },
      ]),
    solution: [{ name: "style.css", content: ".navbar {\n  background: #111;\n  padding: 12px 24px;\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n}\n.links {\n  list-style: none;\n  margin: 0;\n  padding: 0;\n  display: flex;\n  gap: 16px;\n}\n" }],
  },
  {
    id: "frontend-responsive-cards", areas: ["responsive-design"], difficulty: "medium", minLevel: "junior",
    draft: make("Make the product cards work on phones", DESIGN, "Hi, the product page is a fixed 960px wide, so on phones people have to scroll sideways. Cards should stack on small screens and sit in columns on wider ones, and the images must never overflow.", "Edit index.html and style.css to meet the requirements below.", ["Responsive design", "CSS Grid", "Media queries"],
      [html("index.html", "<!doctype html>\n<html lang=\"en\">\n<head><meta charset=\"utf-8\"><title>Shop</title><link rel=\"stylesheet\" href=\"style.css\"></head>\n<body>\n<div class=\"cards\">\n  <div class=\"card\"><img src=\"a.jpg\" alt=\"Teapot\"><h2>Teapot</h2></div>\n  <div class=\"card\"><img src=\"b.jpg\" alt=\"Cup\"><h2>Cup</h2></div>\n  <div class=\"card\"><img src=\"c.jpg\" alt=\"Plate\"><h2>Plate</h2></div>\n</div>\n</body>\n</html>\n"), css("style.css", ".cards {\n  width: 960px;\n}\n.card {\n  float: left;\n  width: 300px;\n}\n.card img {\n  width: 300px;\n}\n")],
      [
        { kind: "html", label: "The page tells phones to use the device width (viewport meta tag)", file: "index.html", selector: "meta[name=viewport]", op: "attr_matches", attr: "content", value: "width=device-width" },
        { kind: "css", label: "The cards container uses CSS grid", file: "style.css", selector: ".cards", property: "display", op: "equals", value: "grid" },
        { kind: "css", label: "The cards container has a gap between cards", file: "style.css", selector: ".cards", property: "gap", op: "exists" },
        { kind: "css_at", label: "A media query for wider screens (min-width) exists", file: "style.css", name: "media", pattern: "min-width" },
        { kind: "css", label: "On wider screens the grid has more than one column", file: "style.css", selector: ".cards", media: "min-width", property: "grid-template-columns", op: "exists" },
        { kind: "css", label: "Card images never overflow their card (max-width: 100%)", file: "style.css", selector: ".card img", property: "max-width", op: "equals", value: "100%" },
        { kind: "css", label: "The old float layout is gone", file: "style.css", property: "float", op: "not_exists" },
      ]),
    solution: [
      { name: "index.html", content: "<!doctype html>\n<html lang=\"en\">\n<head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>Shop</title><link rel=\"stylesheet\" href=\"style.css\"></head>\n<body>\n<div class=\"cards\">\n  <div class=\"card\"><img src=\"a.jpg\" alt=\"Teapot\"><h2>Teapot</h2></div>\n  <div class=\"card\"><img src=\"b.jpg\" alt=\"Cup\"><h2>Cup</h2></div>\n  <div class=\"card\"><img src=\"c.jpg\" alt=\"Plate\"><h2>Plate</h2></div>\n</div>\n</body>\n</html>\n" },
      { name: "style.css", content: ".cards {\n  display: grid;\n  gap: 16px;\n}\n.card img {\n  max-width: 100%;\n  height: auto;\n}\n@media (min-width: 768px) {\n  .cards {\n    grid-template-columns: repeat(3, 1fr);\n  }\n}\n" },
    ],
  },
  {
    id: "frontend-accessible-form", areas: ["forms"], difficulty: "medium", minLevel: "junior",
    draft: make("Make the signup form usable and valid", ACCESS, "Hello, the signup form has no labels, any text is accepted as an email and the browser cannot autofill it. Please fix the markup so it is usable with a keyboard and a screen reader.", "Edit index.html to meet the requirements below.", ["HTML forms", "Accessibility", "Validation"],
      [html("index.html", "<!doctype html>\n<html lang=\"en\">\n<head><meta charset=\"utf-8\"><title>Sign up</title></head>\n<body>\n<main>\n  <h1>Create your account</h1>\n  <form>\n    <input type=\"text\" placeholder=\"Full name\">\n    <input type=\"text\" placeholder=\"Email\">\n    <input type=\"text\" placeholder=\"Password\">\n    <button>Sign up</button>\n  </form>\n</main>\n</body>\n</html>\n")],
      [
        { kind: "html", label: "Every field has a <label> tied to it with for/id (at least 3 labels)", file: "index.html", selector: "label[for]", op: "count_gte", value: 3 },
        { kind: "html", label: "Every input has an id", file: "index.html", selector: "input:not([id])", op: "not_exists" },
        { kind: "html", label: "The email field uses type=\"email\"", file: "index.html", selector: "input[type=email]", op: "exists" },
        { kind: "html", label: "The password field uses type=\"password\"", file: "index.html", selector: "input[type=password]", op: "exists" },
        { kind: "html", label: "At least three fields are required", file: "index.html", selector: "input[required]", op: "count_gte", value: 3 },
        { kind: "html", label: "The email field allows autofill (autocomplete=\"email\")", file: "index.html", selector: "input[type=email]", op: "attr_equals", attr: "autocomplete", value: "email" },
        { kind: "html", label: "The button is a submit button (type=\"submit\")", file: "index.html", selector: "button[type=submit]", op: "exists" },
      ]),
    solution: [{ name: "index.html", content: "<!doctype html>\n<html lang=\"en\">\n<head><meta charset=\"utf-8\"><title>Sign up</title></head>\n<body>\n<main>\n  <h1>Create your account</h1>\n  <form>\n    <label for=\"name\">Full name</label>\n    <input id=\"name\" type=\"text\" required autocomplete=\"name\">\n    <label for=\"email\">Email</label>\n    <input id=\"email\" type=\"email\" required autocomplete=\"email\">\n    <label for=\"password\">Password</label>\n    <input id=\"password\" type=\"password\" required autocomplete=\"new-password\">\n    <button type=\"submit\">Sign up</button>\n  </form>\n</main>\n</body>\n</html>\n" }],
  },
  {
    id: "frontend-accessibility-audit", areas: ["accessibility"], difficulty: "medium", minLevel: "junior",
    draft: make("Fix the accessibility problems from the audit", ACCESS, "Hi, our audit found that the page has no language, images without descriptions, an icon button that screen readers read as just \"button\", and no way for keyboard users to skip the menu. Please fix those.", "Edit index.html to meet the requirements below.", ["Accessibility", "WCAG", "ARIA"],
      [html("index.html", "<!doctype html>\n<html>\n<head><meta charset=\"utf-8\"><title>Clinic</title></head>\n<body>\n<nav><a href=\"/\">Home</a> <a href=\"/doctors\">Doctors</a> <a href=\"/book\">Book</a></nav>\n<main>\n  <h1>Find a doctor</h1>\n  <img src=\"doctor.jpg\">\n  <button><svg width=\"16\" height=\"16\"></svg></button>\n</main>\n</body>\n</html>\n")],
      [
        { kind: "html", label: "The page declares its language on <html> (lang attribute)", file: "index.html", selector: "html", op: "attr_exists", attr: "lang" },
        { kind: "html", label: "Every image has an alt attribute", file: "index.html", selector: "img:not([alt])", op: "not_exists" },
        { kind: "html", label: "The icon-only button has an accessible name (aria-label)", file: "index.html", selector: "button[aria-label]", op: "exists" },
        { kind: "html", label: "A skip link at the top points to the main content (an anchor starting with #)", file: "index.html", selector: "a[href^=\"#\"]", op: "exists" },
        { kind: "html", label: "The main element has an id the skip link can target", file: "index.html", selector: "main[id]", op: "exists" },
      ]),
    solution: [{ name: "index.html", content: "<!doctype html>\n<html lang=\"en\">\n<head><meta charset=\"utf-8\"><title>Clinic</title></head>\n<body>\n<a href=\"#content\">Skip to content</a>\n<nav><a href=\"/\">Home</a> <a href=\"/doctors\">Doctors</a> <a href=\"/book\">Book</a></nav>\n<main id=\"content\">\n  <h1>Find a doctor</h1>\n  <img src=\"doctor.jpg\" alt=\"A doctor with a stethoscope\">\n  <button aria-label=\"Search doctors\"><svg width=\"16\" height=\"16\"></svg></button>\n</main>\n</body>\n</html>\n" }],
  },
  {
    id: "frontend-debug-styles", areas: ["frontend-debugging"], difficulty: "medium", minLevel: "junior",
    draft: make("Fix: none of my styles are showing up", WEB, "Hello, I wrote the stylesheet but the page looks completely unstyled and the button has no colour. I have checked it three times and it all looks fine to me, so there must be some small mistakes.", "Fix index.html and style.css to meet the requirements below.", ["CSS", "Debugging", "Selectors"],
      [html("index.html", "<!doctype html>\n<html lang=\"en\">\n<head><meta charset=\"utf-8\"><title>Offer</title><link rel=\"stylesheet\" href=\"styles.css\"></head>\n<body>\n<h1>Festival offer</h1>\n<button class=\"btn-primary\">Shop now</button>\n</body>\n</html>\n"), css("style.css", "h1 {\n  colour: #222;\n  font-size: 2rem;\n}\n.btn-primry {\n  background-color: #e4572e;\n  color: white;\n}\n")],
      [
        { kind: "html", label: "The page links to the stylesheet file that exists (style.css)", file: "index.html", selector: "link[rel=stylesheet]", op: "attr_equals", attr: "href", value: "style.css" },
        { kind: "css", label: "The heading colour uses the real property name (color)", file: "style.css", selector: "h1", property: "color", op: "exists" },
        { kind: "css", label: "The button rule targets the class used in the HTML (.btn-primary)", file: "style.css", selector: ".btn-primary", property: "background-color", op: "exists" },
        { kind: "css", label: "The misspelt property colour is gone", file: "style.css", property: "colour", op: "not_exists" },
        { kind: "html", label: "The button still has the btn-primary class", file: "index.html", selector: "button.btn-primary", op: "exists" },
      ]),
    solution: [
      { name: "index.html", content: "<!doctype html>\n<html lang=\"en\">\n<head><meta charset=\"utf-8\"><title>Offer</title><link rel=\"stylesheet\" href=\"style.css\"></head>\n<body>\n<h1>Festival offer</h1>\n<button class=\"btn-primary\">Shop now</button>\n</body>\n</html>\n" },
      { name: "style.css", content: "h1 {\n  color: #222;\n  font-size: 2rem;\n}\n.btn-primary {\n  background-color: #e4572e;\n  color: white;\n}\n" },
    ],
  },
];
