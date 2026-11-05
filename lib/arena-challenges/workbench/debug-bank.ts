// "Fix the bug" tasks: a short Python program that is almost right. The student reads it, finds the bug, fixes it and the hidden tests pass.
// Each task is a correct program plus one deliberate bug (an exact text replacement). scripts/it-debug-bulk.mts runs the correct and the
// buggy version on every test and only stores a task when the correct one passes and the buggy one fails at least one test.
export type Difficulty = "easy" | "medium" | "hard";

export interface Bug {
  /** exact text in the correct program */
  find: string;
  replace: string;
  /** what the bug is, shown after the student has solved it (and to reviewers) */
  note: string;
}

export interface DebugProgram {
  title: string;
  topic: string;
  difficulty: Difficulty;
  /** what the program must do: the student's only specification */
  statement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string[];
  code: string;
  bugs: Bug[];
  /** stdin for every test; the first two are shown to the student as examples */
  inputs: string[];
}

const P = (p: DebugProgram) => p;

export const DEBUG_PROGRAMS: DebugProgram[] = [
  P({
    title: "Sum of digits", topic: "Loops & arithmetic", difficulty: "easy",
    statement: "Read a non-negative integer and print the sum of its decimal digits.",
    inputFormat: "One integer n.", outputFormat: "One integer: the digit sum.", constraints: ["0 <= n <= 10^18"],
    code: "n = int(input())\ntotal = 0\nwhile n > 0:\n    total += n % 10\n    n //= 10\nprint(total)\n",
    bugs: [{ find: "while n > 0:", replace: "while n > 1:", note: "the loop stops one step early, so a leading digit of 1 is never added" }, { find: "total += n % 10", replace: "total = n % 10", note: "assigns instead of accumulating" }],
    inputs: ["12345\n", "1000\n", "7\n", "999\n", "10\n", "90909\n", "1\n", "0\n"],
  }),
  P({
    title: "Second largest distinct value", topic: "Arrays", difficulty: "medium",
    statement: "Print the second largest DISTINCT value in the list. If every element is equal, print None.",
    inputFormat: "Line 1: n. Line 2: n integers.", outputFormat: "The second largest distinct value, or None.", constraints: ["1 <= n <= 10^5", "-10^9 <= a[i] <= 10^9"],
    code: "n = int(input())\na = list(map(int, input().split()))\nfirst = second = None\nfor x in a:\n    if first is None or x > first:\n        second = first\n        first = x\n    elif x != first and (second is None or x > second):\n        second = x\nprint(second)\n",
    bugs: [{ find: "elif x != first and (second is None or x > second):", replace: "elif second is None or x > second:", note: "a value equal to the maximum can become the second largest" }, { find: "if first is None or x > first:", replace: "if first is None or x >= first:", note: "a repeated maximum pushes itself into second place" }],
    inputs: ["5\n3 1 4 4 2\n", "3\n7 7 7\n", "4\n10 9 9 8\n", "2\n5 5\n", "6\n1 2 3 4 5 5\n", "1\n9\n", "5\n-1 -2 -2 -3 -1\n", "4\n2 2 1 1\n"],
  }),
  P({
    title: "Palindrome, ignoring case and symbols", topic: "Strings", difficulty: "easy",
    statement: "Print YES if the text reads the same forwards and backwards when only letters and digits are kept and case is ignored; otherwise print NO.",
    inputFormat: "One line of text.", outputFormat: "YES or NO.", constraints: ["1 <= length <= 10^5"],
    code: "s = input()\nt = [c.lower() for c in s if c.isalnum()]\nprint(\"YES\" if t == t[::-1] else \"NO\")\n",
    bugs: [{ find: "c.lower() for", replace: "c for", note: "case is not ignored" }, { find: "c.isalnum()", replace: "c.isalpha()", note: "digits are thrown away along with the symbols" }],
    inputs: ["A man, a plan, a canal: Panama\n", "race a car\n", "Was it a car or a cat I saw?\n", "12321\n", "1a2\n", "No 'x' in Nixon\n", "ab\n", "0P\n"],
  }),
  P({
    title: "Count vowels", topic: "Strings", difficulty: "easy",
    statement: "Count the vowels (a, e, i, o, u, in either case) in a line of text and print the count.",
    inputFormat: "One line of text.", outputFormat: "One integer.", constraints: ["0 <= length <= 10^5"],
    code: "s = input().lower()\nprint(sum(1 for c in s if c in \"aeiou\"))\n",
    bugs: [{ find: "\"aeiou\"", replace: "\"aeio\"", note: "u is missing from the vowel list" }, { find: "input().lower()", replace: "input()", note: "capital vowels are not counted" }],
    inputs: ["hello world\n", "AEIOU\n", "rhythm\n", "Education\n", "queue\n", "UNDER\n", "xyz\n", "Capabilio AI\n"],
  }),
  P({
    title: "Trailing zeros of n!", topic: "Math", difficulty: "medium",
    statement: "Print how many zeros n! (n factorial) ends with.",
    inputFormat: "One integer n.", outputFormat: "One integer.", constraints: ["0 <= n <= 10^9"],
    code: "n = int(input())\ncount = 0\np = 5\nwhile p <= n:\n    count += n // p\n    p *= 5\nprint(count)\n",
    bugs: [{ find: "while p <= n:", replace: "while p < n:", note: "when n is exactly a power of five the last factor is skipped" }, { find: "count += n // p", replace: "count += 1", note: "counts powers of five instead of multiples of them" }],
    inputs: ["5\n", "25\n", "100\n", "0\n", "10\n", "125\n", "30\n", "1000\n"],
  }),
  P({
    title: "Binary search", topic: "Searching", difficulty: "medium",
    statement: "Given a sorted list of distinct integers and a target, print the target's 0-based index, or -1 if it is not in the list.",
    inputFormat: "Line 1: n. Line 2: n sorted integers. Line 3: the target.", outputFormat: "One integer.", constraints: ["1 <= n <= 10^5"],
    code: "n = int(input())\na = list(map(int, input().split()))\nt = int(input())\nlo, hi = 0, n - 1\nans = -1\nwhile lo <= hi:\n    mid = (lo + hi) // 2\n    if a[mid] == t:\n        ans = mid\n        break\n    if a[mid] < t:\n        lo = mid + 1\n    else:\n        hi = mid - 1\nprint(ans)\n",
    bugs: [{ find: "while lo <= hi:", replace: "while lo < hi:", note: "the last remaining candidate is never examined" }, { find: "lo, hi = 0, n - 1", replace: "lo, hi = 0, n", note: "hi starts one past the end, so a large target reads outside the list" }],
    inputs: ["5\n1 3 5 7 9\n7\n", "5\n1 3 5 7 9\n4\n", "1\n5\n5\n", "6\n2 4 6 8 10 12\n12\n", "6\n2 4 6 8 10 12\n20\n", "3\n1 2 3\n1\n", "2\n1 2\n2\n", "4\n10 20 30 40\n25\n"],
  }),
  P({
    title: "Nth Fibonacci number", topic: "Loops & arithmetic", difficulty: "easy",
    statement: "Print the n-th Fibonacci number where F(0) = 0 and F(1) = 1.",
    inputFormat: "One integer n.", outputFormat: "One integer.", constraints: ["0 <= n <= 90"],
    code: "n = int(input())\na, b = 0, 1\nfor _ in range(n):\n    a, b = b, a + b\nprint(a)\n",
    bugs: [{ find: "a, b = 0, 1", replace: "a, b = 1, 1", note: "the sequence starts from the wrong values" }, { find: "range(n)", replace: "range(n - 1)", note: "one step too few" }],
    inputs: ["10\n", "0\n", "1\n", "2\n", "50\n", "7\n", "90\n", "20\n"],
  }),
  P({
    title: "GCD of a list", topic: "Math", difficulty: "medium",
    statement: "Print the greatest common divisor of all the numbers in the list.",
    inputFormat: "Line 1: n. Line 2: n positive integers.", outputFormat: "One integer.", constraints: ["1 <= n <= 10^5", "1 <= a[i] <= 10^9"],
    code: "n = int(input())\nnums = list(map(int, input().split()))\n\ndef gcd(a, b):\n    while b:\n        a, b = b, a % b\n    return a\n\ng = 0\nfor x in nums:\n    g = gcd(g, x)\nprint(g)\n",
    bugs: [{ find: "g = 0\nfor", replace: "g = 1\nfor", note: "starting the running gcd at 1 makes the answer always 1" }, { find: "    return a\n", replace: "    return b\n", note: "returns the remainder (always 0) instead of the divisor" }],
    inputs: ["3\n12 18 24\n", "2\n7 13\n", "1\n42\n", "4\n100 75 50 25\n", "3\n8 16 32\n", "2\n1000000000 500000000\n", "3\n9 6 3\n", "2\n17 34\n"],
  }),
  P({
    title: "Count primes up to n", topic: "Math", difficulty: "medium",
    statement: "Print how many prime numbers are less than or equal to n.",
    inputFormat: "One integer n.", outputFormat: "One integer.", constraints: ["2 <= n <= 10^6"],
    code: "n = int(input())\nsieve = [True] * (n + 1)\nsieve[0:2] = [False] * min(2, n + 1)\ni = 2\nwhile i * i <= n:\n    if sieve[i]:\n        for j in range(i * i, n + 1, i):\n            sieve[j] = False\n    i += 1\nprint(sum(sieve))\n",
    bugs: [{ find: "while i * i <= n:", replace: "while i * i < n:", note: "when n is a perfect square its root is never used to cross out multiples" }, { find: "range(i * i, n + 1, i)", replace: "range(i * i, n, i)", note: "n itself is never crossed out" }],
    inputs: ["10\n", "2\n", "30\n", "100\n", "9\n", "25\n", "49\n", "1000\n"],
  }),
  P({
    title: "Reverse the words", topic: "Strings", difficulty: "easy",
    statement: "Reverse the order of the words in a line. Words are separated by one or more spaces; print them separated by a single space.",
    inputFormat: "One line of text.", outputFormat: "The words in reverse order.", constraints: ["1 <= words <= 10^4"],
    code: "words = input().split()\nprint(\" \".join(reversed(words)))\n",
    bugs: [{ find: "input().split()", replace: "input().split(\" \")", note: "splitting on a single space leaves empty words when there are repeated spaces" }, { find: "\" \".join(", replace: "\"\".join(", note: "the words run together" }],
    inputs: ["hello world\n", "one  two   three\n", "a\n", "the quick brown fox\n", "  spaced   out  \n", "x y\n", "to be or not to be\n", "capabilio  arena\n"],
  }),
  P({
    title: "Anagrams", topic: "Strings", difficulty: "easy",
    statement: "Print YES if the two lines contain exactly the same letters with the same counts (ignoring case), otherwise NO.",
    inputFormat: "Two lines of text.", outputFormat: "YES or NO.", constraints: ["1 <= length <= 10^5"],
    code: "a = input().strip().lower()\nb = input().strip().lower()\nprint(\"YES\" if sorted(a) == sorted(b) else \"NO\")\n",
    bugs: [{ find: "sorted(a) == sorted(b)", replace: "set(a) == set(b)", note: "a set forgets how many times each letter appears" }, { find: "a = input().strip().lower()", replace: "a = input().strip()", note: "case is ignored for only one of the two lines" }],
    inputs: ["listen\nsilent\n", "aab\nabb\n", "Dormitory\ndirtyroom\n", "abc\nabcd\n", "Hello\nhello\n", "aabb\nab\n", "rat\ntar\n", "night\nthing\n"],
  }),
  P({
    title: "Maximum subarray sum", topic: "Dynamic programming", difficulty: "medium",
    statement: "Print the largest sum of a non-empty contiguous part of the list.",
    inputFormat: "Line 1: n. Line 2: n integers (may be negative).", outputFormat: "One integer.", constraints: ["1 <= n <= 10^5"],
    code: "n = int(input())\na = list(map(int, input().split()))\nbest = cur = a[0]\nfor x in a[1:]:\n    cur = max(x, cur + x)\n    best = max(best, cur)\nprint(best)\n",
    bugs: [{ find: "best = cur = a[0]", replace: "best = cur = 0", note: "an all-negative list wrongly gives 0" }, { find: "cur = max(x, cur + x)", replace: "cur = max(0, cur + x)", note: "allows an empty subarray, which the task forbids" }],
    inputs: ["5\n1 -2 3 4 -1\n", "3\n-3 -1 -2\n", "1\n-5\n", "6\n2 3 -10 4 5 6\n", "4\n5 -1 5 -1\n", "2\n-1 -1\n", "5\n-2 1 -3 4 -1\n", "3\n10 -20 10\n"],
  }),
  P({
    title: "Balanced brackets", topic: "Stacks", difficulty: "medium",
    statement: "A line contains only the characters ( ) [ ] { }. Print YES if the brackets are balanced and properly nested, otherwise NO.",
    inputFormat: "One line of brackets.", outputFormat: "YES or NO.", constraints: ["1 <= length <= 10^5"],
    code: "s = input().strip()\nstack = []\npairs = {\")\": \"(\", \"]\": \"[\", \"}\": \"{\"}\nok = True\nfor c in s:\n    if c in \"([{\":\n        stack.append(c)\n    elif c in pairs:\n        if not stack or stack.pop() != pairs[c]:\n            ok = False\n            break\nprint(\"YES\" if ok and not stack else \"NO\")\n",
    bugs: [{ find: "ok and not stack", replace: "ok", note: "brackets still open at the end are ignored" }, { find: "if not stack or stack.pop() != pairs[c]:", replace: "if stack.pop() != pairs[c]:", note: "a closing bracket with nothing open crashes the program" }],
    inputs: ["()[]{}\n", "([)]\n", "((\n", "{[()]}\n", ")(\n", "(((())))\n", "[\n", "{[}]\n"],
  }),
  P({
    title: "Rotate right by k", topic: "Arrays", difficulty: "medium",
    statement: "Rotate the list to the right by k positions (the last k elements move to the front) and print it.",
    inputFormat: "Line 1: n and k. Line 2: n values.", outputFormat: "The rotated list on one line, space separated.", constraints: ["1 <= n <= 10^5", "0 <= k <= 10^9"],
    code: "n, k = map(int, input().split())\na = input().split()\nk %= n\nprint(\" \".join(a[-k:] + a[:-k]) if k else \" \".join(a))\n",
    bugs: [{ find: "k %= n\n", replace: "", note: "k larger than n is not reduced" }, { find: "a[-k:] + a[:-k]", replace: "a[:-k] + a[-k:]", note: "the two parts are joined in the wrong order, which rotates nothing" }],
    inputs: ["5 2\n1 2 3 4 5\n", "5 7\n1 2 3 4 5\n", "3 0\na b c\n", "4 4\n1 2 3 4\n", "6 1\n9 8 7 6 5 4\n", "2 3\nx y\n", "5 10\n1 2 3 4 5\n", "1 5\n7\n"],
  }),
  P({
    title: "Most frequent value", topic: "Hashing", difficulty: "easy",
    statement: "Print the value that appears most often in the list. If several values tie, print the smallest of them.",
    inputFormat: "Line 1: n. Line 2: n integers.", outputFormat: "One integer.", constraints: ["1 <= n <= 10^5"],
    code: "n = int(input())\na = list(map(int, input().split()))\ncnt = {}\nfor x in a:\n    cnt[x] = cnt.get(x, 0) + 1\nbest = max(cnt.values())\nprint(min(k for k, v in cnt.items() if v == best))\n",
    bugs: [{ find: "print(min(k", replace: "print(max(k", note: "ties should go to the smallest value" }, { find: "cnt[x] = cnt.get(x, 0) + 1", replace: "cnt[x] = 1", note: "overwrites the count instead of adding to it, so every value looks equally frequent" }],
    inputs: ["6\n1 2 2 3 3 4\n", "5\n7 7 7 1 1\n", "1\n5\n", "4\n4 3 2 1\n", "7\n5 5 6 6 7 7 7\n", "6\n9 9 8 8 8 9\n", "3\n-1 -1 2\n", "8\n1 1 2 2 3 3 4 4\n"],
  }),
  P({
    title: "Count leap years", topic: "Conditions", difficulty: "easy",
    statement: "Print how many leap years lie between two years a and b, both included. A year is a leap year if it is divisible by 4, except century years, which must be divisible by 400.",
    inputFormat: "One line: a and b.", outputFormat: "One integer.", constraints: ["1 <= a <= b <= 10^5"],
    code: "a, b = map(int, input().split())\n\ndef leap(y):\n    return y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)\n\nprint(sum(1 for y in range(a, b + 1) if leap(y)))\n",
    bugs: [{ find: " or y % 400 == 0", replace: "", note: "the year 2000 is a leap year, but this treats every century as a common year" }, { find: "range(a, b + 1)", replace: "range(a, b)", note: "the last year of the range is skipped" }],
    inputs: ["2000 2004\n", "1900 1900\n", "1996 2000\n", "2001 2003\n", "1 100\n", "2020 2020\n", "1800 2000\n", "2100 2100\n"],
  }),
  P({
    title: "Transpose a matrix", topic: "Matrices", difficulty: "easy",
    statement: "Print the transpose of an r x c matrix: c lines, each with r values separated by spaces.",
    inputFormat: "Line 1: r and c. Then r lines of c values.", outputFormat: "c lines of r values.", constraints: ["1 <= r, c <= 100"],
    code: "r, c = map(int, input().split())\nm = [input().split() for _ in range(r)]\nfor j in range(c):\n    print(\" \".join(m[i][j] for i in range(r)))\n",
    bugs: [{ find: "for j in range(c):", replace: "for j in range(r):", note: "loops over the wrong dimension for a non-square matrix" }, { find: "for i in range(r)))", replace: "for i in range(r - 1, -1, -1)))", note: "rows are read bottom to top, which flips the matrix" }],
    inputs: ["2 3\n1 2 3\n4 5 6\n", "3 2\n1 2\n3 4\n5 6\n", "1 1\n9\n", "2 2\n1 2\n3 4\n", "1 4\n1 2 3 4\n", "4 1\n1\n2\n3\n4\n", "3 3\n1 2 3\n4 5 6\n7 8 9\n", "2 4\n1 2 3 4\n5 6 7 8\n"],
  }),
  P({
    title: "Pair with a given sum", topic: "Hashing", difficulty: "medium",
    statement: "Print YES if two DIFFERENT positions in the list hold values that add up to the target, otherwise NO.",
    inputFormat: "Line 1: n and the target t. Line 2: n integers.", outputFormat: "YES or NO.", constraints: ["1 <= n <= 10^5"],
    code: "n, t = map(int, input().split())\na = list(map(int, input().split()))\nseen = set()\nfound = False\nfor x in a:\n    if t - x in seen:\n        found = True\n        break\n    seen.add(x)\nprint(\"YES\" if found else \"NO\")\n",
    bugs: [{ find: "    if t - x in seen:\n        found = True\n        break\n    seen.add(x)\n", replace: "    seen.add(x)\n    if t - x in seen:\n        found = True\n        break\n", note: "a value can pair with itself, so a lone 5 matches a target of 10" }, { find: "seen = set()", replace: "seen = {0}", note: "a phantom 0 is already in the set, so any value equal to the target matches" }],
    inputs: ["4 9\n2 7 11 15\n", "3 10\n5 1 2\n", "3 6\n3 3 1\n", "1 4\n4\n", "2 8\n4 4\n", "5 0\n-1 1 5 6 7\n", "3 5\n1 2 4\n", "4 7\n7 1 1 1\n"],
  }),
  P({
    title: "Longest run of 1s", topic: "Bits", difficulty: "medium",
    statement: "Print the length of the longest run of consecutive 1 bits in the binary form of n.",
    inputFormat: "One integer n.", outputFormat: "One integer.", constraints: ["0 <= n <= 10^18"],
    code: "n = int(input())\nbest = cur = 0\nfor ch in bin(n)[2:]:\n    if ch == \"1\":\n        cur += 1\n        best = max(best, cur)\n    else:\n        cur = 0\nprint(best)\n",
    bugs: [{ find: "    else:\n        cur = 0\n", replace: "", note: "the run is never reset on a 0 bit" }, { find: "best = max(best, cur)", replace: "best = cur", note: "keeps the latest run instead of the longest" }],
    inputs: ["13\n", "7\n", "0\n", "1\n", "1000\n", "255\n", "37\n", "1023\n"],
  }),
  P({
    title: "Run-length encoding", topic: "Strings", difficulty: "medium",
    statement: "Compress a string by replacing every run of the same character with the character followed by the run length. For example aaabcc becomes a3b1c2.",
    inputFormat: "One non-empty string without spaces.", outputFormat: "The encoded string.", constraints: ["1 <= length <= 10^5"],
    code: "s = input().strip()\nout = []\ni = 0\nwhile i < len(s):\n    j = i\n    while j < len(s) and s[j] == s[i]:\n        j += 1\n    out.append(s[i] + str(j - i))\n    i = j\nprint(\"\".join(out))\n",
    bugs: [{ find: "j < len(s) and ", replace: "", note: "reads past the end of the string when the last run ends it" }, { find: "str(j - i)", replace: "str(j - i + 1)", note: "every count is one too large" }],
    inputs: ["aaabcc\n", "abc\n", "zzzzzzzzzz\n", "aabbaa\n", "a\n", "xxyyzz\n", "abbbbbbc\n", "qqqqqqqqqqqq\n"],
  }),
  P({
    title: "Count Armstrong numbers", topic: "Loops & arithmetic", difficulty: "medium",
    statement: "An Armstrong number equals the sum of its digits each raised to the power of the number of digits (153 = 1^3 + 5^3 + 3^3). Print how many Armstrong numbers lie between 1 and n.",
    inputFormat: "One integer n.", outputFormat: "One integer.", constraints: ["1 <= n <= 10^5"],
    code: "n = int(input())\ncount = 0\nfor x in range(1, n + 1):\n    digits = str(x)\n    if sum(int(d) ** len(digits) for d in digits) == x:\n        count += 1\nprint(count)\n",
    bugs: [{ find: "range(1, n + 1)", replace: "range(1, n)", note: "n itself is never tested" }, { find: "** len(digits)", replace: "** 3", note: "uses the power 3 for numbers of every length" }],
    inputs: ["9\n", "153\n", "100\n", "1000\n", "10\n", "407\n", "99999\n", "1\n"],
  }),
  P({
    title: "Sort by frequency", topic: "Sorting", difficulty: "medium",
    statement: "Sort the list so that more frequent values come first. Values with the same frequency are ordered from smallest to largest. Print the sorted list.",
    inputFormat: "Line 1: n. Line 2: n integers.", outputFormat: "The sorted list on one line.", constraints: ["1 <= n <= 10^5"],
    code: "n = int(input())\na = list(map(int, input().split()))\nfrom collections import Counter\nc = Counter(a)\nprint(\" \".join(map(str, sorted(a, key=lambda x: (-c[x], x)))))\n",
    bugs: [{ find: "(-c[x], x)", replace: "(c[x], x)", note: "less frequent values come first" }, { find: "(-c[x], x)", replace: "(-c[x],)", note: "ties are left in input order instead of sorted by value" }],
    inputs: ["6\n4 4 1 1 1 2\n", "5\n3 1 2 2 3\n", "1\n8\n", "7\n5 5 4 4 3 3 3\n", "4\n9 8 7 6\n", "8\n2 3 2 3 1 1 4 4\n", "6\n10 10 20 20 20 5\n", "5\n1 1 1 1 1\n"],
  }),
  P({
    title: "Binary to decimal", topic: "Loops & arithmetic", difficulty: "easy",
    statement: "Read a binary number (a string of 0s and 1s) and print its decimal value.",
    inputFormat: "One binary string.", outputFormat: "One integer.", constraints: ["1 <= length <= 60"],
    code: "s = input().strip()\nv = 0\nfor ch in s:\n    v = v * 2 + int(ch)\nprint(v)\n",
    bugs: [{ find: "v = 0\n", replace: "v = 1\n", note: "starts from 1, which adds a leading bit" }, { find: "v * 2 + int(ch)", replace: "v * 2 + 1", note: "every bit is treated as 1" }],
    inputs: ["1011\n", "0\n", "1\n", "11111111\n", "100000\n", "1100100\n", "10\n", "101010\n"],
  }),
  P({
    title: "Collatz steps", topic: "Loops & arithmetic", difficulty: "easy",
    statement: "Start from n. While n is not 1: if n is even divide it by 2, otherwise replace it with 3n + 1. Print how many steps it takes to reach 1.",
    inputFormat: "One integer n.", outputFormat: "One integer.", constraints: ["1 <= n <= 10^6"],
    code: "n = int(input())\nsteps = 0\nwhile n != 1:\n    n = n // 2 if n % 2 == 0 else 3 * n + 1\n    steps += 1\nprint(steps)\n",
    bugs: [{ find: "steps += 1", replace: "steps += 2", note: "every step is counted twice" }, { find: "steps = 0\n", replace: "steps = 1\n", note: "counts one step before any work is done" }],
    inputs: ["6\n", "1\n", "27\n", "7\n", "3\n", "97\n", "16\n", "871\n"],
  }),
  P({
    title: "Diagonal difference", topic: "Matrices", difficulty: "easy",
    statement: "For a square matrix print the absolute difference between the sum of the main diagonal and the sum of the other diagonal.",
    inputFormat: "Line 1: n. Then n lines of n integers.", outputFormat: "One non-negative integer.", constraints: ["1 <= n <= 200"],
    code: "n = int(input())\nm = [list(map(int, input().split())) for _ in range(n)]\nd1 = sum(m[i][i] for i in range(n))\nd2 = sum(m[i][n - 1 - i] for i in range(n))\nprint(abs(d1 - d2))\n",
    bugs: [{ find: "print(abs(d1 - d2))", replace: "print(d1 - d2)", note: "the difference can come out negative" }, { find: "m[i][n - 1 - i] for i in range(n))", replace: "m[i][n - 1 - i] for i in range(n - 1))", note: "the last row is left out of the second diagonal" }],
    inputs: ["3\n11 2 4\n4 5 6\n10 8 -12\n", "2\n1 2\n3 4\n", "1\n5\n", "3\n1 2 3\n4 5 6\n7 8 9\n", "3\n9 1 1\n1 9 1\n1 1 9\n", "2\n5 1\n1 5\n", "3\n1 1 9\n1 5 1\n9 1 1\n", "4\n1 0 0 4\n0 2 3 0\n0 3 2 0\n4 0 0 1\n"],
  }),
  P({
    title: "Range sums", topic: "Prefix sums", difficulty: "medium",
    statement: "For each query (l, r) print the sum of the list elements from position l to position r, both included (positions start at 1).",
    inputFormat: "Line 1: n and q. Line 2: n integers. Then q lines, each with l and r.", outputFormat: "q lines, one sum each.", constraints: ["1 <= n, q <= 10^5"],
    code: "n, q = map(int, input().split())\na = list(map(int, input().split()))\npre = [0]\nfor x in a:\n    pre.append(pre[-1] + x)\nfor _ in range(q):\n    l, r = map(int, input().split())\n    print(pre[r] - pre[l - 1])\n",
    bugs: [{ find: "pre[r] - pre[l - 1]", replace: "pre[r] - pre[l]", note: "the element at position l is left out of the sum" }, { find: "pre.append(pre[-1] + x)", replace: "pre.append(x)", note: "stores single values instead of running totals" }],
    inputs: ["5 3\n1 2 3 4 5\n1 5\n2 3\n4 4\n", "3 2\n10 20 30\n1 1\n1 3\n", "1 1\n7\n1 1\n", "4 2\n-1 2 -3 4\n1 4\n2 3\n", "6 3\n1 1 1 1 1 1\n1 6\n3 5\n6 6\n", "2 1\n5 5\n2 2\n", "5 2\n5 4 3 2 1\n1 2\n4 5\n", "3 1\n0 0 0\n1 3\n"],
  }),
  P({
    title: "Grade from marks", topic: "Conditions", difficulty: "easy",
    statement: "Print the grade for a mark out of 100: A for 90 or more, B for 75 or more, C for 60 or more, D for 40 or more, otherwise F.",
    inputFormat: "One integer.", outputFormat: "One letter.", constraints: ["0 <= marks <= 100"],
    code: "marks = int(input())\nif marks >= 90:\n    print(\"A\")\nelif marks >= 75:\n    print(\"B\")\nelif marks >= 60:\n    print(\"C\")\nelif marks >= 40:\n    print(\"D\")\nelse:\n    print(\"F\")\n",
    bugs: [{ find: "elif marks >= 75:", replace: "elif marks > 75:", note: "exactly 75 falls through to a lower grade" }, { find: "elif marks >= 40:", replace: "elif marks > 40:", note: "exactly 40 fails when it should pass" }],
    inputs: ["95\n", "75\n", "40\n", "60\n", "90\n", "39\n", "100\n", "0\n"],
  }),
  P({
    title: "Longest word", topic: "Strings", difficulty: "easy",
    statement: "Print the number of words in the line and the first of the longest words, separated by a space.",
    inputFormat: "One line of words separated by spaces.", outputFormat: "count and longest word.", constraints: ["1 <= words <= 10^4"],
    code: "words = input().split()\nlongest = words[0]\nfor w in words:\n    if len(w) > len(longest):\n        longest = w\nprint(len(words), longest)\n",
    bugs: [{ find: "len(w) > len(longest)", replace: "len(w) >= len(longest)", note: "on a tie the LAST longest word wins instead of the first" }, { find: "print(len(words), longest)", replace: "print(len(set(words)), longest)", note: "repeated words are counted once" }],
    inputs: ["the quick brown fox\n", "a bb cc d\n", "hello\n", "one two three two one\n", "cat dog bat\n", "tiny enormous huge\n", "abc abc abc\n", "to be or not to be\n"],
  }),
  P({
    title: "Pascal's triangle row", topic: "Loops & arithmetic", difficulty: "medium",
    statement: "Print row n of Pascal's triangle (row 0 is just 1) as space-separated numbers.",
    inputFormat: "One integer n.", outputFormat: "The row on one line.", constraints: ["0 <= n <= 30"],
    code: "n = int(input())\nrow = [1]\nfor _ in range(n):\n    row = [1] + [row[i] + row[i + 1] for i in range(len(row) - 1)] + [1]\nprint(\" \".join(map(str, row)))\n",
    bugs: [{ find: "range(len(row) - 1)", replace: "range(len(row))", note: "reads one element past the end of the row" }, { find: "for i in range(len(row) - 1)] + [1]", replace: "for i in range(len(row) - 1)]", note: "the row is missing its closing 1" }],
    inputs: ["4\n", "0\n", "1\n", "2\n", "5\n", "10\n", "3\n", "8\n"],
  }),
];
