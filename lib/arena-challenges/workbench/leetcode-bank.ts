// LeetCode-style problems written by us (no AI): 28 problem families, each with parameters that change the problem itself (a different divisor pair,
// coin set, step set, move rule ...). A family has TWO independent Python solutions (`ref` and `alt`); scripts/it-leetcode-bulk.mts runs both on the
// small tests and only stores a problem when they agree on every one. Students write their own solution in any language; tests are stdin/stdout.
import { makeRng, type Rng } from "@/lib/workplace/rng";

export type Difficulty = "easy" | "medium" | "hard";

export interface ProblemDef {
  title: string;
  topic: string;
  difficulty: Difficulty;
  statement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string[];
  explanations: [string, string];
  /** main solution, reads stdin, prints the answer */
  ref: string;
  /** independent second solution, used to cross-check `ref` on the small tests */
  alt: string;
  /** stdin for every test: the first two are the examples; the first four are small enough for `alt` */
  inputs: string[];
}

type Gen = (rng: Rng, small: boolean) => string;
interface Variant { title: string; statement: string; constraints?: string[]; ref: string; alt: string; gen: Gen; difficulty?: Difficulty }
interface Family { key: string; topic: string; difficulty: Difficulty; inputFormat: string; outputFormat: string; constraints: string[]; variants: Variant[] }

const nums = (rng: Rng, n: number, lo: number, hi: number) => Array.from({ length: n }, () => rng.int(lo, hi));
const lineOf = (xs: (number | string)[]) => xs.join(" ");
const words = ["tea", "eat", "ate", "tan", "nat", "bat", "tab", "cab", "abc", "bca", "dog", "god", "odg", "map", "pam", "cat", "act", "tac", "sun", "nus"];
const T = (s: string) => s.trim() + "\n";

const FAMILIES: Family[] = [
  { key: "multiples", topic: "Math", difficulty: "easy", inputFormat: "One integer n.", outputFormat: "One integer.", constraints: ["1 <= n <= 10^9"],
    variants: ([[3, 5], [2, 7], [4, 6], [3, 7], [5, 11], [6, 10], [4, 9], [8, 12]] as const).map(([a, b]) => ({
      title: `Multiples of ${a} or ${b}`, statement: `Count the integers from 1 to n (inclusive) that are divisible by ${a} or by ${b} (or both).`,
      ref: `from math import gcd\nn = int(input())\nl = ${a} * ${b} // gcd(${a}, ${b})\nprint(n // ${a} + n // ${b} - n // l)\n`,
      alt: `n = int(input())\nprint(sum(1 for x in range(1, n + 1) if x % ${a} == 0 or x % ${b} == 0))\n`,
      gen: (rng, small) => `${small ? rng.int(1, 300) : rng.pick([10 ** 9, rng.int(10 ** 6, 10 ** 9), 1000000])}\n` })) },
  { key: "sum-multiples", topic: "Math", difficulty: "easy", inputFormat: "One integer n.", outputFormat: "One integer.", constraints: ["1 <= n <= 10^7"],
    variants: ([[3, 5], [2, 3], [4, 7], [5, 9], [6, 8], [7, 11], [3, 10], [2, 9]] as const).map(([a, b]) => ({
      title: `Sum of multiples of ${a} or ${b} below n`, statement: `Print the sum of all positive integers LESS than n that are divisible by ${a} or by ${b}.`,
      ref: `n = int(input())\ndef s(k):\n    m = (n - 1) // k\n    return k * m * (m + 1) // 2\nfrom math import gcd\nprint(s(${a}) + s(${b}) - s(${a} * ${b} // gcd(${a}, ${b})))\n`,
      alt: `n = int(input())\nprint(sum(x for x in range(1, n) if x % ${a} == 0 or x % ${b} == 0))\n`,
      gen: (rng, small) => `${small ? rng.int(1, 200) : rng.int(5000, 3000000)}\n` })) },
  { key: "kth", topic: "Sorting", difficulty: "easy", inputFormat: "Line 1: n and k. Line 2: n integers.", outputFormat: "One integer.", constraints: ["1 <= n <= 10^5", "k is valid for the list"],
    variants: [
      { title: "K-th smallest value", statement: "Print the k-th smallest value of the list (counting repeated values separately, so the list 1 1 2 has 2 as its 3rd smallest).",
        ref: "n, k = map(int, input().split())\na = sorted(map(int, input().split()))\nprint(a[k - 1])\n",
        alt: "import heapq\nn, k = map(int, input().split())\na = list(map(int, input().split()))\nprint(heapq.nsmallest(k, a)[-1])\n",
        gen: (rng, small) => { const n = small ? rng.int(1, 8) : rng.int(20, 3000); return `${n} ${rng.int(1, n)}\n${lineOf(nums(rng, n, -50, 50))}\n`; } },
      { title: "K-th smallest DISTINCT value", statement: "Print the k-th smallest DISTINCT value of the list (each value counted once). k never exceeds the number of distinct values.",
        ref: "n, k = map(int, input().split())\na = sorted(set(map(int, input().split())))\nprint(a[k - 1])\n",
        alt: "n, k = map(int, input().split())\na = list(map(int, input().split()))\nu = []\nfor x in sorted(a):\n    if not u or u[-1] != x:\n        u.append(x)\nprint(u[k - 1])\n",
        gen: (rng, small) => { const n = small ? rng.int(2, 8) : rng.int(20, 3000); const a = nums(rng, n, -20, 20); const d = new Set(a).size; return `${n} ${rng.int(1, d)}\n${lineOf(a)}\n`; } },
    ] },
  { key: "lis", topic: "Dynamic programming", difficulty: "medium", inputFormat: "Line 1: n. Line 2: n integers.", outputFormat: "One integer.", constraints: ["1 <= n <= 2000"],
    variants: [
      { title: "Longest strictly increasing subsequence", statement: "Print the length of the longest subsequence whose values are STRICTLY increasing (elements need not be adjacent).",
        ref: "from bisect import bisect_left\nn = int(input())\ntails = []\nfor x in map(int, input().split()):\n    i = bisect_left(tails, x)\n    if i == len(tails): tails.append(x)\n    else: tails[i] = x\nprint(len(tails))\n",
        alt: "n = int(input())\na = list(map(int, input().split()))\nbest = [1] * n\nfor i in range(n):\n    for j in range(i):\n        if a[j] < a[i]: best[i] = max(best[i], best[j] + 1)\nprint(max(best))\n",
        gen: (rng, small) => { const n = small ? rng.int(1, 9) : rng.int(50, 1500); return `${n}\n${lineOf(nums(rng, n, -30, 60))}\n`; } },
      { title: "Longest non-decreasing subsequence", statement: "Print the length of the longest subsequence whose values never decrease (equal neighbours are allowed; elements need not be adjacent).",
        ref: "from bisect import bisect_right\nn = int(input())\ntails = []\nfor x in map(int, input().split()):\n    i = bisect_right(tails, x)\n    if i == len(tails): tails.append(x)\n    else: tails[i] = x\nprint(len(tails))\n",
        alt: "n = int(input())\na = list(map(int, input().split()))\nbest = [1] * n\nfor i in range(n):\n    for j in range(i):\n        if a[j] <= a[i]: best[i] = max(best[i], best[j] + 1)\nprint(max(best))\n",
        gen: (rng, small) => { const n = small ? rng.int(1, 9) : rng.int(50, 1500); return `${n}\n${lineOf(nums(rng, n, -10, 15))}\n`; } },
    ] },
  { key: "pairs", topic: "Hashing", difficulty: "medium", inputFormat: "Line 1: n and t. Line 2: n integers.", outputFormat: "One integer.", constraints: ["1 <= n <= 10^5"],
    variants: [
      { title: "Count pairs with a given sum", statement: "Count the pairs of positions i < j whose values add up to t.",
        ref: "from collections import Counter\nn, t = map(int, input().split())\nc = Counter()\ntotal = 0\nfor x in map(int, input().split()):\n    total += c[t - x]\n    c[x] += 1\nprint(total)\n",
        alt: "n, t = map(int, input().split())\na = list(map(int, input().split()))\nprint(sum(1 for i in range(n) for j in range(i + 1, n) if a[i] + a[j] == t))\n",
        gen: (rng, small) => { const n = small ? rng.int(1, 9) : rng.int(50, 4000); return `${n} ${rng.int(-10, 25)}\n${lineOf(nums(rng, n, -10, 15))}\n`; } },
      { title: "Count pairs with a given difference", statement: "Count the pairs of positions i < j whose values differ by exactly d in absolute value (|a[i] - a[j]| = d).",
        ref: "from collections import Counter\nn, d = map(int, input().split())\nc = Counter()\ntotal = 0\nfor x in map(int, input().split()):\n    total += c[x - d] + (c[x + d] if d else 0)\n    c[x] += 1\nprint(total)\n",
        alt: "n, d = map(int, input().split())\na = list(map(int, input().split()))\nprint(sum(1 for i in range(n) for j in range(i + 1, n) if abs(a[i] - a[j]) == d))\n",
        gen: (rng, small) => { const n = small ? rng.int(1, 9) : rng.int(50, 4000); return `${n} ${rng.int(0, 6)}\n${lineOf(nums(rng, n, -10, 15))}\n`; } },
    ] },
  { key: "subarray-k", topic: "Prefix sums", difficulty: "medium", inputFormat: "Line 1: n and k. Line 2: n integers (may be negative).", outputFormat: "One integer.", constraints: ["1 <= n <= 10^5"],
    variants: [{ title: "Subarrays with sum K", statement: "Count the contiguous, non-empty subarrays whose elements add up to exactly k.",
      ref: "from collections import Counter\nn, k = map(int, input().split())\nseen = Counter({0: 1})\ns = total = 0\nfor x in map(int, input().split()):\n    s += x\n    total += seen[s - k]\n    seen[s] += 1\nprint(total)\n",
      alt: "n, k = map(int, input().split())\na = list(map(int, input().split()))\nprint(sum(1 for i in range(n) for j in range(i, n) if sum(a[i:j + 1]) == k))\n",
      gen: (rng, small) => { const n = small ? rng.int(1, 9) : rng.int(50, 2500); return `${n} ${rng.int(-5, 12)}\n${lineOf(nums(rng, n, -4, 6))}\n`; } }] },
  { key: "window", topic: "Strings", difficulty: "medium", inputFormat: "One string of lowercase letters.", outputFormat: "One integer.", constraints: ["1 <= length <= 10^5"],
    variants: [
      { title: "Longest substring without repeating characters", statement: "Print the length of the longest substring in which no character appears twice.",
        ref: "s = input().strip()\nlast = {}\nbest = start = 0\nfor i, ch in enumerate(s):\n    if ch in last and last[ch] >= start: start = last[ch] + 1\n    last[ch] = i\n    best = max(best, i - start + 1)\nprint(best)\n",
        alt: "s = input().strip()\nbest = 0\nfor i in range(len(s)):\n    seen = set()\n    for j in range(i, len(s)):\n        if s[j] in seen: break\n        seen.add(s[j])\n    best = max(best, len(seen))\nprint(best)\n",
        gen: (rng, small) => { const n = small ? rng.int(1, 12) : rng.int(200, 5000); return T(Array.from({ length: n }, () => rng.pick([..."abcdefgh"])).join("")); } },
      { title: "Longest substring with at most two distinct characters", statement: "Print the length of the longest substring that contains at most two different characters.",
        ref: "from collections import Counter\ns = input().strip()\nc = Counter()\nl = best = 0\nfor r, ch in enumerate(s):\n    c[ch] += 1\n    while len(c) > 2:\n        c[s[l]] -= 1\n        if c[s[l]] == 0: del c[s[l]]\n        l += 1\n    best = max(best, r - l + 1)\nprint(best)\n",
        alt: "s = input().strip()\nbest = 0\nfor i in range(len(s)):\n    for j in range(i, len(s)):\n        if len(set(s[i:j + 1])) <= 2: best = max(best, j - i + 1)\nprint(best)\n",
        gen: (rng, small) => { const n = small ? rng.int(1, 12) : rng.int(200, 3000); return T(Array.from({ length: n }, () => rng.pick([..."abcdef"])).join("")); } },
    ] },
  { key: "parens", topic: "Stacks", difficulty: "easy", inputFormat: "One string of ( and ) characters.", outputFormat: "One integer.", constraints: ["1 <= length <= 10^5"],
    variants: [
      { title: "Minimum insertions to balance parentheses", statement: "Print the smallest number of ( or ) characters you must INSERT (anywhere) so the string becomes balanced: every ( has a matching later ) and the other way round.",
        ref: "s = input().strip()\nopen_ = need = 0\nfor c in s:\n    if c == '(':\n        open_ += 1\n    elif open_:\n        open_ -= 1\n    else:\n        need += 1\nprint(open_ + need)\n",
        alt: "s = input().strip()\nwhile '()' in s:\n    s = s.replace('()', '')\nprint(len(s))\n",
        gen: (rng, small) => { const n = small ? rng.int(1, 12) : rng.int(100, 4000); return T(Array.from({ length: n }, () => rng.pick(["(", ")"])).join("")); } },
      { title: "Minimum removals to balance parentheses", statement: "Print the smallest number of characters you must REMOVE so the remaining string is balanced (every ( matched by a later ), every ) by an earlier ().",
        ref: "s = input().strip()\nopen_ = bad = 0\nfor c in s:\n    if c == '(':\n        open_ += 1\n    elif open_:\n        open_ -= 1\n    else:\n        bad += 1\nprint(open_ + bad)\n",
        alt: "s = input().strip()\nstack = []\nfor i, c in enumerate(s):\n    if c == '(': stack.append(i)\n    elif stack and s[stack[-1]] == '(': stack.pop()\n    else: stack.append(i)\nprint(len(stack))\n",
        gen: (rng, small) => { const n = small ? rng.int(1, 12) : rng.int(100, 4000); return T(Array.from({ length: n }, () => rng.pick(["(", ")"])).join("")); } },
    ] },
  { key: "spiral", topic: "Matrices", difficulty: "medium", inputFormat: "Line 1: r and c. Then r lines of c integers.", outputFormat: "All r*c values on one line, space separated.", constraints: ["1 <= r, c <= 100"],
    variants: [
      { title: "Spiral order, clockwise", statement: "Print the matrix in clockwise spiral order, starting at the top-left cell and going right first.",
        ref: "r, c = map(int, input().split())\ng = [list(map(int, input().split())) for _ in range(r)]\nout = []\nt, b, l, rt = 0, r - 1, 0, c - 1\nwhile t <= b and l <= rt:\n    out += g[t][l:rt + 1]\n    t += 1\n    out += [g[i][rt] for i in range(t, b + 1)]\n    rt -= 1\n    if t <= b:\n        out += g[b][l:rt + 1][::-1]\n        b -= 1\n    if l <= rt:\n        out += [g[i][l] for i in range(b, t - 1, -1)]\n        l += 1\nprint(*out)\n",
        alt: "r, c = map(int, input().split())\nm = [list(map(int, input().split())) for _ in range(r)]\nout = []\nwhile m:\n    out += m.pop(0)\n    m = [list(x) for x in zip(*m)][::-1]\nprint(*out)\n",
        gen: (rng, small) => { const r = small ? rng.int(1, 4) : rng.int(5, 30), c = small ? rng.int(1, 4) : rng.int(5, 30); return `${r} ${c}\n${Array.from({ length: r }, () => lineOf(nums(rng, c, 0, 99))).join("\n")}\n`; } },
      { title: "Spiral order, counter-clockwise", statement: "Print the matrix in counter-clockwise spiral order, starting at the top-left cell and going DOWN first.",
        ref: "r, c = map(int, input().split())\ng = [list(map(int, input().split())) for _ in range(r)]\nt = [list(x) for x in zip(*g)]\nout = []\nm = t\nwhile m:\n    out += m.pop(0)\n    m = [list(x) for x in zip(*m)][::-1]\nprint(*out)\n",
        alt: "r, c = map(int, input().split())\ng = [list(map(int, input().split())) for _ in range(r)]\nseen = [[False] * c for _ in range(r)]\nD = [(1, 0), (0, 1), (-1, 0), (0, -1)]\nout = []\ni = j = k = 0\nfor _ in range(r * c):\n    out.append(g[i][j])\n    seen[i][j] = True\n    ni, nj = i + D[k][0], j + D[k][1]\n    if not (0 <= ni < r and 0 <= nj < c) or seen[ni][nj]:\n        k = (k + 1) % 4\n        ni, nj = i + D[k][0], j + D[k][1]\n    i, j = ni, nj\nprint(*out)\n",
        gen: (rng, small) => { const r = small ? rng.int(1, 4) : rng.int(5, 30), c = small ? rng.int(1, 4) : rng.int(5, 30); return `${r} ${c}\n${Array.from({ length: r }, () => lineOf(nums(rng, c, 0, 99))).join("\n")}\n`; } },
    ] },
  { key: "islands", topic: "Graphs", difficulty: "medium", inputFormat: "Line 1: r and c. Then r lines, each a string of c characters, 0 (water) or 1 (land).", outputFormat: "One integer.", constraints: ["1 <= r, c <= 100"],
    variants: [
      { title: "Number of islands (4 directions)", statement: "Count the islands: groups of land cells (1) connected through shared SIDES (up, down, left, right).",
        ref: "r, c = map(int, input().split())\ng = [list(input().strip()) for _ in range(r)]\nn = 0\nfor i in range(r):\n    for j in range(c):\n        if g[i][j] == '1':\n            n += 1\n            st = [(i, j)]\n            g[i][j] = '0'\n            while st:\n                x, y = st.pop()\n                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):\n                    a, b = x + dx, y + dy\n                    if 0 <= a < r and 0 <= b < c and g[a][b] == '1':\n                        g[a][b] = '0'\n                        st.append((a, b))\nprint(n)\n",
        alt: "r, c = map(int, input().split())\ng = [input().strip() for _ in range(r)]\np = list(range(r * c))\ndef f(x):\n    while p[x] != x:\n        p[x] = p[p[x]]\n        x = p[x]\n    return x\nfor i in range(r):\n    for j in range(c):\n        if g[i][j] == '1':\n            if i + 1 < r and g[i + 1][j] == '1': p[f(i * c + j)] = f((i + 1) * c + j)\n            if j + 1 < c and g[i][j + 1] == '1': p[f(i * c + j)] = f(i * c + j + 1)\nprint(len({f(i * c + j) for i in range(r) for j in range(c) if g[i][j] == '1'}))\n",
        gen: (rng, small) => { const r = small ? rng.int(1, 5) : rng.int(8, 40), c = small ? rng.int(1, 5) : rng.int(8, 40); return `${r} ${c}\n${Array.from({ length: r }, () => Array.from({ length: c }, () => (rng.chance(0.45) ? "1" : "0")).join("")).join("\n")}\n`; } },
      { title: "Number of islands (8 directions)", statement: "Count the islands: groups of land cells (1) connected through sides OR corners (all 8 neighbours).",
        ref: "r, c = map(int, input().split())\ng = [list(input().strip()) for _ in range(r)]\nn = 0\nfor i in range(r):\n    for j in range(c):\n        if g[i][j] == '1':\n            n += 1\n            st = [(i, j)]\n            g[i][j] = '0'\n            while st:\n                x, y = st.pop()\n                for dx in (-1, 0, 1):\n                    for dy in (-1, 0, 1):\n                        a, b = x + dx, y + dy\n                        if 0 <= a < r and 0 <= b < c and g[a][b] == '1':\n                            g[a][b] = '0'\n                            st.append((a, b))\nprint(n)\n",
        alt: "r, c = map(int, input().split())\ng = [input().strip() for _ in range(r)]\ncells = [(i, j) for i in range(r) for j in range(c) if g[i][j] == '1']\ncomp = {x: x for x in cells}\ndef f(x):\n    while comp[x] != x:\n        comp[x] = comp[comp[x]]\n        x = comp[x]\n    return x\nfor (i, j) in cells:\n    for (a, b) in cells:\n        if max(abs(i - a), abs(j - b)) == 1: comp[f((i, j))] = f((a, b))\nprint(len({f(x) for x in cells}))\n",
        gen: (rng, small) => { const r = small ? rng.int(1, 5) : rng.int(8, 25), c = small ? rng.int(1, 5) : rng.int(8, 25); return `${r} ${c}\n${Array.from({ length: r }, () => Array.from({ length: c }, () => (rng.chance(0.4) ? "1" : "0")).join("")).join("\n")}\n`; } },
    ] },
  { key: "stairs", topic: "Dynamic programming", difficulty: "medium", inputFormat: "One integer n.", outputFormat: "One integer: the number of ways modulo 1000000007.", constraints: ["1 <= n <= 10^5"],
    variants: ([[1, 2], [1, 2, 3], [1, 3, 5], [2, 3], [1, 4], [2, 5, 7]] as const).map((S) => ({
      title: `Climb stairs with steps ${S.join(", ")}`, statement: `You climb a staircase of n steps. Each move you may go up ${S.join(", ")} steps. Print how many different sequences of moves reach exactly step n, modulo 1000000007.`,
      ref: `n = int(input())\nM = 10 ** 9 + 7\nS = ${JSON.stringify([...S])}\nd = [1] + [0] * n\nfor i in range(1, n + 1):\n    d[i] = sum(d[i - s] for s in S if i >= s) % M\nprint(d[n])\n`,
      alt: `import sys\nsys.setrecursionlimit(10000)\nfrom functools import lru_cache\nn = int(input())\nM = 10 ** 9 + 7\n@lru_cache(None)\ndef w(i):\n    if i == 0: return 1\n    return sum(w(i - s) for s in ${JSON.stringify([...S])} if i >= s) % M\nprint(w(n))\n`,
      gen: (rng, small) => `${small ? rng.int(1, 40) : rng.int(500, 3000)}\n` })) },
  { key: "coins", topic: "Dynamic programming", difficulty: "medium", inputFormat: "One integer: the amount.", outputFormat: "The fewest coins, or -1 if the amount cannot be made.", constraints: ["0 <= amount <= 10000"],
    variants: ([[1, 5, 10, 25], [1, 3, 4], [2, 5, 10], [1, 7, 10], [3, 7], [5, 9, 11]] as const).map((C) => ({
      title: `Fewest coins from {${C.join(", ")}}`, statement: `You have an unlimited supply of coins worth ${C.join(", ")}. Print the fewest coins that add up to the amount, or -1 if it cannot be made.`,
      ref: `a = int(input())\nC = ${JSON.stringify([...C])}\nINF = 10 ** 9\nd = [0] + [INF] * a\nfor i in range(1, a + 1):\n    for c in C:\n        if c <= i and d[i - c] + 1 < d[i]: d[i] = d[i - c] + 1\nprint(d[a] if d[a] < INF else -1)\n`,
      alt: `from collections import deque\na = int(input())\nC = ${JSON.stringify([...C])}\ndist = {0: 0}\nq = deque([0])\nwhile q:\n    x = q.popleft()\n    for c in C:\n        y = x + c\n        if y <= a and y not in dist:\n            dist[y] = dist[x] + 1\n            q.append(y)\nprint(dist.get(a, -1))\n`,
      gen: (rng, small) => `${small ? rng.int(0, 40) : rng.int(100, 6000)}\n` })) },
  { key: "knapsack", topic: "Dynamic programming", difficulty: "hard", inputFormat: "Line 1: n and W. Line 2: n weights. Line 3: n values.", outputFormat: "One integer: the best total value.", constraints: ["1 <= n <= 100", "1 <= W <= 10000"],
    variants: [
      { title: "0/1 knapsack", statement: "Choose items (each at most once) with total weight at most W to maximise total value. Print that best value.",
        ref: "n, W = map(int, input().split())\nw = list(map(int, input().split()))\nv = list(map(int, input().split()))\nd = [0] * (W + 1)\nfor i in range(n):\n    for c in range(W, w[i] - 1, -1):\n        d[c] = max(d[c], d[c - w[i]] + v[i])\nprint(d[W])\n",
        alt: "from itertools import combinations\nn, W = map(int, input().split())\nw = list(map(int, input().split()))\nv = list(map(int, input().split()))\nbest = 0\nfor mask in range(1 << n):\n    tw = sum(w[i] for i in range(n) if mask >> i & 1)\n    if tw <= W: best = max(best, sum(v[i] for i in range(n) if mask >> i & 1))\nprint(best)\n",
        gen: (rng, small) => { const n = small ? rng.int(1, 8) : rng.int(10, 60); const W = small ? rng.int(1, 25) : rng.int(50, 1500); return `${n} ${W}\n${lineOf(nums(rng, n, 1, small ? 12 : 90))}\n${lineOf(nums(rng, n, 1, 100))}\n`; } },
      { title: "Unbounded knapsack", statement: "Each item may be taken ANY number of times. Choose items with total weight at most W to maximise total value. Print that best value.",
        ref: "n, W = map(int, input().split())\nw = list(map(int, input().split()))\nv = list(map(int, input().split()))\nd = [0] * (W + 1)\nfor c in range(1, W + 1):\n    for i in range(n):\n        if w[i] <= c: d[c] = max(d[c], d[c - w[i]] + v[i])\nprint(d[W])\n",
        alt: "import sys\nsys.setrecursionlimit(5000)\nfrom functools import lru_cache\nn, W = map(int, input().split())\nw = list(map(int, input().split()))\nv = list(map(int, input().split()))\n@lru_cache(None)\ndef f(cap):\n    return max([0] + [v[i] + f(cap - w[i]) for i in range(n) if w[i] <= cap])\nprint(f(W))\n",
        gen: (rng, small) => { const n = small ? rng.int(1, 5) : rng.int(5, 30); const W = small ? rng.int(1, 30) : rng.int(50, 1200); return `${n} ${W}\n${lineOf(nums(rng, n, 1, small ? 9 : 60))}\n${lineOf(nums(rng, n, 1, 100))}\n`; } },
    ] },
  { key: "edit", topic: "Strings", difficulty: "hard", inputFormat: "Two lines: the strings a and b (lowercase letters).", outputFormat: "One integer.", constraints: ["1 <= length <= 500"],
    variants: [
      { title: "Edit distance", statement: "The minimum number of single-character insertions, deletions and replacements that turn string a into string b.",
        ref: "a = input().strip()\nb = input().strip()\nprev = list(range(len(b) + 1))\nfor i, x in enumerate(a, 1):\n    cur = [i]\n    for j, y in enumerate(b, 1):\n        cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))\n    prev = cur\nprint(prev[-1])\n",
        alt: "import sys\nsys.setrecursionlimit(10000)\nfrom functools import lru_cache\na = input().strip()\nb = input().strip()\n@lru_cache(None)\ndef f(i, j):\n    if i == 0: return j\n    if j == 0: return i\n    if a[i - 1] == b[j - 1]: return f(i - 1, j - 1)\n    return 1 + min(f(i - 1, j), f(i, j - 1), f(i - 1, j - 1))\nprint(f(len(a), len(b)))\n",
        gen: (rng, small) => { const n = small ? rng.int(1, 6) : rng.int(20, 120); const m = small ? rng.int(1, 6) : rng.int(20, 120); const s = (k: number) => Array.from({ length: k }, () => rng.pick([..."abcd"])).join(""); return `${s(n)}\n${s(m)}\n`; } },
      { title: "Edit distance with only insertions and deletions", statement: "The minimum number of single-character insertions and deletions (no replacements) that turn string a into string b.",
        ref: "a = input().strip()\nb = input().strip()\nprev = [0] * (len(b) + 1)\nfor x in a:\n    cur = [0]\n    for j, y in enumerate(b, 1):\n        cur.append(prev[j - 1] + 1 if x == y else max(prev[j], cur[j - 1]))\n    prev = cur\nprint(len(a) + len(b) - 2 * prev[-1])\n",
        alt: "import sys\nsys.setrecursionlimit(10000)\nfrom functools import lru_cache\na = input().strip()\nb = input().strip()\n@lru_cache(None)\ndef f(i, j):\n    if i == 0: return j\n    if j == 0: return i\n    if a[i - 1] == b[j - 1]: return f(i - 1, j - 1)\n    return 1 + min(f(i - 1, j), f(i, j - 1))\nprint(f(len(a), len(b)))\n",
        gen: (rng, small) => { const n = small ? rng.int(1, 6) : rng.int(20, 120); const m = small ? rng.int(1, 6) : rng.int(20, 120); const s = (k: number) => Array.from({ length: k }, () => rng.pick([..."abcd"])).join(""); return `${s(n)}\n${s(m)}\n`; } },
    ] },
  { key: "lcs", topic: "Strings", difficulty: "medium", inputFormat: "Two lines: the strings a and b.", outputFormat: "One integer.", constraints: ["1 <= length <= 500"],
    variants: [
      { title: "Longest common subsequence", statement: "Print the length of the longest sequence of characters that appears in both strings in the same order (not necessarily adjacent).",
        ref: "a = input().strip()\nb = input().strip()\nprev = [0] * (len(b) + 1)\nfor x in a:\n    cur = [0]\n    for j, y in enumerate(b, 1):\n        cur.append(prev[j - 1] + 1 if x == y else max(prev[j], cur[j - 1]))\n    prev = cur\nprint(prev[-1])\n",
        alt: "import sys\nsys.setrecursionlimit(10000)\nfrom functools import lru_cache\na = input().strip()\nb = input().strip()\n@lru_cache(None)\ndef f(i, j):\n    if i == 0 or j == 0: return 0\n    if a[i - 1] == b[j - 1]: return 1 + f(i - 1, j - 1)\n    return max(f(i - 1, j), f(i, j - 1))\nprint(f(len(a), len(b)))\n",
        gen: (rng, small) => { const n = small ? rng.int(1, 7) : rng.int(20, 150); const m = small ? rng.int(1, 7) : rng.int(20, 150); const s = (k: number) => Array.from({ length: k }, () => rng.pick([..."abcde"])).join(""); return `${s(n)}\n${s(m)}\n`; } },
      { title: "Longest common substring", statement: "Print the length of the longest block of CONSECUTIVE characters that appears in both strings.",
        ref: "a = input().strip()\nb = input().strip()\nprev = [0] * (len(b) + 1)\nbest = 0\nfor x in a:\n    cur = [0]\n    for j, y in enumerate(b, 1):\n        cur.append(prev[j - 1] + 1 if x == y else 0)\n        best = max(best, cur[-1])\n    prev = cur\nprint(best)\n",
        alt: "a = input().strip()\nb = input().strip()\nbest = 0\nfor i in range(len(a)):\n    for j in range(i + 1, len(a) + 1):\n        if a[i:j] in b: best = max(best, j - i)\nprint(best)\n",
        gen: (rng, small) => { const n = small ? rng.int(1, 7) : rng.int(20, 120); const m = small ? rng.int(1, 7) : rng.int(20, 120); const s = (k: number) => Array.from({ length: k }, () => rng.pick([..."abcde"])).join(""); return `${s(n)}\n${s(m)}\n`; } },
    ] },
  { key: "bound", topic: "Searching", difficulty: "easy", inputFormat: "Line 1: n and x. Line 2: n integers in non-decreasing order.", outputFormat: "One integer (0-based position, or n if there is none).", constraints: ["1 <= n <= 10^5"],
    variants: [
      { title: "First position with value at least x", statement: "Print the 0-based position of the first element that is greater than or equal to x, or n if every element is smaller.",
        ref: "from bisect import bisect_left\nn, x = map(int, input().split())\na = list(map(int, input().split()))\nprint(bisect_left(a, x))\n",
        alt: "n, x = map(int, input().split())\na = list(map(int, input().split()))\nfor i in range(n):\n    if a[i] >= x:\n        print(i)\n        break\nelse:\n    print(n)\n",
        gen: (rng, small) => { const n = small ? rng.int(1, 9) : rng.int(50, 3000); const a = nums(rng, n, -40, 60).sort((p, q) => p - q); return `${n} ${rng.int(-45, 65)}\n${lineOf(a)}\n`; } },
      { title: "First position with value greater than x", statement: "Print the 0-based position of the first element that is STRICTLY greater than x, or n if there is none.",
        ref: "from bisect import bisect_right\nn, x = map(int, input().split())\na = list(map(int, input().split()))\nprint(bisect_right(a, x))\n",
        alt: "n, x = map(int, input().split())\na = list(map(int, input().split()))\nfor i in range(n):\n    if a[i] > x:\n        print(i)\n        break\nelse:\n    print(n)\n",
        gen: (rng, small) => { const n = small ? rng.int(1, 9) : rng.int(50, 3000); const a = nums(rng, n, -40, 60).sort((p, q) => p - q); return `${n} ${rng.int(-45, 65)}\n${lineOf(a)}\n`; } },
    ] },
  { key: "powmod", topic: "Math", difficulty: "medium", inputFormat: "One line: a and b.", outputFormat: "One integer.", constraints: ["0 <= a <= 10^9", "0 <= b <= 10^18"],
    variants: ([1000000007, 998244353, 1000000009, 1000003] as const).map((M) => ({
      title: `Power modulo ${M}`, statement: `Print a raised to the power b, modulo ${M}.`,
      ref: `a, b = map(int, input().split())\nprint(pow(a, b, ${M}))\n`,
      alt: `a, b = map(int, input().split())\nr, x, M = 1, a % ${M}, ${M}\nwhile b:\n    if b & 1: r = r * x % M\n    x = x * x % M\n    b >>= 1\nprint(r % M)\n`,
      gen: (rng, small) => `${small ? rng.int(0, 20) : rng.int(0, 10 ** 9)} ${small ? rng.int(0, 30) : rng.pick([10 ** 18, rng.int(10 ** 9, 10 ** 15), 0, 1])}\n` })) },
  { key: "primes", topic: "Math", difficulty: "medium", inputFormat: "One integer n.", outputFormat: "One integer.", constraints: ["2 <= n <= 10^6"],
    variants: [
      { title: "Sum of primes up to n", statement: "Print the sum of all prime numbers less than or equal to n.", ref: "n = int(input())\ns = bytearray([1]) * (n + 1)\ns[0:2] = b'\\x00\\x00'[:min(2, n + 1)]\nfor i in range(2, int(n ** 0.5) + 1):\n    if s[i]: s[i * i::i] = bytearray(len(s[i * i::i]))\nprint(sum(i for i in range(n + 1) if s[i]))\n",
        alt: "n = int(input())\nprint(sum(x for x in range(2, n + 1) if all(x % d for d in range(2, int(x ** 0.5) + 1))))\n", gen: (rng, small) => `${small ? rng.int(2, 60) : rng.int(1000, 200000)}\n` },
      { title: "Twin primes up to n", statement: "A twin prime pair is two primes that differ by 2 (like 11 and 13). Count the pairs (p, p+2) where both are prime and p + 2 <= n.",
        ref: "n = int(input())\ns = bytearray([1]) * (n + 3)\ns[0:2] = b'\\x00\\x00'\nfor i in range(2, int((n + 2) ** 0.5) + 1):\n    if s[i]: s[i * i::i] = bytearray(len(s[i * i::i]))\nprint(sum(1 for p in range(2, n - 1) if s[p] and s[p + 2]))\n",
        alt: "n = int(input())\nisp = lambda x: x > 1 and all(x % d for d in range(2, int(x ** 0.5) + 1))\nprint(sum(1 for p in range(2, n - 1) if isp(p) and isp(p + 2)))\n", gen: (rng, small) => `${small ? rng.int(2, 80) : rng.int(1000, 200000)}\n` },
      { title: "Largest prime gap up to n", statement: "Among consecutive primes not larger than n, print the largest difference between two neighbouring primes. If there are fewer than two primes, print 0.",
        ref: "n = int(input())\ns = bytearray([1]) * (n + 1)\ns[0:2] = b'\\x00\\x00'[:min(2, n + 1)]\nfor i in range(2, int(n ** 0.5) + 1):\n    if s[i]: s[i * i::i] = bytearray(len(s[i * i::i]))\nps = [i for i in range(n + 1) if s[i]]\nprint(max([b - a for a, b in zip(ps, ps[1:])] or [0]))\n",
        alt: "n = int(input())\nisp = lambda x: x > 1 and all(x % d for d in range(2, int(x ** 0.5) + 1))\nps = [x for x in range(2, n + 1) if isp(x)]\nbest = 0\nfor i in range(1, len(ps)): best = max(best, ps[i] - ps[i - 1])\nprint(best)\n", gen: (rng, small) => `${small ? rng.int(2, 80) : rng.int(1000, 300000)}\n` },
    ] },
  { key: "intervals", topic: "Sorting", difficulty: "medium", inputFormat: "Line 1: n. Then n lines, each with l and r (l <= r).", outputFormat: "One integer.", constraints: ["1 <= n <= 10^5", "0 <= l <= r <= 10^9"],
    variants: [
      { title: "Total length covered by intervals", statement: "Each line gives a segment [l, r] on a number line. Print the total length of the line covered by at least one segment (overlaps are counted once; a segment's length is r - l).",
        ref: "n = int(input())\nv = sorted(tuple(map(int, input().split())) for _ in range(n))\ntotal = 0\ncl, cr = v[0]\nfor l, r in v[1:]:\n    if l > cr:\n        total += cr - cl\n        cl, cr = l, r\n    else:\n        cr = max(cr, r)\ntotal += cr - cl\nprint(total)\n",
        alt: "n = int(input())\nv = [tuple(map(int, input().split())) for _ in range(n)]\nlit = set()\nfor l, r in v:\n    for x in range(l, r): lit.add(x)\nprint(len(lit))\n",
        gen: (rng, small) => { const n = small ? rng.int(1, 6) : rng.int(20, 800); const hi = small ? 30 : 10 ** 9; const rows = Array.from({ length: n }, () => { const l = rng.int(0, hi - 1); return `${l} ${Math.min(hi, l + rng.int(0, small ? 8 : Math.floor(hi / 50)))}`; }); return `${n}\n${rows.join("\n")}\n`; } },
      { title: "Number of merged intervals", statement: "Segments [l, r] that overlap or touch (share at least one point, such as [1,3] and [3,5]) are merged into one. Print how many segments remain after merging everything possible.",
        ref: "n = int(input())\nv = sorted(tuple(map(int, input().split())) for _ in range(n))\ncount = 1\ncr = v[0][1]\nfor l, r in v[1:]:\n    if l > cr: count += 1\n    cr = max(cr, r)\nprint(count)\n",
        alt: "n = int(input())\nv = [list(map(int, input().split())) for _ in range(n)]\nchanged = True\nwhile changed:\n    changed = False\n    for i in range(len(v)):\n        for j in range(i + 1, len(v)):\n            if max(v[i][0], v[j][0]) <= min(v[i][1], v[j][1]):\n                v[i] = [min(v[i][0], v[j][0]), max(v[i][1], v[j][1])]\n                v.pop(j)\n                changed = True\n                break\n        if changed: break\nprint(len(v))\n",
        gen: (rng, small) => { const n = small ? rng.int(1, 6) : rng.int(10, 120); const hi = small ? 30 : 10 ** 6; const rows = Array.from({ length: n }, () => { const l = rng.int(0, hi - 1); return `${l} ${Math.min(hi, l + rng.int(0, small ? 5 : Math.floor(hi / 60)))}`; }); return `${n}\n${rows.join("\n")}\n`; } },
    ] },
  { key: "topk", topic: "Hashing", difficulty: "medium", inputFormat: "Line 1: n and k. Line 2: n words.", outputFormat: "k words on one line, space separated.", constraints: ["1 <= n <= 10^5", "k <= number of distinct words"],
    variants: [
      { title: "Top K frequent words (ties alphabetical)", statement: "Print the k most frequent words, most frequent first. Words with the same count are ordered alphabetically.",
        ref: "from collections import Counter\nn, k = map(int, input().split())\nc = Counter(input().split())\nprint(*[w for w, _ in sorted(c.items(), key=lambda t: (-t[1], t[0]))[:k]])\n",
        alt: "n, k = map(int, input().split())\nws = input().split()\nd = {}\nfor w in ws: d[w] = d.get(w, 0) + 1\nout = []\nfor _ in range(k):\n    best = None\n    for w in d:\n        if w in out: continue\n        if best is None or d[w] > d[best] or (d[w] == d[best] and w < best): best = w\n    out.append(best)\nprint(*out)\n",
        gen: (rng, small) => { const n = small ? rng.int(2, 10) : rng.int(30, 1500); const ws = nums(rng, n, 0, small ? 4 : 25).map((x) => `w${x}`); const d = new Set(ws).size; return `${n} ${rng.int(1, d)}\n${ws.join(" ")}\n`; } },
      { title: "Top K frequent words (ties by first appearance)", statement: "Print the k most frequent words, most frequent first. Words with the same count are ordered by which one appeared EARLIER in the input.",
        ref: "from collections import Counter\nn, k = map(int, input().split())\nws = input().split()\nc = Counter(ws)\nfirst = {}\nfor i, w in enumerate(ws): first.setdefault(w, i)\nprint(*[w for w in sorted(c, key=lambda w: (-c[w], first[w]))[:k]])\n",
        alt: "n, k = map(int, input().split())\nws = input().split()\norder = []\nfor w in ws:\n    if w not in order: order.append(w)\ncnt = {w: ws.count(w) for w in order}\nres = []\nfor c in sorted(set(cnt.values()), reverse=True):\n    res += [w for w in order if cnt[w] == c]\nprint(*res[:k])\n",
        gen: (rng, small) => { const n = small ? rng.int(2, 10) : rng.int(30, 1500); const ws = nums(rng, n, 0, small ? 4 : 25).map((x) => `w${x}`); const d = new Set(ws).size; return `${n} ${rng.int(1, d)}\n${ws.join(" ")}\n`; } },
    ] },
  { key: "rotate", topic: "Matrices", difficulty: "easy", inputFormat: "Line 1: n. Then n lines of n integers.", outputFormat: "The rotated matrix, n lines of n integers.", constraints: ["1 <= n <= 100"],
    variants: [
      { title: "Rotate a matrix 90 degrees clockwise", statement: "Rotate the square matrix 90 degrees clockwise and print it.", ref: "n = int(input())\nm = [list(map(int, input().split())) for _ in range(n)]\nfor row in zip(*m[::-1]): print(*row)\n",
        alt: "n = int(input())\nm = [list(map(int, input().split())) for _ in range(n)]\nfor i in range(n): print(*[m[n - 1 - j][i] for j in range(n)])\n", gen: (rng, small) => { const n = small ? rng.int(1, 4) : rng.int(5, 25); return `${n}\n${Array.from({ length: n }, () => lineOf(nums(rng, n, 0, 99))).join("\n")}\n`; } },
      { title: "Rotate a matrix 90 degrees counter-clockwise", statement: "Rotate the square matrix 90 degrees COUNTER-clockwise and print it.", ref: "n = int(input())\nm = [list(map(int, input().split())) for _ in range(n)]\nfor row in list(zip(*m))[::-1]: print(*row)\n",
        alt: "n = int(input())\nm = [list(map(int, input().split())) for _ in range(n)]\nfor i in range(n): print(*[m[j][n - 1 - i] for j in range(n)])\n", gen: (rng, small) => { const n = small ? rng.int(1, 4) : rng.int(5, 25); return `${n}\n${Array.from({ length: n }, () => lineOf(nums(rng, n, 0, 99))).join("\n")}\n`; } },
      { title: "Rotate a matrix 180 degrees", statement: "Rotate the square matrix 180 degrees and print it.", ref: "n = int(input())\nm = [list(map(int, input().split())) for _ in range(n)]\nfor row in m[::-1]: print(*row[::-1])\n",
        alt: "n = int(input())\nm = [list(map(int, input().split())) for _ in range(n)]\nfor i in range(n): print(*[m[n - 1 - i][n - 1 - j] for j in range(n)])\n", gen: (rng, small) => { const n = small ? rng.int(1, 4) : rng.int(5, 25); return `${n}\n${Array.from({ length: n }, () => lineOf(nums(rng, n, 0, 99))).join("\n")}\n`; } },
    ] },
  { key: "pairmath", topic: "Math", difficulty: "easy", inputFormat: "Line 1: q. Then q lines, each with a and b.", outputFormat: "q lines, one answer each.", constraints: ["1 <= q <= 10^4", "1 <= a, b <= 10^9"],
    variants: [
      { title: "LCM of many pairs", statement: "For each pair (a, b) print the least common multiple of a and b.", ref: "from math import gcd\nq = int(input())\nfor _ in range(q):\n    a, b = map(int, input().split())\n    print(a // gcd(a, b) * b)\n",
        alt: "q = int(input())\nfor _ in range(q):\n    a, b = map(int, input().split())\n    x, y = a, b\n    while y: x, y = y, x % y\n    print(a * b // x)\n", gen: (rng, small) => { const q = small ? rng.int(1, 4) : rng.int(20, 300); return `${q}\n${Array.from({ length: q }, () => `${rng.int(1, small ? 60 : 10 ** 6)} ${rng.int(1, small ? 60 : 10 ** 6)}`).join("\n")}\n`; } },
      { title: "Common divisors of many pairs", statement: "For each pair (a, b) print how many positive integers divide both a and b.", ref: "from math import gcd\nq = int(input())\nfor _ in range(q):\n    a, b = map(int, input().split())\n    g = gcd(a, b)\n    c = 0\n    i = 1\n    while i * i <= g:\n        if g % i == 0: c += 1 if i * i == g else 2\n        i += 1\n    print(c)\n",
        alt: "q = int(input())\nfor _ in range(q):\n    a, b = map(int, input().split())\n    print(sum(1 for d in range(1, min(a, b) + 1) if a % d == 0 and b % d == 0))\n", gen: (rng, small) => { const q = small ? rng.int(1, 4) : rng.int(20, 200); return `${q}\n${Array.from({ length: q }, () => `${rng.int(1, small ? 60 : 3000)} ${rng.int(1, small ? 60 : 3000)}`).join("\n")}\n`; } },
    ] },
  { key: "digitsum", topic: "Math", difficulty: "easy", inputFormat: "One integer n.", outputFormat: "One integer.", constraints: ["1 <= n <= 100000"],
    variants: [5, 7, 9, 10, 12, 15, 18, 20].map((s) => ({
      title: `Numbers with digit sum ${s}`, statement: `Count the integers from 1 to n (inclusive) whose decimal digits add up to exactly ${s}.`,
      ref: `n = int(input())\nprint(sum(1 for x in range(1, n + 1) if sum(map(int, str(x))) == ${s}))\n`,
      alt: `n = int(input())\nc = 0\nfor x in range(1, n + 1):\n    t, y = 0, x\n    while y:\n        t += y % 10\n        y //= 10\n    if t == ${s}: c += 1\nprint(c)\n`,
      gen: (rng, small) => `${small ? rng.int(1, 300) : rng.pick([100000, rng.int(5000, 100000)])}\n` })) },
  { key: "bits", topic: "Bits", difficulty: "medium", inputFormat: "One integer n.", outputFormat: "One integer.", constraints: ["1 <= n <= 10^9"],
    variants: [
      { title: "Total set bits from 1 to n", statement: "Print the total number of 1 bits in the binary forms of all integers from 1 to n.", ref: "n = int(input())\nt = 0\nb = 1\nwhile b <= n:\n    full, rem = divmod(n + 1, b * 2)\n    t += full * b + max(0, rem - b)\n    b *= 2\nprint(t)\n",
        alt: "n = int(input())\nprint(sum(bin(x).count('1') for x in range(1, n + 1)))\n", gen: (rng, small) => `${small ? rng.int(1, 300) : rng.pick([10 ** 9, rng.int(10 ** 6, 10 ** 9)])}\n` },
      { title: "Powers of two up to n", statement: "Print how many powers of two (1, 2, 4, 8, ...) are less than or equal to n.", ref: "n = int(input())\nprint(n.bit_length())\n",
        alt: "n = int(input())\np = 1\nc = 0\nwhile p <= n:\n    c += 1\n    p *= 2\nprint(c)\n", gen: (rng, small) => `${small ? rng.int(1, 300) : rng.int(1, 10 ** 9)}\n` },
    ] },
  { key: "anagram-groups", topic: "Hashing", difficulty: "medium", inputFormat: "Line 1: n. Line 2: n lowercase words.", outputFormat: "One integer.", constraints: ["1 <= n <= 10^4"],
    variants: [
      { title: "Number of anagram groups", statement: "Words are in the same group when one is a rearrangement of the other. Print the number of groups.", ref: "n = int(input())\nprint(len({''.join(sorted(w)) for w in input().split()}))\n",
        alt: "from collections import Counter\nn = int(input())\nws = input().split()\ngroups = []\nfor w in ws:\n    c = Counter(w)\n    if not any(c == g for g in groups): groups.append(c)\nprint(len(groups))\n", gen: (rng, small) => { const n = small ? rng.int(1, 8) : rng.int(20, 400); return `${n}\n${Array.from({ length: n }, () => rng.pick(words)).join(" ")}\n`; } },
      { title: "Size of the largest anagram group", statement: "Words are in the same group when one is a rearrangement of the other. Print how many words the biggest group holds (repeated words count separately).", ref: "from collections import Counter\nn = int(input())\nprint(max(Counter(''.join(sorted(w)) for w in input().split()).values()))\n",
        alt: "n = int(input())\nws = input().split()\nbest = 0\nfor w in ws: best = max(best, sum(1 for v in ws if sorted(v) == sorted(w)))\nprint(best)\n", gen: (rng, small) => { const n = small ? rng.int(1, 8) : rng.int(20, 400); return `${n}\n${Array.from({ length: n }, () => rng.pick(words)).join(" ")}\n`; } },
    ] },
  { key: "stocks", topic: "Dynamic programming", difficulty: "medium", inputFormat: "Line 1: n. Line 2: n prices.", outputFormat: "One integer: the best profit (0 if no profit is possible).", constraints: ["1 <= n <= 10^5"],
    variants: [
      { title: "Best time to trade a stock once", statement: "You may buy once and sell once later. Print the largest profit.", ref: "n = int(input())\np = list(map(int, input().split()))\nlow, best = p[0], 0\nfor x in p:\n    low = min(low, x)\n    best = max(best, x - low)\nprint(best)\n",
        alt: "n = int(input())\np = list(map(int, input().split()))\nprint(max([0] + [p[j] - p[i] for i in range(n) for j in range(i + 1, n)]))\n", gen: (rng, small) => { const n = small ? rng.int(1, 8) : rng.int(30, 2000); return `${n}\n${lineOf(nums(rng, n, 1, 100))}\n`; } },
      { title: "Best time to trade a stock, unlimited trades", statement: "You may buy and sell as many times as you like, but you can hold only one share at a time. Print the largest total profit.", ref: "n = int(input())\np = list(map(int, input().split()))\nprint(sum(max(0, p[i] - p[i - 1]) for i in range(1, n)))\n",
        alt: "n = int(input())\np = list(map(int, input().split()))\nhold, cash = -p[0], 0\nfor x in p[1:]:\n    cash, hold = max(cash, hold + x), max(hold, cash - x)\nprint(cash)\n", gen: (rng, small) => { const n = small ? rng.int(1, 8) : rng.int(30, 2000); return `${n}\n${lineOf(nums(rng, n, 1, 100))}\n`; } },
      { title: "Best time to trade a stock, at most two trades", statement: "You may complete at most two buy-then-sell trades, and the second must start after the first has ended. Print the largest total profit.", ref: "n = int(input())\np = list(map(int, input().split()))\nb1 = b2 = -10 ** 9\ns1 = s2 = 0\nfor x in p:\n    b1 = max(b1, -x)\n    s1 = max(s1, b1 + x)\n    b2 = max(b2, s1 - x)\n    s2 = max(s2, b2 + x)\nprint(s2)\n",
        alt: "import sys\nfrom functools import lru_cache\nn = int(input())\np = list(map(int, input().split()))\n@lru_cache(None)\ndef f(i, trades, holding):\n    if i == n: return 0\n    best = f(i + 1, trades, holding)\n    if holding: best = max(best, p[i] + f(i + 1, trades, 0))\n    elif trades < 2: best = max(best, -p[i] + f(i + 1, trades + 1, 1))\n    return best\nprint(f(0, 0, 0))\n", gen: (rng, small) => { const n = small ? rng.int(1, 8) : rng.int(30, 2000); return `${n}\n${lineOf(nums(rng, n, 1, 100))}\n`; } },
    ] },
  { key: "grid-path", topic: "Graphs", difficulty: "medium", inputFormat: "Line 1: r and c. Then r lines of c characters: . is open, # is a wall. Start at the top-left cell, finish at the bottom-right.", outputFormat: "The fewest moves, or -1 if the finish cannot be reached.", constraints: ["1 <= r, c <= 100", "the start and the finish are open"],
    variants: [
      { title: "Shortest path in a maze (4 directions)", statement: "Each move goes to a neighbouring open cell up, down, left or right. Print the fewest moves from start to finish, or -1.", ref: "from collections import deque\nr, c = map(int, input().split())\ng = [input().strip() for _ in range(r)]\nd = {(0, 0): 0}\nq = deque([(0, 0)])\nwhile q:\n    x, y = q.popleft()\n    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):\n        a, b = x + dx, y + dy\n        if 0 <= a < r and 0 <= b < c and g[a][b] == '.' and (a, b) not in d:\n            d[(a, b)] = d[(x, y)] + 1\n            q.append((a, b))\nprint(d.get((r - 1, c - 1), -1))\n",
        alt: "r, c = map(int, input().split())\ng = [input().strip() for _ in range(r)]\nINF = 10 ** 9\nd = [[INF] * c for _ in range(r)]\nd[0][0] = 0\nfor _ in range(r * c):\n    for i in range(r):\n        for j in range(c):\n            if g[i][j] == '.':\n                for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):\n                    a, b = i + di, j + dj\n                    if 0 <= a < r and 0 <= b < c and d[a][b] + 1 < d[i][j]: d[i][j] = d[a][b] + 1\nprint(d[r - 1][c - 1] if d[r - 1][c - 1] < INF else -1)\n",
        gen: (rng, small) => { const r = small ? rng.int(1, 5) : rng.int(8, 30), c = small ? rng.int(1, 5) : rng.int(8, 30); const g = Array.from({ length: r }, () => Array.from({ length: c }, () => (rng.chance(0.25) ? "#" : "."))); g[0][0] = "."; g[r - 1][c - 1] = "."; return `${r} ${c}\n${g.map((row) => row.join("")).join("\n")}\n`; } },
      { title: "Shortest path in a maze (8 directions)", statement: "Each move goes to any of the 8 neighbouring open cells (diagonals allowed). Print the fewest moves from start to finish, or -1.", ref: "from collections import deque\nr, c = map(int, input().split())\ng = [input().strip() for _ in range(r)]\nd = {(0, 0): 0}\nq = deque([(0, 0)])\nwhile q:\n    x, y = q.popleft()\n    for dx in (-1, 0, 1):\n        for dy in (-1, 0, 1):\n            a, b = x + dx, y + dy\n            if (dx or dy) and 0 <= a < r and 0 <= b < c and g[a][b] == '.' and (a, b) not in d:\n                d[(a, b)] = d[(x, y)] + 1\n                q.append((a, b))\nprint(d.get((r - 1, c - 1), -1))\n",
        alt: "r, c = map(int, input().split())\ng = [input().strip() for _ in range(r)]\nINF = 10 ** 9\nd = [[INF] * c for _ in range(r)]\nd[0][0] = 0\nfor _ in range(r * c):\n    for i in range(r):\n        for j in range(c):\n            if g[i][j] == '.':\n                for di in (-1, 0, 1):\n                    for dj in (-1, 0, 1):\n                        a, b = i + di, j + dj\n                        if (di or dj) and 0 <= a < r and 0 <= b < c and d[a][b] + 1 < d[i][j]: d[i][j] = d[a][b] + 1\nprint(d[r - 1][c - 1] if d[r - 1][c - 1] < INF else -1)\n",
        gen: (rng, small) => { const r = small ? rng.int(1, 5) : rng.int(8, 30), c = small ? rng.int(1, 5) : rng.int(8, 30); const g = Array.from({ length: r }, () => Array.from({ length: c }, () => (rng.chance(0.35) ? "#" : "."))); g[0][0] = "."; g[r - 1][c - 1] = "."; return `${r} ${c}\n${g.map((row) => row.join("")).join("\n")}\n`; } },
    ] },
  { key: "shortest", topic: "Graphs", difficulty: "hard", inputFormat: "Line 1: n and m. Then m lines, each with u v w: an edge between towns u and v of length w (towns are numbered 1 to n).", outputFormat: "The shortest distance from town 1 to town n, or -1 if there is no route.", constraints: ["2 <= n <= 2000", "0 <= m <= 10000", "1 <= w <= 1000"],
    variants: [
      { title: "Shortest route on a road map", statement: "Roads can be driven in BOTH directions. Print the length of the shortest route from town 1 to town n.", difficulty: "hard", ref: "import heapq\nn, m = map(int, input().split())\nadj = [[] for _ in range(n + 1)]\nfor _ in range(m):\n    u, v, w = map(int, input().split())\n    adj[u].append((v, w))\n    adj[v].append((u, w))\nINF = 10 ** 18\nd = [INF] * (n + 1)\nd[1] = 0\nh = [(0, 1)]\nwhile h:\n    x, u = heapq.heappop(h)\n    if x > d[u]: continue\n    for v, w in adj[u]:\n        if x + w < d[v]:\n            d[v] = x + w\n            heapq.heappush(h, (d[v], v))\nprint(d[n] if d[n] < INF else -1)\n",
        alt: "n, m = map(int, input().split())\ne = [tuple(map(int, input().split())) for _ in range(m)]\nINF = 10 ** 18\nd = [INF] * (n + 1)\nd[1] = 0\nfor _ in range(n):\n    for u, v, w in e:\n        if d[u] + w < d[v]: d[v] = d[u] + w\n        if d[v] + w < d[u]: d[u] = d[v] + w\nprint(d[n] if d[n] < INF else -1)\n",
        gen: (rng, small) => { const n = small ? rng.int(2, 6) : rng.int(20, 200); const m = small ? rng.int(0, 9) : rng.int(n, n * 4); const es = Array.from({ length: m }, () => `${rng.int(1, n)} ${rng.int(1, n)} ${rng.int(1, 40)}`); return `${n} ${m}\n${es.join("\n")}${m ? "\n" : ""}`; } },
      { title: "Shortest route on one-way roads", statement: "Every road is ONE-WAY: it can only be driven from u to v. Print the length of the shortest route from town 1 to town n.", difficulty: "hard", ref: "import heapq\nn, m = map(int, input().split())\nadj = [[] for _ in range(n + 1)]\nfor _ in range(m):\n    u, v, w = map(int, input().split())\n    adj[u].append((v, w))\nINF = 10 ** 18\nd = [INF] * (n + 1)\nd[1] = 0\nh = [(0, 1)]\nwhile h:\n    x, u = heapq.heappop(h)\n    if x > d[u]: continue\n    for v, w in adj[u]:\n        if x + w < d[v]:\n            d[v] = x + w\n            heapq.heappush(h, (d[v], v))\nprint(d[n] if d[n] < INF else -1)\n",
        alt: "n, m = map(int, input().split())\ne = [tuple(map(int, input().split())) for _ in range(m)]\nINF = 10 ** 18\nd = [INF] * (n + 1)\nd[1] = 0\nfor _ in range(n):\n    for u, v, w in e:\n        if d[u] + w < d[v]: d[v] = d[u] + w\nprint(d[n] if d[n] < INF else -1)\n",
        gen: (rng, small) => { const n = small ? rng.int(2, 6) : rng.int(20, 200); const m = small ? rng.int(0, 9) : rng.int(n, n * 4); const es = Array.from({ length: m }, () => `${rng.int(1, n)} ${rng.int(1, n)} ${rng.int(1, 40)}`); return `${n} ${m}\n${es.join("\n")}${m ? "\n" : ""}`; } },
    ] },
];

const TESTS = 8;

/** Every problem the families define. Inputs are generated from a fixed seed, so the same code always builds the same problems and tests. */
export function buildProblems(): ProblemDef[] {
  const out: ProblemDef[] = [];
  for (const fam of FAMILIES) {
    fam.variants.forEach((v, vi) => {
      const rng = makeRng(0x9e3779b1 ^ (fam.key.length * 7919 + vi * 104729 + fam.key.charCodeAt(0) * 31));
      const inputs = Array.from({ length: TESTS }, (_, t) => v.gen(rng, t < 4));
      out.push({
        title: v.title, topic: fam.topic, difficulty: v.difficulty ?? fam.difficulty, statement: v.statement, inputFormat: fam.inputFormat, outputFormat: fam.outputFormat,
        constraints: v.constraints ?? fam.constraints, explanations: ["Follow the rules above on this input to see why the output is what it is.", "Work through this second example the same way."],
        ref: v.ref, alt: v.alt, inputs,
      });
    });
  }
  return out;
}
