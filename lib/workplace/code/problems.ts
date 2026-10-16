import type { ExperienceLevel } from "../level";
import type { Rng } from "../rng";
import type { Difficulty } from "@/lib/arena-workstations/types";

export type Lang = "python" | "javascript";
export const LANGUAGES: readonly Lang[] = ["python", "javascript"];
export const EXAMPLE_COUNT = 2;
export const MAX_SUBMISSIONS = 8;

type Json = unknown;
export interface Example {
  args: Json[];
  expected: Json;
}

/** What the user sees. The expected outputs of the cases beyond the examples stay on the server. */
export interface CodeContent {
  fn: string;
  params: string[];
  /** every case the notebook runs on submit: the examples first, then the hidden ones */
  cases: Json[][];
  examples: Example[];
  starters: Record<Lang, string>;
  deliverable: string;
  maxSubmissions: number;
  /** a slow solution is stopped after this long when running all cases */
  timeLimitSeconds: number;
}
export interface CodeKey {
  expected: Json[];
}
export interface CodeDraft {
  title: string;
  requester: { name: string; title: string };
  scenario: string;
  skillTags: string[];
  content: CodeContent;
  key: CodeKey;
}
export interface CodeProblem {
  id: string;
  areas: string[];
  difficulty: Difficulty;
  minLevel: ExperienceLevel;
  build(rng: Rng): CodeDraft;
}

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
  cases(rng: Rng): Json[][];
  solve(...args: never[]): Json;
  /** debugging tickets start from broken code instead of an empty function */
  broken?: Record<Lang, string>;
  timeLimitSeconds?: number;
}

const CAST = {
  ops: { name: "Nikhil Rao", title: "Operations Lead" },
  platform: { name: "Isha Bhatt", title: "Platform Engineering Manager" },
  finance: { name: "Vikram Rao", title: "Finance Controller" },
  support: { name: "Sana Khan", title: "Customer Success Lead" },
  growth: { name: "Rohan Mehta", title: "Growth Manager" },
};

const emptyStarter = (fn: string, params: string[]): Record<Lang, string> => ({
  python: `def ${fn}(${params.join(", ")}):\n    # write your solution here\n    pass\n`,
  javascript: `function ${fn}(${params.join(", ")}) {\n  // write your solution here\n}\n`,
});

function problem(s: Spec): CodeProblem {
  return {
    id: s.id,
    areas: [s.area],
    difficulty: s.difficulty,
    minLevel: s.minLevel,
    build(rng) {
      const cases = s.cases(rng);
      const expected = cases.map((c) => (s.solve as (...a: Json[]) => Json)(...c));
      return {
        title: s.title,
        requester: s.requester,
        scenario: s.scenario,
        skillTags: s.tags,
        content: {
          fn: s.fn, params: s.params, cases,
          examples: cases.slice(0, EXAMPLE_COUNT).map((args, i) => ({ args, expected: expected[i] })),
          starters: s.broken ?? emptyStarter(s.fn, s.params),
          deliverable: s.deliverable, maxSubmissions: MAX_SUBMISSIONS, timeLimitSeconds: s.timeLimitSeconds ?? 20,
        },
        key: { expected },
      };
    },
  };
}

const WORDS = ["order", "refund", "Delivery", "late", "Customer", "support", "ticket", "payment", "failed", "the", "and", "invoice", "again", "Order", "delivery", "was", "Refund"];
const sentence = (rng: Rng, n: number) => Array.from({ length: n }, () => rng.pick(WORDS) + rng.pick(["", "", ",", ".", "!"])).join(" ");
const ints = (rng: Rng, n: number, lo: number, hi: number) => Array.from({ length: n }, () => rng.int(lo, hi));
const edge = <T>(...fixed: T[][]) => fixed;

const clean = (raw: string) => raw.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
const billTotal = (items: number[], gst: number) => {
  let s = items.reduce((a, b) => a + b, 0);
  if (s >= 100000) s -= Math.floor((s * 5) / 100);
  return s + Math.floor((s * gst) / 100);
};
const secondLargest = (nums: number[]) => {
  const d = [...new Set(nums)].sort((a, b) => b - a);
  return d.length < 2 ? null : d[1];
};
const topWords = (text: string, n: number) => {
  const counts = new Map<string, number>();
  for (const w of text.toLowerCase().match(/[a-z]+/g) ?? []) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n);
};
const isBalanced = (s: string) => {
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: string[] = [];
  for (const ch of s) {
    if ("([{".includes(ch)) stack.push(ch);
    else if (ch in pairs && stack.pop() !== pairs[ch]) return false;
  }
  return stack.length === 0;
};
const mergeIntervals = (iv: number[][]) => {
  const out: number[][] = [];
  for (const [a, b] of [...iv].sort((x, y) => x[0] - y[0] || x[1] - y[1])) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
};
const firstUnique = (s: string) => {
  for (let i = 0; i < s.length; i++) if (s.indexOf(s[i]) === s.lastIndexOf(s[i])) return i;
  return -1;
};
const lruHits = (cap: number, keys: number[]) => {
  const cache: number[] = [];
  let hits = 0;
  for (const k of keys) {
    const at = cache.indexOf(k);
    if (at >= 0) {
      hits++;
      cache.splice(at, 1);
    } else if (cache.length === cap) cache.shift();
    cache.push(k);
  }
  return hits;
};
const countPairs = (nums: number[], target: number) => {
  const seen = new Map<number, number>();
  let pairs = 0;
  for (const x of nums) {
    pairs += seen.get(target - x) ?? 0;
    seen.set(x, (seen.get(x) ?? 0) + 1);
  }
  return pairs;
};
const minCoins = (coins: number[], amount: number) => {
  const best = new Array(amount + 1).fill(Infinity);
  best[0] = 0;
  for (let a = 1; a <= amount; a++) for (const c of coins) if (c <= a) best[a] = Math.min(best[a], best[a - c] + 1);
  return Number.isFinite(best[amount]) ? best[amount] : -1;
};
const shortestPath = (grid: string[]) => {
  const R = grid.length;
  const C = grid[0].length;
  if (grid[0][0] === "#" || grid[R - 1][C - 1] === "#") return -1;
  const dist = new Map<number, number>([[0, 0]]);
  const queue = [0];
  for (let q = 0; q < queue.length; q++) {
    const cur = queue[q];
    const [r, c] = [Math.floor(cur / C), cur % C];
    if (r === R - 1 && c === C - 1) return dist.get(cur)!;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const [nr, nc] = [r + dr, c + dc];
      const key = nr * C + nc;
      if (nr >= 0 && nr < R && nc >= 0 && nc < C && grid[nr][nc] === "." && !dist.has(key)) {
        dist.set(key, dist.get(cur)! + 1);
        queue.push(key);
      }
    }
  }
  return -1;
};
const avgPositive = (nums: number[]) => {
  const pos = nums.filter((n) => n > 0);
  return pos.length === 0 ? 0 : Math.floor(pos.reduce((a, b) => a + b, 0) / pos.length);
};
const rotateRight = (nums: number[], k: number) => {
  if (nums.length === 0) return [];
  const s = k % nums.length;
  return s === 0 ? [...nums] : [...nums.slice(-s), ...nums.slice(0, -s)];
};
const binarySearch = (a: number[], t: number) => a.indexOf(t);

const grid = (rng: Rng, r: number, c: number, wall: number) => Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => ((i === 0 && j === 0) || (i === r - 1 && j === c - 1) ? "." : rng.chance(wall) ? "#" : ".")).join(""));
const sortedUnique = (rng: Rng, n: number) => [...new Set(ints(rng, n * 2, 1, 400))].sort((a, b) => a - b).slice(0, n);

// ---- backend: API behaviour modelled as a pure function ----
type Req = { method: string; path: string; body?: unknown };
type Res = { status: number; body: unknown };
const req = (method: string, path: string, body?: unknown): Req => ({ method, path, ...(body === undefined ? {} : { body }) });
const todoApi = (reqs: Req[]): Res[] => {
  const items = new Map<number, { id: number; title: string; done: boolean }>();
  let next = 1;
  return reqs.map((r) => {
    const m = /^\/todos(?:\/(\d+))?$/.exec(r.path);
    if (!m) return { status: 404, body: { error: "not found" } };
    const id = m[1] ? Number(m[1]) : null;
    const body = (r.body ?? {}) as { title?: unknown; done?: unknown };
    if (id === null && r.method === "POST") {
      if (typeof body.title !== "string" || body.title.trim() === "") return { status: 422, body: { error: "title required" } };
      const todo = { id: next++, title: body.title.trim(), done: false };
      items.set(todo.id, todo);
      return { status: 201, body: { ...todo } };
    }
    if (id === null && r.method === "GET") return { status: 200, body: [...items.values()].map((t) => ({ ...t })) };
    if (id === null) return { status: 405, body: { error: "method not allowed" } };
    const todo = items.get(id);
    if (!todo) return { status: 404, body: { error: "not found" } };
    if (r.method === "GET") return { status: 200, body: { ...todo } };
    if (r.method === "PATCH") {
      if (typeof body.done !== "boolean") return { status: 422, body: { error: "done must be a boolean" } };
      todo.done = body.done;
      return { status: 200, body: { ...todo } };
    }
    if (r.method === "DELETE") {
      items.delete(id);
      return { status: 204, body: null };
    }
    return { status: 405, body: { error: "method not allowed" } };
  });
};
const todoRequests = (rng: Rng, n: number): Req[] =>
  Array.from({ length: n }, () =>
    rng.weighted<Req>([
      [req("POST", "/todos", { title: rng.pick(["Buy milk", "  Call Asha ", "Pay rent", "Book tickets"]) }), 30],
      [req("POST", "/todos", rng.pick([{}, { title: "   " }, { title: 5 }])), 8],
      [req("GET", "/todos"), 10],
      [req("GET", `/todos/${rng.int(1, 4)}`), 16],
      [req("PATCH", `/todos/${rng.int(1, 4)}`, { done: rng.chance(0.7) }), 14],
      [req("PATCH", `/todos/${rng.int(1, 4)}`, { done: "yes" }), 4],
      [req("DELETE", `/todos/${rng.int(1, 4)}`), 8],
      [req("PUT", "/todos"), 3],
      [req("GET", "/tasks"), 3],
    ] as const)
  );

const checkAccess = (tokens: Record<string, { user: string; role: string; expires: number }>, reqs: { token: string | null; path: string; now: number }[]) =>
  reqs.map((r) => {
    const t = r.token === null ? undefined : tokens[r.token];
    if (!t || r.now >= t.expires) return [401, null];
    if (r.path.startsWith("/admin") && t.role !== "admin") return [403, t.user];
    return [200, t.user];
  });
const idempotentPayments = (reqs: { key: string; amount: number }[]) => {
  const seen = new Map<string, { id: number; amount: number }>();
  let next = 1;
  return reqs.map((r) => {
    const prior = seen.get(r.key);
    if (!prior) {
      const rec = { id: next++, amount: r.amount };
      seen.set(r.key, rec);
      return [201, rec.id];
    }
    return prior.amount === r.amount ? [200, prior.id] : [409, null];
  });
};
const retrySchedule = (maxRetries: number, baseMs: number, outcomes: string[]) => {
  let waited = 0;
  for (let i = 0; ; i++) {
    const outcome = outcomes[i] ?? "500";
    if (outcome === "ok") return [i + 1, waited, "ok"];
    if (outcome === "400" || i === maxRetries) return [i + 1, waited, "failed"];
    waited += baseMs * 2 ** i;
  }
};
const paginate = (items: number[], page: number, size: number) => {
  const total = Math.ceil(items.length / size);
  const start = (page - 1) * size;
  return { items: page < 1 || page > total ? [] : items.slice(start, start + size), total_pages: total, has_next: page < total };
};

export const CODE_PROBLEMS: CodeProblem[] = [
  problem({
    id: "code-clean-username", area: "fundamentals", difficulty: "easy", minLevel: "fresher", fn: "clean_username", params: ["raw"], requester: CAST.platform,
    title: "Turn what people type into a safe username",
    scenario: "Hi, signup forms give us usernames like '  Priya  Sharma! ' and our system rejects them. I need a function that cleans whatever was typed into the form we store.",
    deliverable: "Write clean_username(raw): trim the text, make it lower case, turn every run of whitespace into a single underscore, and drop every character that is not a letter a-z, a digit or an underscore. Return the result.",
    tags: ["Strings", "Functions", "Text cleaning"],
    cases: (rng) => [["  Priya  Sharma! "], ["Ravi_Kumar99"], ...edge([""], ["   "], ["A-B C"]), ...Array.from({ length: 6 }, () => [" " + sentence(rng, 2).replace(/[,.!]/g, () => rng.pick(["", "#", "@", "."])) + "  "])],
    solve: clean as never,
  }),
  problem({
    id: "code-bill-total", area: "fundamentals", difficulty: "easy", minLevel: "fresher", fn: "bill_total", params: ["items", "gst_percent"], requester: CAST.finance,
    title: "Work out the final bill with discount and GST",
    scenario: "Hello, the checkout page and the invoice PDF show different totals. All prices are in paise (integers), so let's write the rule once and reuse it.",
    deliverable: "Write bill_total(items, gst_percent): items is a list of prices in paise. Add them up. If the subtotal is 100000 paise or more, take 5% off first, rounding the discount down. Then add GST at gst_percent of the discounted amount, rounding that down. Return the total in paise.",
    tags: ["Arithmetic", "Integer maths", "Business rules"],
    cases: (rng) => [[[49900, 25000, 12000], 18], [[60000, 55000], 12], ...edge<unknown>([[], 18], [[99999], 5], [[100000], 5]), ...Array.from({ length: 6 }, () => [ints(rng, rng.int(1, 12), 1000, 60000), rng.pick([5, 12, 18, 28])])],
    solve: billTotal as never,
  }),
  problem({
    id: "code-second-largest", area: "fundamentals", difficulty: "easy", minLevel: "fresher", fn: "second_largest", params: ["nums"], requester: CAST.growth,
    title: "Find the runner-up score",
    scenario: "Hi, the leaderboard needs the runner-up score of each contest. Several people can share the same score, and a contest might have too few different scores to have a runner-up.",
    deliverable: "Write second_largest(nums): return the second largest DISTINCT value in the list, or null (None in Python) if there are fewer than two distinct values.",
    tags: ["Lists", "Sets", "Edge cases"],
    cases: (rng) => [[[10, 20, 20, 5]], [[7, 7, 7]], ...edge<unknown>([[]], [[3]], [[-5, -1, -1, -9]]), ...Array.from({ length: 5 }, () => [ints(rng, rng.int(2, 15), -20, 50)])],
    solve: secondLargest as never,
  }),
  problem({
    id: "code-top-words", area: "fundamentals", difficulty: "medium", minLevel: "junior", fn: "top_words", params: ["text", "n"], requester: CAST.support,
    title: "What are customers writing about most?",
    scenario: "Hello, I want a quick view of the words that appear most in customer messages. Capital letters and punctuation should not make 'Refund', 'refund,' and 'REFUND' count as different words.",
    deliverable: "Write top_words(text, n): split the text into words made only of the letters a-z (ignoring case, so everything else separates words), count them, and return the n most frequent as a list of [word, count] pairs, most frequent first. Ties are broken alphabetically. If there are fewer than n different words, return all of them.",
    tags: ["Strings", "Dictionaries", "Sorting"],
    cases: (rng) => [["Refund, refund! The order was late. Order again?", 2], ["a b a c b a", 3], ...edge<unknown>(["", 3], ["!!! ???", 2]), ...Array.from({ length: 6 }, () => [sentence(rng, rng.int(5, 40)), rng.int(1, 5)])],
    solve: topWords as never,
  }),
  problem({
    id: "code-is-balanced", area: "data-structures", difficulty: "medium", minLevel: "junior", fn: "is_balanced", params: ["s"], requester: CAST.platform,
    title: "Check the brackets in a formula",
    scenario: "Hi, our pricing formulas are typed by hand and a missing bracket breaks the whole sheet. Can you write a checker that tells us whether the brackets are matched properly?",
    deliverable: "Write is_balanced(s): return true if every (, [ and { in the text is closed by the matching bracket in the right order, and false otherwise. Other characters are ignored.",
    tags: ["Stacks", "Strings"],
    cases: (rng) => [["(a+b)*[c-{d}]"], ["(]"], ...edge<unknown>([""], ["(("], ["))(("], ["{[()]}"]), ...Array.from({ length: 6 }, () => [Array.from({ length: rng.int(2, 14) }, () => rng.pick(["(", ")", "[", "]", "{", "}", "x", "+"])).join("")]), ...Array.from({ length: 3 }, () => { const open = Array.from({ length: rng.int(1, 6) }, () => rng.pick(["(", "[", "{"])); const close = [...open].reverse().map((o) => ({ "(": ")", "[": "]", "{": "}" })[o]); return [open.join("") + "x" + close.join("")]; })],
    solve: isBalanced as never,
  }),
  problem({
    id: "code-merge-intervals", area: "data-structures", difficulty: "medium", minLevel: "junior", fn: "merge_intervals", params: ["intervals"], requester: CAST.ops,
    title: "Merge overlapping delivery slots",
    scenario: "Hello, drivers log their working slots as [start, end] hours and the same time often gets recorded twice. For payroll I need the overlapping or touching slots merged into one.",
    deliverable: "Write merge_intervals(intervals): given a list of [start, end] pairs, return a list of merged pairs sorted by start. Two slots that overlap, or where one ends exactly when the next starts, become one slot.",
    tags: ["Sorting", "Lists", "Intervals"],
    cases: (rng) => [[[[1, 3], [2, 6], [8, 10], [15, 18]]], [[[1, 4], [4, 5]]], ...edge<unknown>([[]], [[[5, 7]]]), ...Array.from({ length: 6 }, () => [Array.from({ length: rng.int(2, 10) }, () => { const a = rng.int(0, 40); return [a, a + rng.int(0, 8)]; })])],
    solve: mergeIntervals as never,
  }),
  problem({
    id: "code-first-unique", area: "data-structures", difficulty: "easy", minLevel: "fresher", fn: "first_unique_char", params: ["s"], requester: CAST.support,
    title: "Find the first character that appears only once",
    scenario: "Hi, we generate short reference codes and want to spot the first character that is not repeated anywhere else in the code.",
    deliverable: "Write first_unique_char(s): return the index of the first character that appears exactly once in s, or -1 if there is none.",
    tags: ["Strings", "Hash maps"],
    cases: (rng) => [["leetcode"], ["aabb"], ...edge<unknown>([""], ["z"]), ...Array.from({ length: 6 }, () => [Array.from({ length: rng.int(2, 14) }, () => rng.pick("abcdefg".split(""))).join("")])],
    solve: firstUnique as never,
  }),
  problem({
    id: "code-lru-hits", area: "data-structures", difficulty: "hard", minLevel: "mid", fn: "lru_hits", params: ["capacity", "keys"], requester: CAST.platform,
    title: "How well would a small cache do?",
    scenario: "Hello, before we add a cache in front of the product service I want to know how many requests it would have saved. The cache keeps the most recently used items and throws away the least recently used one when it is full.",
    deliverable: "Write lru_hits(capacity, keys): simulate an LRU cache of that capacity on the sequence of requested keys and return how many requests were hits (the key was already in the cache). A hit makes that key the most recently used; a miss adds it, evicting the least recently used key if the cache is full.",
    tags: ["Caching", "Data structures", "Simulation"],
    cases: (rng) => [[2, [1, 2, 1, 3, 2, 1]], [1, [4, 4, 4]], ...edge<unknown>([3, []]), ...Array.from({ length: 7 }, () => [rng.int(1, 5), ints(rng, rng.int(5, 40), 1, 8)])],
    solve: lruHits as never,
  }),
  problem({
    id: "code-count-pairs", area: "algorithms", difficulty: "medium", minLevel: "junior", fn: "count_pairs", params: ["nums", "target"], requester: CAST.finance, timeLimitSeconds: 25,
    title: "Count the payments that add up to a target",
    scenario: "Hi, to reconcile a bank statement I need to know how many pairs of payments add up to a given amount. The real files are big, so the first version that loops over every pair will be too slow.",
    deliverable: "Write count_pairs(nums, target): return how many pairs of positions i < j have nums[i] + nums[j] == target. The list can have up to 15,000 numbers.",
    tags: ["Hash maps", "Time complexity", "Arrays"],
    cases: (rng) => [[[1, 5, 3, 3, 5], 6], [[2, 2, 2], 4], ...edge<unknown>([[], 5], [[5], 10]), ...Array.from({ length: 5 }, () => [ints(rng, rng.int(5, 30), 1, 12), rng.int(5, 20)]), [ints(rng, 15000, 1, 5000), 5000]],
    solve: countPairs as never,
  }),
  problem({
    id: "code-min-coins", area: "algorithms", difficulty: "hard", minLevel: "mid", fn: "min_coins", params: ["coins", "amount"], requester: CAST.finance,
    title: "Pay an amount with the fewest notes and coins",
    scenario: "Hello, our cash counters stock only a few denominations and I want the cashier to hand over the fewest pieces for any amount. Taking the biggest note first does not always work.",
    deliverable: "Write min_coins(coins, amount): return the smallest number of coins (each denomination can be used any number of times) that add up to amount, or -1 if it cannot be done. amount 0 needs 0 coins.",
    tags: ["Dynamic programming", "Optimisation"],
    cases: (rng) => [[[1, 5, 10], 27], [[5, 10], 3], ...edge<unknown>([[3, 4], 0], [[1, 3, 4], 6]), ...Array.from({ length: 6 }, () => [[...new Set(ints(rng, rng.int(2, 4), 2, 25))], rng.int(1, 200)])],
    solve: minCoins as never,
  }),
  problem({
    id: "code-shortest-path", area: "algorithms", difficulty: "hard", minLevel: "mid", fn: "shortest_path", params: ["grid"], requester: CAST.ops,
    title: "How far must the picker walk in the warehouse?",
    scenario: "Hi, the warehouse floor is a grid where '.' is free floor and '#' is a shelf. A picker starts at the top-left corner and must reach the bottom-right corner, moving up, down, left or right. I want the shortest walk.",
    deliverable: "Write shortest_path(grid): grid is a list of equal-length strings. Return the minimum number of steps from the top-left to the bottom-right cell using only '.' cells, or -1 if there is no way (including when either corner is a shelf).",
    tags: ["Graphs", "BFS", "Grids"],
    cases: (rng) => [[["..#", "#..", "..."]], [["..", "#."]], ...edge<unknown>([["."]], [["#."]], [[".#", "#."]]), ...Array.from({ length: 6 }, () => [grid(rng, rng.int(3, 9), rng.int(3, 9), 0.28)])],
    solve: shortestPath as never,
  }),
  problem({
    id: "code-debug-average-positive", area: "debugging", difficulty: "easy", minLevel: "fresher", fn: "average_of_positive", params: ["nums"], requester: CAST.growth,
    title: "Fix: the average of good ratings is too low",
    scenario: "Hello, this function should give the average of the positive ratings only (zero and negative values mean 'no rating'), rounded down. The dashboard shows numbers that are too low and I do not know why.",
    deliverable: "Fix average_of_positive(nums) so it returns the average of the values greater than zero, rounded down to a whole number, and 0 when there are none.",
    tags: ["Debugging", "Lists", "Averages"],
    cases: (rng) => [[[4, 5, 0, 0, 3]], [[0, -2]], ...edge<unknown>([[]], [[7]]), ...Array.from({ length: 7 }, () => [ints(rng, rng.int(1, 12), -3, 10)])],
    solve: avgPositive as never,
    broken: {
      python: "def average_of_positive(nums):\n    total = 0\n    for n in nums:\n        if n > 0:\n            total += n\n    return total // len(nums)\n",
      javascript: "function average_of_positive(nums) {\n  let total = 0;\n  for (const n of nums) {\n    if (n > 0) total += n;\n  }\n  return Math.floor(total / nums.length);\n}\n",
    },
  }),
  problem({
    id: "code-debug-rotate", area: "debugging", difficulty: "medium", minLevel: "junior", fn: "rotate_right", params: ["nums", "k"], requester: CAST.ops,
    title: "Fix: the shift roster rotates wrongly",
    scenario: "Hi, our roster moves everyone k places to the right each week, and the last people wrap round to the front. It works for small k but gives the wrong roster in some weeks.",
    deliverable: "Fix rotate_right(nums, k) so it returns the list rotated k places to the right (k can be 0 or bigger than the list). An empty list stays empty.",
    tags: ["Debugging", "Lists", "Edge cases"],
    cases: (rng) => [[[1, 2, 3, 4, 5], 2], [[1, 2, 3], 0], ...edge<unknown>([[], 3], [[9], 4]), ...Array.from({ length: 7 }, () => [ints(rng, rng.int(2, 9), 1, 30), rng.int(0, 15)])],
    solve: rotateRight as never,
    broken: {
      python: "def rotate_right(nums, k):\n    return nums[-k:] + nums[:-k]\n",
      javascript: "function rotate_right(nums, k) {\n  return nums.slice(-k).concat(nums.slice(0, -k));\n}\n",
    },
  }),
  problem({
    id: "code-debug-binary-search", area: "debugging", difficulty: "medium", minLevel: "junior", fn: "binary_search", params: ["values", "target"], requester: CAST.platform,
    title: "Fix: the lookup sometimes misses a value that is there",
    scenario: "Hello, this binary search over a sorted list of unique ids sometimes says 'not found' for an id that is definitely in the list. It must be an off-by-one somewhere.",
    deliverable: "Fix binary_search(values, target) so it returns the index of target in the sorted list of unique numbers, or -1 if it is not there.",
    tags: ["Debugging", "Binary search", "Off-by-one"],
    cases: (rng) => [[[2, 5, 9, 14], 9], [[3], 3], ...edge<unknown>([[], 1], [[1, 2], 2]), ...Array.from({ length: 7 }, () => { const v = sortedUnique(rng, rng.int(2, 12)); return [v, rng.chance(0.6) ? rng.pick(v) : rng.int(1, 400)]; })],
    solve: binarySearch as never,
    broken: {
      python: "def binary_search(values, target):\n    lo, hi = 0, len(values) - 1\n    while lo < hi:\n        mid = (lo + hi) // 2\n        if values[mid] == target:\n            return mid\n        if values[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1\n",
      javascript: "function binary_search(values, target) {\n  let lo = 0, hi = values.length - 1;\n  while (lo < hi) {\n    const mid = Math.floor((lo + hi) / 2);\n    if (values[mid] === target) return mid;\n    if (values[mid] < target) lo = mid + 1;\n    else hi = mid - 1;\n  }\n  return -1;\n}\n",
    },
  }),
  problem({
    id: "backend-todo-api", area: "rest-api", difficulty: "medium", minLevel: "junior", fn: "todo_api", params: ["requests"], requester: CAST.platform,
    title: "Build the to-do list API's request handling",
    scenario: "Hi, we are prototyping a small to-do API and want to agree its behaviour before anyone writes a server. Please write the logic that turns a list of requests into the list of responses the API would send.",
    deliverable: "Write todo_api(requests). Each request is an object {method, path, body} (body may be missing); return one response {status, body} per request, in order, keeping the to-dos in memory. POST /todos with a non-empty string title creates {id, title (trimmed), done: false} with ids 1, 2, 3... and answers 201; a missing, non-string or blank title answers 422 with body {error: \"title required\"}. GET /todos answers 200 with the list in creation order. GET /todos/{id} answers 200 with the to-do, or 404 with {error: \"not found\"}. PATCH /todos/{id} with a boolean done sets it and answers 200 with the updated to-do (422 with {error: \"done must be a boolean\"} otherwise; a missing to-do is 404 first). DELETE /todos/{id} answers 204 with body null, or 404 if missing. Any other path is 404 {error: \"not found\"}; any other method on a known path is 405 {error: \"method not allowed\"}. A response body is a copy of the to-do at that moment.",
    tags: ["REST", "HTTP status codes", "Validation"],
    cases: (rng) => [[[req("POST", "/todos", { title: "Buy milk" }), req("GET", "/todos/1")]], [[req("POST", "/todos", { title: " " }), req("GET", "/todos"), req("DELETE", "/todos/9")]], ...Array.from({ length: 8 }, () => [todoRequests(rng, rng.int(5, 12))])],
    solve: todoApi as never,
  }),
  problem({
    id: "backend-check-access", area: "auth-and-security", difficulty: "medium", minLevel: "junior", fn: "check_access", params: ["tokens", "requests"], requester: CAST.platform,
    title: "Decide who may call which endpoint",
    scenario: "Hello, our gateway must answer 401 or 403 correctly and we keep mixing them up. Here is how tokens work; please write the decision logic.",
    deliverable: "Write check_access(tokens, requests). tokens maps a token string to {user, role, expires}. Each request is {token, path, now} (token may be null). Return one [status, user] pair per request: a missing, null or unknown token, or one with now >= expires, gives [401, null]; otherwise a path starting with /admin needs role \"admin\", else the answer is [403, user]; everything else is [200, user].",
    tags: ["Authentication", "Authorisation", "HTTP status codes"],
    cases: (rng) => {
      const make = () => {
        const tokens: Record<string, { user: string; role: string; expires: number }> = { t1: { user: "asha", role: "admin", expires: 100 }, t2: { user: "ravi", role: "member", expires: 50 }, t3: { user: "meera", role: "member", expires: 10 } };
        return [tokens, Array.from({ length: rng.int(4, 9) }, () => ({ token: rng.pick(["t1", "t2", "t3", "zzz", null]), path: rng.pick(["/orders", "/admin/users", "/admin", "/profile"]), now: rng.int(0, 120) }))];
      };
      return Array.from({ length: 10 }, make);
    },
    solve: checkAccess as never,
  }),
  problem({
    id: "backend-idempotent-payments", area: "data-and-state", difficulty: "medium", minLevel: "junior", fn: "idempotent_payments", params: ["requests"], requester: CAST.finance,
    title: "Stop retried payments from charging twice",
    scenario: "Hi, customers on bad networks tap Pay twice and are charged twice. We want idempotency keys: a retry with the same key must not create a second payment.",
    deliverable: "Write idempotent_payments(requests). Each request is {key, amount}. Return one [status, payment_id] per request, in order. A key not seen before creates a payment with the next id (1, 2, 3...) and answers [201, id]. The same key with the same amount again answers [200, the original id]. The same key with a different amount answers [409, null] and creates nothing.",
    tags: ["Idempotency", "State", "HTTP status codes"],
    cases: (rng) => Array.from({ length: 10 }, () => [Array.from({ length: rng.int(3, 10) }, () => ({ key: rng.pick(["a", "b", "c", "d"]), amount: rng.pick([100, 250, 100, 500]) }))]),
    solve: idempotentPayments as never,
  }),
  problem({
    id: "backend-retry-schedule", area: "error-handling", difficulty: "medium", minLevel: "junior", fn: "retry_schedule", params: ["max_retries", "base_ms", "outcomes"], requester: CAST.ops,
    title: "Work out how a client retries a flaky service",
    scenario: "Hello, the client library retries failed calls with exponential backoff, and support wants to know how long a customer waits in the worst case. Please simulate it.",
    deliverable: "Write retry_schedule(max_retries, base_ms, outcomes). outcomes[i] is what attempt i (counting from 0) returns: \"ok\", \"500\", \"timeout\" or \"400\"; attempts beyond the list return \"500\". An \"ok\" ends successfully. A \"400\" is a client error and is never retried. A \"500\" or \"timeout\" is retried after waiting base_ms * 2^i milliseconds (i is the attempt that just failed), at most max_retries times; after the last allowed retry fails, give up. Return [attempts_made, total_wait_ms, \"ok\" or \"failed\"].",
    tags: ["Retries", "Exponential backoff", "Error handling"],
    cases: (rng) => [[3, 100, ["500", "ok"]], [2, 50, ["400"]], ...Array.from({ length: 8 }, () => [rng.int(0, 5), rng.pick([10, 50, 100, 200]), Array.from({ length: rng.int(0, 6) }, () => rng.pick(["ok", "500", "timeout", "400", "500"]))])],
    solve: retrySchedule as never,
  }),
  problem({
    id: "backend-debug-paginate", area: "backend-debugging", difficulty: "medium", minLevel: "junior", fn: "paginate", params: ["items", "page", "page_size"], requester: CAST.platform,
    title: "Fix: the list endpoint skips the first page",
    scenario: "Hi, the mobile app's list screen never shows the first few items and the page count looks wrong. Pages are numbered from 1 in our API. Please fix the pagination.",
    deliverable: "Fix paginate(items, page, page_size) so it returns {items, total_pages, has_next}: pages are numbered from 1; total_pages is the number of pages needed (rounded up, 0 for an empty list); items is that page's slice, or an empty list when the page is below 1 or beyond the last page; has_next is true when a later page exists.",
    tags: ["Debugging", "Pagination", "Off-by-one"],
    cases: (rng) => [[[1, 2, 3, 4, 5], 1, 2], [[1, 2, 3], 2, 3], ...Array.from({ length: 8 }, () => [ints(rng, rng.int(0, 12), 1, 50), rng.int(0, 5), rng.int(1, 4)])],
    solve: paginate as never,
    broken: {
      python: "def paginate(items, page, page_size):\n    total = len(items) // page_size\n    start = page * page_size\n    return {\"items\": items[start:start + page_size], \"total_pages\": total, \"has_next\": page < total}\n",
      javascript: "function paginate(items, page, page_size) {\n  const total = Math.floor(items.length / page_size);\n  const start = page * page_size;\n  return { items: items.slice(start, start + page_size), total_pages: total, has_next: page < total };\n}\n",
    },
  }),
];
