import type { Rng } from "../rng";
import type { ExperienceLevel } from "../level";
import type { Difficulty } from "@/lib/arena-workstations/types";
import type { CodeDraft, CodeProblem, Lang } from "../code/problems";

// mirrors EXAMPLE_COUNT and MAX_SUBMISSIONS in ../code/problems.ts; imported as values that would make a cycle once code.ts lists these problems
const EXAMPLES = 2;
const SUBMISSIONS = 8;

/**
 * Application Developer tickets for the shared code workstation: the small full-stack features an MCA fresher is handed in their first job (input
 * cleaning, request validation, UI state, a bug fix). The student's function runs in their browser; the server compares what it returned with the
 * answers below (lib/arena-workstations/tools/code.ts).
 */
interface Spec {
  id: string;
  area: string;
  difficulty: Difficulty;
  minLevel: ExperienceLevel;
  fn: string;
  params: string[];
  title: string;
  requester: CodeDraft["requester"];
  scenario: string;
  deliverable: string;
  tags: string[];
  cases(rng: Rng): unknown[][];
  solve(...args: never[]): unknown;
  broken?: Record<Lang, string>;
}

const CAST = {
  product: { name: "Neha Kulkarni", title: "Product Manager" },
  lead: { name: "Aditya Rao", title: "Tech Lead" },
  support: { name: "Farah Sheikh", title: "Customer Support Lead" },
  qa: { name: "Joseph Thomas", title: "QA Lead" },
};

const starter = (fn: string, params: string[]): Record<Lang, string> => ({
  python: `def ${fn}(${params.join(", ")}):\n    # write your solution here\n    pass\n`,
  javascript: `function ${fn}(${params.join(", ")}) {\n  // write your solution here\n}\n`,
});

function problem(s: Spec): CodeProblem & { solve: Spec["solve"] } {
  return {
    id: s.id, areas: [s.area], difficulty: s.difficulty, minLevel: s.minLevel, solve: s.solve,
    build(rng) {
      const cases = s.cases(rng);
      const expected = cases.map((c) => (s.solve as (...a: unknown[]) => unknown)(...c));
      return {
        title: s.title, requester: s.requester, scenario: s.scenario, skillTags: s.tags,
        content: {
          fn: s.fn, params: s.params, cases,
          examples: cases.slice(0, EXAMPLES).map((args, i) => ({ args, expected: expected[i] })),
          starters: s.broken ?? starter(s.fn, s.params),
          deliverable: s.deliverable, maxSubmissions: SUBMISSIONS, timeLimitSeconds: 20,
        },
        key: { expected },
      };
    },
  };
}

const digits = (rng: Rng, n: number) => Array.from({ length: n }, () => rng.int(0, 9)).join("");

// ---- functions-and-logic ----
const normalizePhone = (raw: string) => {
  let s = raw.replace(/[ -]/g, "");
  if (s.startsWith("+91")) s = s.slice(3);
  else if (s.length === 11 && s.startsWith("0")) s = s.slice(1);
  return /^[6-9]\d{9}$/.test(s) ? s : null;
};
const phoneCase = (rng: Rng) => {
  const n = String(rng.int(6, 9)) + digits(rng, 9);
  return rng.pick([n, `${n.slice(0, 5)} ${n.slice(5)}`, `+91 ${n}`, `+91-${n.slice(0, 5)}-${n.slice(5)}`, `0${n}`, `${rng.int(1, 5)}${n.slice(1)}`, n.slice(1), `${n}${rng.int(0, 9)}`, `+44${n}`]);
};

const maskEmail = (email: string) => {
  const parts = email.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1].includes(".")) return null;
  const [local, domain] = parts;
  const masked = local.length <= 2 ? `${local[0]}*` : `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}`;
  return `${masked}@${domain}`;
};

type Item = { sku: string; qty: number; price: number };
const cartSummary = (items: Item[]) => {
  const merged = new Map<string, { qty: number; price: number }>();
  for (const it of items) {
    if (it.qty <= 0) continue;
    const prev = merged.get(it.sku);
    merged.set(it.sku, { qty: (prev?.qty ?? 0) + it.qty, price: prev?.price ?? it.price });
  }
  const lines = [...merged.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([sku, v]) => ({ sku, qty: v.qty, total: v.qty * v.price }));
  return { lines, total_qty: lines.reduce((s, l) => s + l.qty, 0), total_paise: lines.reduce((s, l) => s + l.total, 0) };
};
const cartItems = (rng: Rng) => Array.from({ length: rng.int(1, 7) }, () => ({ sku: rng.pick(["PEN-01", "MUG-02", "BAG-07", "CAP-03"]), qty: rng.int(-1, 4), price: rng.pick([4900, 19900, 59900]) }));

// ---- api-handlers ----
const validEmail = (email: string) => {
  const parts = email.split("@");
  if (parts.length !== 2 || !parts[0] || /\s/.test(email)) return false;
  const domain = parts[1];
  return domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".");
};
const validateSignup = (body: Record<string, unknown>) => {
  const errors: string[] = [];
  if (typeof body.name !== "string" || body.name.trim() === "") errors.push("name");
  if (typeof body.email !== "string" || !validEmail(body.email)) errors.push("email");
  if (typeof body.age !== "number" || !Number.isInteger(body.age) || body.age < 18 || body.age > 100) errors.push("age");
  if (errors.length) return { status: 422, body: { errors } };
  return { status: 201, body: { name: (body.name as string).trim(), email: (body.email as string).toLowerCase(), age: body.age } };
};
const signupBody = (rng: Rng) => {
  const body: Record<string, unknown> = {};
  if (rng.chance(0.9)) body.name = rng.pick(["Asha Rao", "  Imran Khan ", "", "   ", 42]);
  if (rng.chance(0.9)) body.email = rng.pick(["asha@kaarya.in", "Imran.K@Mail.co.in", "no-at-sign.in", "a@b", "two@@x.in", "x@y.com"]);
  if (rng.chance(0.9)) body.age = rng.pick([17, 18, 25, 100, 101, 18.5, "25", 40]);
  return body;
};

type Req = { method: string; path: string; body?: Record<string, unknown> };
const contactsApi = (reqs: Req[]) => {
  const contacts = new Map<number, { id: number; name: string; phone: string }>();
  let next = 1;
  const notFound = { status: 404, body: { error: "not found" } };
  return reqs.map((r) => {
    const m = /^\/contacts(?:\/(\d+))?$/.exec(r.path);
    if (!m) return notFound;
    const id = m[1] ? Number(m[1]) : null;
    if (id === null && r.method === "POST") {
      const { name, phone } = r.body ?? {};
      if (typeof name !== "string" || name.trim() === "" || typeof phone !== "string" || !/^\d{10}$/.test(phone)) return { status: 422, body: { error: "invalid contact" } };
      if ([...contacts.values()].some((c) => c.phone === phone)) return { status: 409, body: { error: "phone already exists" } };
      const c = { id: next++, name: name.trim(), phone };
      contacts.set(c.id, c);
      return { status: 201, body: { ...c } };
    }
    if (id === null && r.method === "GET") return { status: 200, body: [...contacts.values()].map((c) => ({ ...c })) };
    if (id === null) return { status: 405, body: { error: "method not allowed" } };
    if (r.method !== "GET" && r.method !== "DELETE") return { status: 405, body: { error: "method not allowed" } };
    const c = contacts.get(id);
    if (!c) return notFound;
    if (r.method === "GET") return { status: 200, body: { ...c } };
    contacts.delete(id);
    return { status: 204, body: null };
  });
};
const contactRequests = (rng: Rng): Req[] =>
  Array.from({ length: rng.int(4, 9) }, () =>
    rng.weighted<Req>([
      [{ method: "POST", path: "/contacts", body: { name: rng.pick(["Asha", " Ravi ", "Meena"]), phone: rng.pick(["9876543210", "9123456780", "9988776655"]) } }, 35],
      [{ method: "POST", path: "/contacts", body: rng.pick([{ name: "", phone: "9876543210" }, { name: "Om", phone: "98765" }, { name: "Om" }]) }, 10],
      [{ method: "GET", path: "/contacts" }, 12],
      [{ method: "GET", path: `/contacts/${rng.int(1, 3)}` }, 15],
      [{ method: "DELETE", path: `/contacts/${rng.int(1, 3)}` }, 15],
      [{ method: "PUT", path: `/contacts/${rng.int(1, 3)}` }, 5],
      [{ method: "GET", path: "/people" }, 4],
    ])
  );

// ---- ui-state ----
type Product = { name: string; stock: number };
const filterProducts = (products: Product[], query: string, inStockOnly: boolean) => {
  const q = query.trim().toLowerCase();
  return products.filter((p) => p.name.toLowerCase().includes(q) && (!inStockOnly || p.stock > 0)).map((p) => p.name);
};
const CATALOGUE = ["Steel Bottle", "Lunch Box", "Bottle Brush", "Desk Lamp", "Notebook", "Water Bottle Cap", "Lamp Shade"];
const productsCase = (rng: Rng) => rng.shuffle(CATALOGUE).slice(0, rng.int(2, 6)).map((name) => ({ name, stock: rng.pick([0, 0, 3, 12]) }));

type Action = { type: string; id?: string; price?: number; qty?: number };
const cartReducer = (actions: Action[]) => {
  let items: { id: string; qty: number; price: number }[] = [];
  for (const a of actions) {
    if (a.type === "add") items = items.some((i) => i.id === a.id) ? items.map((i) => (i.id === a.id ? { ...i, qty: i.qty + 1 } : i)) : [...items, { id: a.id!, qty: 1, price: a.price! }];
    else if (a.type === "remove") items = items.filter((i) => i.id !== a.id);
    else if (a.type === "set_qty") items = a.qty! <= 0 ? items.filter((i) => i.id !== a.id) : items.map((i) => (i.id === a.id ? { ...i, qty: a.qty! } : i));
    else if (a.type === "clear") items = [];
  }
  return { items: items.map(({ id, qty }) => ({ id, qty })), count: items.reduce((s, i) => s + i.qty, 0), total: items.reduce((s, i) => s + i.qty * i.price, 0) };
};
const PRICES: Record<string, number> = { tea: 12000, cup: 25000, mat: 99900 };
const actionsCase = (rng: Rng): Action[] =>
  Array.from({ length: rng.int(2, 8) }, () => {
    const id = rng.pick(Object.keys(PRICES));
    return rng.weighted<Action>([[{ type: "add", id, price: PRICES[id] }, 45], [{ type: "remove", id }, 15], [{ type: "set_qty", id, qty: rng.int(-1, 5) }, 25], [{ type: "clear" }, 5]]);
  });

// ---- app-debugging ----
const isValidPin = (pin: string) => /^[1-9]\d{5}$/.test(pin);
const mergeSettings = (defaults: Record<string, unknown>, overrides: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, k in overrides && overrides[k] !== null ? overrides[k] : v]));
const DEFAULTS = { dark_mode: false, page_size: 20, language: "en", notify: true };
const overridesCase = (rng: Rng) => Object.fromEntries(rng.shuffle([["dark_mode", rng.pick([true, false, null])], ["page_size", rng.pick([0, 50, null])], ["language", rng.pick(["", "hi", "ta"])], ["notify", rng.pick([false, true])], ["theme", "blue"]]).slice(0, rng.int(1, 4)));

export const APP_DEV_CODE_PROBLEMS = [
  problem({
    id: "appdev-normalize-phone", area: "functions-and-logic", difficulty: "easy", minLevel: "fresher", fn: "normalize_phone", params: ["raw"], requester: CAST.support,
    title: "Clean up the mobile numbers people type at signup",
    scenario: "Hi, our SMS reminders fail for about a tenth of users because they typed their number as '98765 43210', '+91-98765-43210' or with a leading 0. I need one function the signup form and the import job can both use.",
    deliverable: "Write normalize_phone(raw): remove every space and hyphen; then if the text starts with +91 drop that prefix, otherwise if it is 11 characters long and starts with 0 drop the 0. If what is left is exactly 10 digits and starts with 6, 7, 8 or 9, return it as a string; otherwise return null (None in Python).",
    tags: ["Strings", "Validation", "Edge cases"],
    cases: (rng) => [["98765 43210"], ["+91-91234-56789"], [""], ["0 9876543210"], ["12345"], ["+91 5123456789"], ["98a6543210"], ...Array.from({ length: 7 }, () => [phoneCase(rng)])],
    solve: normalizePhone as never,
  }),
  problem({
    id: "appdev-mask-email", area: "functions-and-logic", difficulty: "easy", minLevel: "fresher", fn: "mask_email", params: ["email"], requester: CAST.product,
    title: "Hide most of the email on the account page",
    scenario: "Hello, the account page shows the full email address and screenshots of it end up in support chats. Product wants it partly hidden, like a****a@kaarya.in, while the user can still recognise it.",
    deliverable: "Write mask_email(email): if the text does not have exactly one @, or the part before it is empty, or the part after it has no dot, return null (None in Python). Otherwise keep the domain as it is. If the part before the @ has 1 or 2 characters, show its first character followed by one *. If it is longer, show its first character, then one * for each character in between, then its last character.",
    tags: ["Strings", "Privacy", "Edge cases"],
    cases: (rng) => [["asha.rao@kaarya.in"], ["om@mail.co.in"], ["x@y.com"], ["@kaarya.in"], ["no-at-sign.in"], ["a@b@c.in"], ["ravi@localhost"], ...Array.from({ length: 5 }, () => [`${rng.pick(["neha", "imran.k", "jo", "s", "lakshmi99"])}@${rng.pick(["kaarya.in", "mail.com", "college.edu.in"])}`])],
    solve: maskEmail as never,
  }),
  problem({
    id: "appdev-cart-summary", area: "functions-and-logic", difficulty: "medium", minLevel: "fresher", fn: "cart_summary", params: ["items"], requester: CAST.lead,
    title: "Build the order summary shown before checkout",
    scenario: "Hi, the cart sends us one line per tap, so the same product can appear several times, and a bug sometimes sends lines with quantity 0 or less. The summary screen needs one line per product and the totals, all in paise.",
    deliverable: "Write cart_summary(items). Each item is {sku, qty, price} where price is the unit price in paise. Ignore items with qty 0 or less. Merge items with the same sku, adding their qty and keeping the price of the first one seen. Return {lines, total_qty, total_paise}: lines is a list of {sku, qty, total} (total = qty × price) sorted by sku A to Z; total_qty and total_paise are the sums over the lines. An empty cart gives {lines: [], total_qty: 0, total_paise: 0}.",
    tags: ["Lists", "Dictionaries", "Sorting"],
    cases: (rng) => [[[{ sku: "MUG-02", qty: 1, price: 19900 }, { sku: "BAG-07", qty: 2, price: 59900 }, { sku: "MUG-02", qty: 2, price: 19900 }]], [[{ sku: "PEN-01", qty: 0, price: 4900 }]], [[]], [[{ sku: "CAP-03", qty: -2, price: 4900 }, { sku: "CAP-03", qty: 3, price: 4900 }]], ...Array.from({ length: 6 }, () => [cartItems(rng)])],
    solve: cartSummary as never,
  }),
  problem({
    id: "appdev-validate-signup", area: "api-handlers", difficulty: "easy", minLevel: "fresher", fn: "validate_signup", params: ["body"], requester: CAST.lead,
    title: "Validate the signup request before it is saved",
    scenario: "Hi, the signup endpoint saves whatever the app sends, so we have users with blank names and ages like '25' as text. Please write the validation step: it gets the JSON body and decides the response.",
    deliverable: "Write validate_signup(body). body is an object that may have name, email and age. name must be a string that is not empty after trimming spaces. email must be a string with no spaces and exactly one @, with at least one character before the @, and after it a part that contains a dot which is neither its first nor its last character. age must be a whole number (not text, not a decimal) from 18 to 100. If any field is invalid or missing, return {status: 422, body: {errors: [...]}} listing the invalid field names in the order name, email, age. Otherwise return {status: 201, body: {name: the trimmed name, email: the email in lower case, age}}.",
    tags: ["Validation", "HTTP status codes", "Request handling"],
    cases: (rng) => [[{ name: "Asha Rao", email: "Asha@Kaarya.in", age: 22 }], [{ name: "  ", email: "a@b", age: 17 }], [{}], [{ name: "Om", email: "om@mail.in", age: "25" }], [{ name: "Om", email: "om@mail.in", age: 18.5 }], ...Array.from({ length: 7 }, () => [signupBody(rng)])],
    solve: validateSignup as never,
  }),
  problem({
    id: "appdev-contacts-api", area: "api-handlers", difficulty: "medium", minLevel: "fresher", fn: "contacts_api", params: ["requests"], requester: CAST.product,
    title: "Handle the requests of the address book API",
    scenario: "Hello, the mobile team is building the address book screen against a fake server, and we keep disagreeing about what the real one will answer. Please write the request handling once so both sides can test against it.",
    deliverable: "Write contacts_api(requests). Each request is {method, path, body} (body may be missing). Return one {status, body} per request, in order, keeping contacts in memory. POST /contacts with a name that is a non-empty string after trimming and a phone that is a string of exactly 10 digits creates {id, name (trimmed), phone} with ids 1, 2, 3... and answers 201 with it; an invalid or missing field answers 422 {error: \"invalid contact\"}; a valid contact whose phone is already saved answers 409 {error: \"phone already exists\"} and saves nothing. GET /contacts answers 200 with the list in creation order. GET /contacts/{id} answers 200 with the contact; DELETE /contacts/{id} removes it and answers 204 with body null; both answer 404 {error: \"not found\"} if there is no such contact. Any other path is 404 {error: \"not found\"}; any other method on /contacts or /contacts/{id} is 405 {error: \"method not allowed\"}. A deleted contact's phone may be used again.",
    tags: ["REST", "Validation", "HTTP status codes"],
    cases: (rng) => [[[{ method: "POST", path: "/contacts", body: { name: " Asha ", phone: "9876543210" } }, { method: "GET", path: "/contacts/1" }]], [[{ method: "POST", path: "/contacts", body: { name: "Om", phone: "98765" } }, { method: "DELETE", path: "/contacts/1" }, { method: "PUT", path: "/contacts" }]], ...Array.from({ length: 8 }, () => [contactRequests(rng)])],
    solve: contactsApi as never,
  }),
  problem({
    id: "appdev-filter-products", area: "ui-state", difficulty: "easy", minLevel: "fresher", fn: "filter_products", params: ["products", "query", "in_stock_only"], requester: CAST.product,
    title: "Make the product search box and stock toggle work",
    scenario: "Hi, the product list page has a search box and an 'In stock only' toggle, but the list does not react to them yet. Please write the function the component calls to work out which products to show.",
    deliverable: "Write filter_products(products, query, in_stock_only). products is a list of {name, stock}. Keep a product when its name contains the query, ignoring upper/lower case and any spaces at the start or end of the query (an empty query matches every product), and, when in_stock_only is true, its stock is above 0. Return the names of the kept products in their original order.",
    tags: ["UI state", "Filtering", "Strings"],
    cases: (rng) => [[[{ name: "Steel Bottle", stock: 3 }, { name: "Desk Lamp", stock: 0 }], "bottle", false], [[{ name: "Steel Bottle", stock: 0 }, { name: "Water Bottle Cap", stock: 5 }], " BOTTLE ", true], [[], "lamp", false], [[{ name: "Notebook", stock: 0 }], "", false], ...Array.from({ length: 6 }, () => [productsCase(rng), rng.pick(["", "bottle", " lamp", "BOX", "zzz", "o"]), rng.chance(0.5)])],
    solve: filterProducts as never,
  }),
  problem({
    id: "appdev-cart-reducer", area: "ui-state", difficulty: "medium", minLevel: "fresher", fn: "cart_reducer", params: ["actions"], requester: CAST.lead,
    title: "Write the reducer behind the cart badge",
    scenario: "Hello, the cart badge and the cart drawer disagree after a few taps because each keeps its own copy of the state. We are moving to one reducer: given the actions the user took, it works out the cart.",
    deliverable: "Write cart_reducer(actions), starting from an empty cart and applying the actions in order. {type: \"add\", id, price} adds the product with quantity 1 (price in paise), or adds 1 to its quantity if it is already in the cart (keeping its first price). {type: \"remove\", id} removes it. {type: \"set_qty\", id, qty} sets its quantity, or removes it when qty is 0 or less; it does nothing if the product is not in the cart. {type: \"clear\"} empties the cart. Return {items, count, total}: items is a list of {id, qty} in the order products were first added (a product removed and added again goes to the end), count is the sum of quantities and total is the sum of qty × price.",
    tags: ["UI state", "Reducers", "Immutability"],
    cases: (rng) => [[[{ type: "add", id: "tea", price: 12000 }, { type: "add", id: "tea", price: 12000 }, { type: "add", id: "cup", price: 25000 }]], [[{ type: "add", id: "mat", price: 99900 }, { type: "set_qty", id: "mat", qty: 0 }]], [[]], [[{ type: "set_qty", id: "cup", qty: 3 }, { type: "clear" }]], ...Array.from({ length: 6 }, () => [actionsCase(rng)])],
    solve: cartReducer as never,
  }),
  problem({
    id: "appdev-debug-pin", area: "app-debugging", difficulty: "easy", minLevel: "fresher", fn: "is_valid_pin", params: ["pin"], requester: CAST.qa,
    title: "Fix: the address form accepts PIN codes with letters",
    scenario: "Hi, QA found that the delivery address form accepts '56A001' and '5600 1' as PIN codes and the courier rejects them later. The check below was written in a hurry. Please fix it.",
    deliverable: "Fix is_valid_pin(pin) so it returns true only when pin is a string of exactly 6 digits whose first digit is not 0, and false otherwise.",
    tags: ["Debugging", "Validation", "Strings"],
    cases: (rng) => [["560001"], ["56A001"], [""], ["012345"], ["5600 1"], ["4000011"], ...Array.from({ length: 6 }, () => [rng.pick([`${rng.int(1, 9)}${digits(rng, 5)}`, `${rng.int(1, 9)}${digits(rng, 4)}x`, `0${digits(rng, 5)}`, digits(rng, rng.int(4, 7))])])],
    solve: isValidPin as never,
    broken: {
      python: "def is_valid_pin(pin):\n    return len(pin) == 6 and pin[0] != \"0\"\n",
      javascript: "function is_valid_pin(pin) {\n  return pin.length === 6 && pin[0] !== \"0\";\n}\n",
    },
  }),
  problem({
    id: "appdev-debug-merge-settings", area: "app-debugging", difficulty: "medium", minLevel: "fresher", fn: "merge_settings", params: ["defaults", "overrides"], requester: CAST.support,
    title: "Fix: users cannot turn dark mode or notifications off",
    scenario: "Hello, users switch dark mode or notifications off in settings, save, and the app turns them straight back on. Setting the page size to 0 (meaning 'show all') does not stick either. The merge below is the suspect.",
    deliverable: "Fix merge_settings(defaults, overrides) so it returns a new object with every key of defaults: the value from overrides when overrides has that key and its value is not null (None in Python), otherwise the default. false, 0 and an empty string are real choices and must be kept. Keys in overrides that are not in defaults are ignored.",
    tags: ["Debugging", "Truthiness", "Objects"],
    cases: (rng) => [[DEFAULTS, { dark_mode: true }], [DEFAULTS, { notify: false, page_size: 0 }], [DEFAULTS, {}], [DEFAULTS, { language: null, theme: "blue" }], ...Array.from({ length: 6 }, () => [DEFAULTS, overridesCase(rng)])],
    solve: mergeSettings as never,
    broken: {
      python: "def merge_settings(defaults, overrides):\n    result = {}\n    for key in defaults:\n        result[key] = overrides.get(key) or defaults[key]\n    return result\n",
      javascript: "function merge_settings(defaults, overrides) {\n  const result = {};\n  for (const key of Object.keys(defaults)) {\n    result[key] = overrides[key] || defaults[key];\n  }\n  return result;\n}\n",
    },
  }),
];
