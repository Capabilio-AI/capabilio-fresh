import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { hashSeed, makeRng } from "../rng";
import { same } from "./compare";
import { CODE_PROBLEMS, EXAMPLE_COUNT, type Lang } from "./problems";

const PY: Record<string, string> = {
  clean_username: `import re
def clean_username(raw):
    return re.sub(r"[^a-z0-9_]", "", re.sub(r"\\s+", "_", raw.strip().lower()))`,
  bill_total: `def bill_total(items, gst_percent):
    s = sum(items)
    if s >= 100000:
        s -= s * 5 // 100
    return s + s * gst_percent // 100`,
  second_largest: `def second_largest(nums):
    d = sorted(set(nums), reverse=True)
    return d[1] if len(d) >= 2 else None`,
  top_words: `import re
from collections import Counter
def top_words(text, n):
    c = Counter(re.findall(r"[a-z]+", text.lower()))
    return sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))[:n]`,
  is_balanced: `def is_balanced(s):
    pairs = {")": "(", "]": "[", "}": "{"}
    st = []
    for ch in s:
        if ch in "([{":
            st.append(ch)
        elif ch in pairs:
            if not st or st.pop() != pairs[ch]:
                return False
    return not st`,
  merge_intervals: `def merge_intervals(intervals):
    out = []
    for a, b in sorted(intervals):
        if out and a <= out[-1][1]:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return out`,
  first_unique_char: `def first_unique_char(s):
    for i, ch in enumerate(s):
        if s.count(ch) == 1:
            return i
    return -1`,
  lru_hits: `def lru_hits(capacity, keys):
    cache, hits = [], 0
    for k in keys:
        if k in cache:
            hits += 1
            cache.remove(k)
        elif len(cache) == capacity:
            cache.pop(0)
        cache.append(k)
    return hits`,
  count_pairs: `def count_pairs(nums, target):
    seen, pairs = {}, 0
    for x in nums:
        pairs += seen.get(target - x, 0)
        seen[x] = seen.get(x, 0) + 1
    return pairs`,
  min_coins: `def min_coins(coins, amount):
    best = [0] + [float("inf")] * amount
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a:
                best[a] = min(best[a], best[a - c] + 1)
    return best[amount] if best[amount] != float("inf") else -1`,
  shortest_path: `from collections import deque
def shortest_path(grid):
    R, C = len(grid), len(grid[0])
    if grid[0][0] == "#" or grid[R-1][C-1] == "#":
        return -1
    dist = {(0, 0): 0}
    q = deque([(0, 0)])
    while q:
        r, c = q.popleft()
        if (r, c) == (R-1, C-1):
            return dist[(r, c)]
        for dr, dc in ((1,0),(-1,0),(0,1),(0,-1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < R and 0 <= nc < C and grid[nr][nc] == "." and (nr, nc) not in dist:
                dist[(nr, nc)] = dist[(r, c)] + 1
                q.append((nr, nc))
    return -1`,
  average_of_positive: `def average_of_positive(nums):
    pos = [n for n in nums if n > 0]
    return sum(pos) // len(pos) if pos else 0`,
  rotate_right: `def rotate_right(nums, k):
    if not nums:
        return []
    s = k % len(nums)
    return nums[-s:] + nums[:-s] if s else list(nums)`,
  binary_search: `def binary_search(values, target):
    return values.index(target) if target in values else -1`,
  todo_api: `import re
def todo_api(requests):
    items = {}
    nxt = 1
    out = []
    for r in requests:
        m = re.fullmatch(r"/todos(?:/(\\d+))?", r["path"])
        if not m:
            out.append({"status": 404, "body": {"error": "not found"}})
            continue
        tid = int(m.group(1)) if m.group(1) else None
        body = r.get("body") or {}
        method = r["method"]
        if tid is None and method == "POST":
            t = body.get("title")
            if not isinstance(t, str) or t.strip() == "":
                out.append({"status": 422, "body": {"error": "title required"}})
            else:
                todo = {"id": nxt, "title": t.strip(), "done": False}
                items[nxt] = todo
                nxt += 1
                out.append({"status": 201, "body": dict(todo)})
        elif tid is None and method == "GET":
            out.append({"status": 200, "body": [dict(t) for t in items.values()]})
        elif tid is None:
            out.append({"status": 405, "body": {"error": "method not allowed"}})
        elif tid not in items:
            out.append({"status": 404, "body": {"error": "not found"}})
        elif method == "GET":
            out.append({"status": 200, "body": dict(items[tid])})
        elif method == "PATCH":
            d = body.get("done")
            if not isinstance(d, bool):
                out.append({"status": 422, "body": {"error": "done must be a boolean"}})
            else:
                items[tid]["done"] = d
                out.append({"status": 200, "body": dict(items[tid])})
        elif method == "DELETE":
            del items[tid]
            out.append({"status": 204, "body": None})
        else:
            out.append({"status": 405, "body": {"error": "method not allowed"}})
    return out`,
  check_access: `def check_access(tokens, requests):
    out = []
    for r in requests:
        t = tokens.get(r["token"]) if r["token"] is not None else None
        if not t or r["now"] >= t["expires"]:
            out.append([401, None])
        elif r["path"].startswith("/admin") and t["role"] != "admin":
            out.append([403, t["user"]])
        else:
            out.append([200, t["user"]])
    return out`,
  idempotent_payments: `def idempotent_payments(requests):
    seen, nxt, out = {}, 1, []
    for r in requests:
        prior = seen.get(r["key"])
        if prior is None:
            seen[r["key"]] = (nxt, r["amount"])
            out.append([201, nxt])
            nxt += 1
        elif prior[1] == r["amount"]:
            out.append([200, prior[0]])
        else:
            out.append([409, None])
    return out`,
  retry_schedule: `def retry_schedule(max_retries, base_ms, outcomes):
    waited, i = 0, 0
    while True:
        outcome = outcomes[i] if i < len(outcomes) else "500"
        if outcome == "ok":
            return [i + 1, waited, "ok"]
        if outcome == "400" or i == max_retries:
            return [i + 1, waited, "failed"]
        waited += base_ms * 2 ** i
        i += 1`,
  paginate: `def paginate(items, page, page_size):
    total = -(-len(items) // page_size)
    start = (page - 1) * page_size
    return {"items": [] if page < 1 or page > total else items[start:start + page_size], "total_pages": total, "has_next": page < total}`,
};

const HARNESS = `import json, sys
d = json.load(sys.stdin)
ns = {}
exec(d["code"], ns)
f = ns[d["fn"]]
out = []
for args in d["cases"]:
    try:
        out.append({"ok": True, "value": f(*args)})
    except Exception as e:
        out.append({"ok": False, "error": str(e)})
print(json.dumps(out))`;

const runPython = (code: string, fn: string, cases: unknown[][]) =>
  JSON.parse(execFileSync("python3", ["-I", "-c", HARNESS], { input: JSON.stringify({ code, fn, cases }), encoding: "utf8", timeout: 60_000 })) as { ok: boolean; value?: unknown }[];

const runJs = (code: string, fn: string, cases: unknown[][]) => {
  const f = new Function(`${code}\n;return ${fn};`)() as (...a: unknown[]) => unknown;
  return cases.map((args) => {
    try {
      return { ok: true, value: JSON.parse(JSON.stringify(f(...JSON.parse(JSON.stringify(args))) ?? null)) };
    } catch (e) {
      return { ok: false, value: (e as Error).message };
    }
  });
};

const SEEDS = 3;
const matches = (outs: { ok: boolean; value?: unknown }[], expected: unknown[]) => outs.map((o, i) => o.ok && same(o.value, expected[i]));

describe("programming problems", () => {
  for (const p of CODE_PROBLEMS) {
    it(`${p.id}: builds the same ticket for the same seed, with enough cases`, () => {
      for (let i = 0; i < SEEDS; i++) {
        const a = p.build(makeRng(hashSeed("code", p.id, i)));
        expect(JSON.stringify(a)).toBe(JSON.stringify(p.build(makeRng(hashSeed("code", p.id, i)))));
        expect(a.content.cases.length).toBeGreaterThanOrEqual(EXAMPLE_COUNT + 8);
        expect(a.key.expected).toHaveLength(a.content.cases.length);
        expect(a.content.examples).toHaveLength(EXAMPLE_COUNT);
      }
    });

    it(`${p.id}: a correct Python solution agrees with the reference on every case`, () => {
      for (let i = 0; i < SEEDS; i++) {
        const d = p.build(makeRng(hashSeed("code", p.id, i)));
        const ok = matches(runPython(PY[d.content.fn], d.content.fn, d.content.cases), d.key.expected);
        expect(ok.every(Boolean), `${p.id} seed ${i} failed cases ${ok.map((v, j) => (v ? -1 : j)).filter((j) => j >= 0)}`).toBe(true);
      }
    }, 120_000);

    it(`${p.id}: the starter code is not already a correct answer`, () => {
      for (const lang of ["python", "javascript"] as Lang[]) {
        const d = p.build(makeRng(hashSeed("code", p.id, 0)));
        const outs = lang === "python" ? runPython(d.content.starters.python, d.content.fn, d.content.cases) : runJs(d.content.starters.javascript, d.content.fn, d.content.cases);
        const ok = matches(outs, d.key.expected);
        expect(ok.every(Boolean)).toBe(false);
        if (p.areas[0].endsWith("debugging")) expect(ok.some(Boolean), `${lang} starter should be only partly broken`).toBe(true);
      }
    }, 120_000);
  }
});
