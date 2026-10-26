import { MAX_SUBMISSIONS, type FileContent } from "../file-tasks/types";
import type { FrontendCheck } from "../frontend/checks";
import type { FrontendDraft, FrontendTemplate } from "../frontend/tickets";

/** Application Developer form tickets for the shared frontend workstation: the server parses the HTML and checks it; the page is never run. */
const PRODUCT = { name: "Neha Kulkarni", title: "Product Manager" };
const ACCESS = { name: "Sana Iqbal", title: "Accessibility Reviewer" };

const make = (title: string, requester: FrontendDraft["requester"], scenario: string, deliverable: string, tags: string[], files: FileContent["files"], checks: FrontendCheck[]): FrontendDraft => ({
  title, requester, scenario, skillTags: tags,
  content: { files, requirements: checks.map((c) => c.label), deliverable, maxSubmissions: MAX_SUBMISSIONS },
  key: { checks },
});
const html = (content: string) => ({ name: "index.html", language: "html" as const, content });
const page = (body: string) => `<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Kaarya</title></head>\n<body>\n${body}\n</body>\n</html>\n`;
const check = (label: string, selector: string, op: Extract<FrontendCheck, { kind: "html" }>["op"], extra: { attr?: string; value?: string | number } = {}): FrontendCheck => ({ kind: "html", label, file: "index.html", selector, op, ...extra });

export const APP_DEV_FRONTEND_TEMPLATES: FrontendTemplate[] = [
  {
    id: "appdev-signup-form", areas: ["ui-forms"], difficulty: "easy", minLevel: "fresher",
    draft: make("Build the signup form from the spec", PRODUCT,
      "Hi, the signup screen was mocked up with plain text boxes and no labels. Screen readers announce 'edit text' three times and the browser does not stop obviously wrong input. Please turn it into a proper form following the spec below.",
      "Edit index.html so the signup form meets every requirement below. Use the browser's built-in validation attributes; no script is needed.",
      ["HTML forms", "Accessibility", "Validation"],
      [html(page(`<form action="/signup" method="post">\n  Full name <input id="name">\n  Email <input id="email">\n  Password <input id="password">\n  <div class="btn">Create account</div>\n</form>`))],
      [
        check("Every input has a <label> tied to it with for", "label[for=name], label[for=email], label[for=password]", "count_equals", { value: 3 }),
        check("The email field uses type=\"email\"", "input#email", "attr_equals", { attr: "type", value: "email" }),
        check("The password field uses type=\"password\"", "input#password", "attr_equals", { attr: "type", value: "password" }),
        check("All three fields are required", "input[required]", "count_gte", { value: 3 }),
        check("The password must be at least 8 characters (minlength)", "input#password", "attr_equals", { attr: "minlength", value: "8" }),
        check("The form is sent with a real <button type=\"submit\">", "form button[type=submit]", "exists"),
      ]),
    solution: [{ name: "index.html", content: page(`<form action="/signup" method="post">\n  <label for="name">Full name</label> <input id="name" name="name" required>\n  <label for="email">Email</label> <input id="email" name="email" type="email" required>\n  <label for="password">Password</label> <input id="password" name="password" type="password" minlength="8" required>\n  <button type="submit">Create account</button>\n</form>`) }],
  },
  {
    id: "appdev-address-form", areas: ["ui-forms"], difficulty: "medium", minLevel: "fresher",
    draft: make("Make the delivery address form usable for everyone", ACCESS,
      "Hello, the delivery address form fails our accessibility review: the slot choice is three loose radio buttons, the PIN error is just red text nobody's screen reader reads, and phones open the letter keyboard for the PIN. Please fix it to the spec below.",
      "Edit index.html so the address form meets every requirement below.",
      ["HTML forms", "Accessibility", "ARIA"],
      [html(page(`<form action="/address" method="post">\n  <label for="line1">Address</label> <input id="line1" name="line1">\n  <label for="pin">PIN code</label> <input id="pin" name="pin">\n  <span id="pin-error" class="error">Enter a 6-digit PIN code</span>\n  <p>Delivery slot</p>\n  <input type="radio" id="am" name="slot" value="am"> <label for="am">Morning</label>\n  <input type="radio" id="pm" name="slot" value="pm"> <label for="pm">Evening</label>\n  <button type="submit">Save address</button>\n</form>`))],
      [
        check("The delivery slot radios are grouped in a <fieldset>", "fieldset input[type=radio]", "count_gte", { value: 2 }),
        check("The group is named by a <legend> that says Delivery slot", "fieldset legend", "text_contains", { value: "Delivery slot" }),
        check("The PIN field only accepts a 6-digit PIN not starting with 0 (pattern=\"[1-9][0-9]{5}\")", "input#pin", "attr_equals", { attr: "pattern", value: "[1-9][0-9]{5}" }),
        check("The PIN field opens the number keypad (inputmode=\"numeric\")", "input#pin", "attr_equals", { attr: "inputmode", value: "numeric" }),
        check("The PIN field points to its error message with aria-describedby=\"pin-error\"", "input#pin", "attr_equals", { attr: "aria-describedby", value: "pin-error" }),
        check("The address and PIN fields are required", "input#line1[required], input#pin[required]", "count_equals", { value: 2 }),
        check("The PIN field has autocomplete=\"postal-code\"", "input#pin", "attr_equals", { attr: "autocomplete", value: "postal-code" }),
      ]),
    solution: [{ name: "index.html", content: page(`<form action="/address" method="post">\n  <label for="line1">Address</label> <input id="line1" name="line1" autocomplete="street-address" required>\n  <label for="pin">PIN code</label> <input id="pin" name="pin" inputmode="numeric" pattern="[1-9][0-9]{5}" autocomplete="postal-code" aria-describedby="pin-error" required>\n  <span id="pin-error" class="error">Enter a 6-digit PIN code</span>\n  <fieldset>\n    <legend>Delivery slot</legend>\n    <input type="radio" id="am" name="slot" value="am"> <label for="am">Morning</label>\n    <input type="radio" id="pm" name="slot" value="pm"> <label for="pm">Evening</label>\n  </fieldset>\n  <button type="submit">Save address</button>\n</form>`) }],
  },
];
