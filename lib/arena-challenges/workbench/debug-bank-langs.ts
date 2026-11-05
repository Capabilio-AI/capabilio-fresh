// "Fix the bug" tasks in JavaScript, C++, C and Java. Each is a port of a Python task in debug-bank.ts (same statement, same tests, same expected
// output) plus one deliberate bug. scripts/it-debug-langs-bulk.mts compiles/runs the correct and the buggy version on every test and stores a task
// only if the correct one passes everything and the buggy one fails at least one.
import type { Bug } from "./debug-bank";

export type DebugLang = "javascript" | "cpp" | "c" | "java";
export interface LangProgram { lang: DebugLang; /** title of the Python task this ports */ ref: string; code: string; bugs: Bug[] }

const R = String.raw;
const L = (lang: DebugLang, ref: string, code: string, bugs: Bug[]): LangProgram => ({ lang, ref, code, bugs });
const READ = R`const lines = require("fs").readFileSync(0, "utf8").split("\n");`;
const CPP = R`#include <bits/stdc++.h>
using namespace std;
`;

export const LANG_PROGRAMS: LangProgram[] = [
  // ---------- Sum of digits ----------
  L("javascript", "Sum of digits", R`${READ}
let n = BigInt(lines[0].trim());
let total = 0n;
while (n > 0n) {
  total += n % 10n;
  n /= 10n;
}
console.log(total.toString());
`, [{ find: "while (n > 0n)", replace: "while (n > 1n)", note: "the loop stops one step early, so a leading digit of 1 is never added" }, { find: "total += n % 10n;", replace: "total = n % 10n;", note: "assigns instead of accumulating" }]),
  L("cpp", "Sum of digits", R`${CPP}int main() {
    long long n;
    cin >> n;
    long long total = 0;
    while (n > 0) {
        total += n % 10;
        n /= 10;
    }
    cout << total << endl;
    return 0;
}
`, [{ find: "while (n > 0)", replace: "while (n > 1)", note: "the loop stops one step early, so a leading digit of 1 is never added" }, { find: "total += n % 10;", replace: "total = n % 10;", note: "assigns instead of accumulating" }]),
  L("c", "Sum of digits", R`#include <stdio.h>
int main() {
    long long n, total = 0;
    scanf("%lld", &n);
    while (n > 0) {
        total += n % 10;
        n /= 10;
    }
    printf("%lld\n", total);
    return 0;
}
`, [{ find: "while (n > 0)", replace: "while (n > 1)", note: "the loop stops one step early, so a leading digit of 1 is never added" }, { find: "total += n % 10;", replace: "total = n % 10;", note: "assigns instead of accumulating" }]),
  L("java", "Sum of digits", R`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        long n = in.nextLong();
        long total = 0;
        while (n > 0) {
            total += n % 10;
            n /= 10;
        }
        System.out.println(total);
    }
}
`, [{ find: "while (n > 0)", replace: "while (n > 1)", note: "the loop stops one step early, so a leading digit of 1 is never added" }, { find: "total += n % 10;", replace: "total = n % 10;", note: "assigns instead of accumulating" }]),

  // ---------- Trailing zeros of n! ----------
  L("javascript", "Trailing zeros of n!", R`${READ}
const n = Number(lines[0]);
let count = 0;
let p = 5;
while (p <= n) {
  count += Math.floor(n / p);
  p *= 5;
}
console.log(count);
`, [{ find: "while (p <= n)", replace: "while (p < n)", note: "when n is exactly a power of five the last factor is skipped" }, { find: "count += Math.floor(n / p);", replace: "count += 1;", note: "counts powers of five instead of multiples of them" }]),
  L("cpp", "Trailing zeros of n!", R`${CPP}int main() {
    long long n;
    cin >> n;
    long long count = 0, p = 5;
    while (p <= n) {
        count += n / p;
        p *= 5;
    }
    cout << count << endl;
    return 0;
}
`, [{ find: "while (p <= n)", replace: "while (p < n)", note: "when n is exactly a power of five the last factor is skipped" }, { find: "count += n / p;", replace: "count += 1;", note: "counts powers of five instead of multiples of them" }]),
  L("c", "Trailing zeros of n!", R`#include <stdio.h>
int main() {
    long long n, count = 0, p = 5;
    scanf("%lld", &n);
    while (p <= n) {
        count += n / p;
        p *= 5;
    }
    printf("%lld\n", count);
    return 0;
}
`, [{ find: "while (p <= n)", replace: "while (p < n)", note: "when n is exactly a power of five the last factor is skipped" }, { find: "count += n / p;", replace: "count += 1;", note: "counts powers of five instead of multiples of them" }]),
  L("java", "Trailing zeros of n!", R`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        long n = in.nextLong();
        long count = 0, p = 5;
        while (p <= n) {
            count += n / p;
            p *= 5;
        }
        System.out.println(count);
    }
}
`, [{ find: "while (p <= n)", replace: "while (p < n)", note: "when n is exactly a power of five the last factor is skipped" }, { find: "count += n / p;", replace: "count += 1;", note: "counts powers of five instead of multiples of them" }]),

  // ---------- Nth Fibonacci number ----------
  L("javascript", "Nth Fibonacci number", R`${READ}
const n = Number(lines[0]);
let a = 0n, b = 1n;
for (let i = 0; i < n; i++) {
  const t = a + b;
  a = b;
  b = t;
}
console.log(a.toString());
`, [{ find: "let a = 0n, b = 1n;", replace: "let a = 1n, b = 1n;", note: "the sequence starts from the wrong values" }, { find: "i < n;", replace: "i < n - 1;", note: "one step too few" }]),
  L("cpp", "Nth Fibonacci number", R`${CPP}int main() {
    int n;
    cin >> n;
    long long a = 0, b = 1;
    for (int i = 0; i < n; i++) {
        long long t = a + b;
        a = b;
        b = t;
    }
    cout << a << endl;
    return 0;
}
`, [{ find: "long long a = 0, b = 1;", replace: "long long a = 1, b = 1;", note: "the sequence starts from the wrong values" }, { find: "i < n;", replace: "i < n - 1;", note: "one step too few" }]),
  L("c", "Nth Fibonacci number", R`#include <stdio.h>
int main() {
    int n;
    scanf("%d", &n);
    long long a = 0, b = 1;
    for (int i = 0; i < n; i++) {
        long long t = a + b;
        a = b;
        b = t;
    }
    printf("%lld\n", a);
    return 0;
}
`, [{ find: "long long a = 0, b = 1;", replace: "long long a = 1, b = 1;", note: "the sequence starts from the wrong values" }, { find: "i < n;", replace: "i < n - 1;", note: "one step too few" }]),
  L("java", "Nth Fibonacci number", R`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        long a = 0, b = 1;
        for (int i = 0; i < n; i++) {
            long t = a + b;
            a = b;
            b = t;
        }
        System.out.println(a);
    }
}
`, [{ find: "long a = 0, b = 1;", replace: "long a = 1, b = 1;", note: "the sequence starts from the wrong values" }, { find: "i < n;", replace: "i < n - 1;", note: "one step too few" }]),

  // ---------- GCD of a list ----------
  L("javascript", "GCD of a list", R`${READ}
const nums = lines[1].trim().split(/\s+/).map(Number);
function gcd(a, b) {
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}
let g = 0;
for (const x of nums) g = gcd(g, x);
console.log(g);
`, [{ find: "let g = 0;", replace: "let g = 1;", note: "starting the running gcd at 1 makes the answer always 1" }, { find: "  return a;", replace: "  return b;", note: "returns the remainder (always 0) instead of the divisor" }]),
  L("cpp", "GCD of a list", R`${CPP}long long gcd(long long a, long long b) {
    while (b) {
        long long t = a % b;
        a = b;
        b = t;
    }
    return a;
}
int main() {
    int n;
    cin >> n;
    long long g = 0;
    for (int i = 0; i < n; i++) {
        long long x;
        cin >> x;
        g = gcd(g, x);
    }
    cout << g << endl;
    return 0;
}
`, [{ find: "long long g = 0;", replace: "long long g = 1;", note: "starting the running gcd at 1 makes the answer always 1" }, { find: "    return a;", replace: "    return b;", note: "returns the remainder (always 0) instead of the divisor" }]),
  L("c", "GCD of a list", R`#include <stdio.h>
long long gcd(long long a, long long b) {
    while (b) {
        long long t = a % b;
        a = b;
        b = t;
    }
    return a;
}
int main() {
    int n;
    long long g = 0, x;
    scanf("%d", &n);
    for (int i = 0; i < n; i++) {
        scanf("%lld", &x);
        g = gcd(g, x);
    }
    printf("%lld\n", g);
    return 0;
}
`, [{ find: "long long g = 0, x;", replace: "long long g = 1, x;", note: "starting the running gcd at 1 makes the answer always 1" }, { find: "    return a;", replace: "    return b;", note: "returns the remainder (always 0) instead of the divisor" }]),
  L("java", "GCD of a list", R`import java.util.*;

public class Main {
    static long gcd(long a, long b) {
        while (b != 0) {
            long t = a % b;
            a = b;
            b = t;
        }
        return a;
    }

    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        long g = 0;
        for (int i = 0; i < n; i++) g = gcd(g, in.nextLong());
        System.out.println(g);
    }
}
`, [{ find: "long g = 0;", replace: "long g = 1;", note: "starting the running gcd at 1 makes the answer always 1" }, { find: "        return a;", replace: "        return b;", note: "returns the remainder (always 0) instead of the divisor" }]),

  // ---------- Binary search ----------
  L("javascript", "Binary search", R`${READ}
const n = Number(lines[0]);
const a = lines[1].trim().split(/\s+/).map(Number);
const t = Number(lines[2]);
let lo = 0, hi = n - 1, ans = -1;
while (lo <= hi) {
  const mid = Math.floor((lo + hi) / 2);
  if (a[mid] === t) {
    ans = mid;
    break;
  }
  if (a[mid] < t) lo = mid + 1;
  else hi = mid - 1;
}
console.log(ans);
`, [{ find: "while (lo <= hi)", replace: "while (lo < hi)", note: "the last remaining candidate is never examined" }, { find: "ans = mid;", replace: "ans = mid + 1;", note: "reports a 1-based position instead of the 0-based index" }]),
  L("cpp", "Binary search", R`${CPP}int main() {
    int n;
    cin >> n;
    vector<long long> a(n);
    for (auto &x : a) cin >> x;
    long long t;
    cin >> t;
    int lo = 0, hi = n - 1, ans = -1;
    while (lo <= hi) {
        int mid = (lo + hi) / 2;
        if (a[mid] == t) {
            ans = mid;
            break;
        }
        if (a[mid] < t) lo = mid + 1;
        else hi = mid - 1;
    }
    cout << ans << endl;
    return 0;
}
`, [{ find: "while (lo <= hi)", replace: "while (lo < hi)", note: "the last remaining candidate is never examined" }, { find: "ans = mid;", replace: "ans = mid + 1;", note: "reports a 1-based position instead of the 0-based index" }]),
  L("c", "Binary search", R`#include <stdio.h>
int main() {
    int n;
    static long long a[100005];
    long long t;
    scanf("%d", &n);
    for (int i = 0; i < n; i++) scanf("%lld", &a[i]);
    scanf("%lld", &t);
    int lo = 0, hi = n - 1, ans = -1;
    while (lo <= hi) {
        int mid = (lo + hi) / 2;
        if (a[mid] == t) {
            ans = mid;
            break;
        }
        if (a[mid] < t) lo = mid + 1;
        else hi = mid - 1;
    }
    printf("%d\n", ans);
    return 0;
}
`, [{ find: "while (lo <= hi)", replace: "while (lo < hi)", note: "the last remaining candidate is never examined" }, { find: "ans = mid;", replace: "ans = mid + 1;", note: "reports a 1-based position instead of the 0-based index" }]),
  L("java", "Binary search", R`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        long[] a = new long[n];
        for (int i = 0; i < n; i++) a[i] = in.nextLong();
        long t = in.nextLong();
        int lo = 0, hi = n - 1, ans = -1;
        while (lo <= hi) {
            int mid = (lo + hi) / 2;
            if (a[mid] == t) {
                ans = mid;
                break;
            }
            if (a[mid] < t) lo = mid + 1;
            else hi = mid - 1;
        }
        System.out.println(ans);
    }
}
`, [{ find: "while (lo <= hi)", replace: "while (lo < hi)", note: "the last remaining candidate is never examined" }, { find: "ans = mid;", replace: "ans = mid + 1;", note: "reports a 1-based position instead of the 0-based index" }]),

  // ---------- Grade from marks ----------
  L("javascript", "Grade from marks", R`${READ}
const marks = Number(lines[0]);
if (marks >= 90) console.log("A");
else if (marks >= 75) console.log("B");
else if (marks >= 60) console.log("C");
else if (marks >= 40) console.log("D");
else console.log("F");
`, [{ find: "marks >= 75", replace: "marks > 75", note: "exactly 75 falls through to a lower grade" }, { find: "marks >= 40", replace: "marks > 40", note: "exactly 40 fails when it should pass" }]),
  L("cpp", "Grade from marks", R`${CPP}int main() {
    int marks;
    cin >> marks;
    if (marks >= 90) cout << "A" << endl;
    else if (marks >= 75) cout << "B" << endl;
    else if (marks >= 60) cout << "C" << endl;
    else if (marks >= 40) cout << "D" << endl;
    else cout << "F" << endl;
    return 0;
}
`, [{ find: "marks >= 75", replace: "marks > 75", note: "exactly 75 falls through to a lower grade" }, { find: "marks >= 40", replace: "marks > 40", note: "exactly 40 fails when it should pass" }]),
  L("c", "Grade from marks", R`#include <stdio.h>
int main() {
    int marks;
    scanf("%d", &marks);
    if (marks >= 90) printf("A\n");
    else if (marks >= 75) printf("B\n");
    else if (marks >= 60) printf("C\n");
    else if (marks >= 40) printf("D\n");
    else printf("F\n");
    return 0;
}
`, [{ find: "marks >= 75", replace: "marks > 75", note: "exactly 75 falls through to a lower grade" }, { find: "marks >= 40", replace: "marks > 40", note: "exactly 40 fails when it should pass" }]),
  L("java", "Grade from marks", R`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int marks = in.nextInt();
        if (marks >= 90) System.out.println("A");
        else if (marks >= 75) System.out.println("B");
        else if (marks >= 60) System.out.println("C");
        else if (marks >= 40) System.out.println("D");
        else System.out.println("F");
    }
}
`, [{ find: "marks >= 75", replace: "marks > 75", note: "exactly 75 falls through to a lower grade" }, { find: "marks >= 40", replace: "marks > 40", note: "exactly 40 fails when it should pass" }]),

  // ---------- JavaScript and C++ only: more of the numeric set ----------
  L("javascript", "Count primes up to n", R`${READ}
const n = Number(lines[0]);
const sieve = new Uint8Array(n + 1).fill(1);
sieve[0] = 0;
sieve[1] = 0;
for (let i = 2; i * i <= n; i++) {
  if (sieve[i]) {
    for (let j = i * i; j <= n; j += i) sieve[j] = 0;
  }
}
let count = 0;
for (let i = 0; i <= n; i++) count += sieve[i];
console.log(count);
`, [{ find: "i * i <= n", replace: "i * i < n", note: "when n is a perfect square its root is never used to cross out multiples" }, { find: "j <= n", replace: "j < n", note: "n itself is never crossed out" }]),
  L("cpp", "Count primes up to n", R`${CPP}int main() {
    int n;
    cin >> n;
    vector<bool> sieve(n + 1, true);
    sieve[0] = false;
    sieve[1] = false;
    for (long long i = 2; i * i <= n; i++) {
        if (sieve[i]) {
            for (long long j = i * i; j <= n; j += i) sieve[j] = false;
        }
    }
    int count = 0;
    for (int i = 0; i <= n; i++) count += sieve[i];
    cout << count << endl;
    return 0;
}
`, [{ find: "i * i <= n", replace: "i * i < n", note: "when n is a perfect square its root is never used to cross out multiples" }, { find: "j <= n", replace: "j < n", note: "n itself is never crossed out" }]),
  L("javascript", "Maximum subarray sum", R`${READ}
const a = lines[1].trim().split(/\s+/).map(Number);
let best = a[0], cur = a[0];
for (let i = 1; i < a.length; i++) {
  cur = Math.max(a[i], cur + a[i]);
  best = Math.max(best, cur);
}
console.log(best);
`, [{ find: "let best = a[0], cur = a[0];", replace: "let best = 0, cur = 0;", note: "an all-negative list wrongly gives 0" }, { find: "cur = Math.max(a[i], cur + a[i]);", replace: "cur = Math.max(0, cur + a[i]);", note: "allows an empty subarray, which the task forbids" }]),
  L("cpp", "Maximum subarray sum", R`${CPP}int main() {
    int n;
    cin >> n;
    vector<long long> a(n);
    for (auto &x : a) cin >> x;
    long long best = a[0], cur = a[0];
    for (int i = 1; i < n; i++) {
        cur = max(a[i], cur + a[i]);
        best = max(best, cur);
    }
    cout << best << endl;
    return 0;
}
`, [{ find: "long long best = a[0], cur = a[0];", replace: "long long best = 0, cur = 0;", note: "an all-negative list wrongly gives 0" }, { find: "cur = max(a[i], cur + a[i]);", replace: "cur = max(0LL, cur + a[i]);", note: "allows an empty subarray, which the task forbids" }]),
  L("javascript", "Count leap years", R`${READ}
const [a, b] = lines[0].trim().split(/\s+/).map(Number);
const leap = (y) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
let count = 0;
for (let y = a; y <= b; y++) if (leap(y)) count++;
console.log(count);
`, [{ find: " || y % 400 === 0", replace: "", note: "the year 2000 is a leap year, but this treats every century as a common year" }, { find: "y <= b", replace: "y < b", note: "the last year of the range is skipped" }]),
  L("cpp", "Count leap years", R`${CPP}bool leap(int y) {
    return y % 4 == 0 && (y % 100 != 0 || y % 400 == 0);
}
int main() {
    int a, b;
    cin >> a >> b;
    int count = 0;
    for (int y = a; y <= b; y++) if (leap(y)) count++;
    cout << count << endl;
    return 0;
}
`, [{ find: " || y % 400 == 0", replace: "", note: "the year 2000 is a leap year, but this treats every century as a common year" }, { find: "y <= b", replace: "y < b", note: "the last year of the range is skipped" }]),
  L("javascript", "Collatz steps", R`${READ}
let n = Number(lines[0]);
let steps = 0;
while (n !== 1) {
  n = n % 2 === 0 ? n / 2 : 3 * n + 1;
  steps += 1;
}
console.log(steps);
`, [{ find: "steps += 1;", replace: "steps += 2;", note: "every step is counted twice" }, { find: "let steps = 0;", replace: "let steps = 1;", note: "counts one step before any work is done" }]),
  L("cpp", "Collatz steps", R`${CPP}int main() {
    long long n;
    cin >> n;
    int steps = 0;
    while (n != 1) {
        n = (n % 2 == 0) ? n / 2 : 3 * n + 1;
        steps += 1;
    }
    cout << steps << endl;
    return 0;
}
`, [{ find: "steps += 1;", replace: "steps += 2;", note: "every step is counted twice" }, { find: "int steps = 0;", replace: "int steps = 1;", note: "counts one step before any work is done" }]),
  L("javascript", "Range sums", R`${READ}
const [n, q] = lines[0].trim().split(/\s+/).map(Number);
const a = lines[1].trim().split(/\s+/).map(Number);
const pre = [0];
for (const x of a) pre.push(pre[pre.length - 1] + x);
const out = [];
for (let i = 0; i < q; i++) {
  const [l, r] = lines[2 + i].trim().split(/\s+/).map(Number);
  out.push(pre[r] - pre[l - 1]);
}
console.log(out.join("\n"));
`, [{ find: "pre[r] - pre[l - 1]", replace: "pre[r] - pre[l]", note: "the element at position l is left out of the sum" }, { find: "pre.push(pre[pre.length - 1] + x)", replace: "pre.push(x)", note: "stores single values instead of running totals" }]),
  L("cpp", "Range sums", R`${CPP}int main() {
    int n, q;
    cin >> n >> q;
    vector<long long> pre(n + 1, 0);
    for (int i = 0; i < n; i++) {
        long long x;
        cin >> x;
        pre[i + 1] = pre[i] + x;
    }
    while (q--) {
        int l, r;
        cin >> l >> r;
        cout << pre[r] - pre[l - 1] << "\n";
    }
    return 0;
}
`, [{ find: "pre[r] - pre[l - 1]", replace: "pre[r] - pre[l]", note: "the element at position l is left out of the sum" }, { find: "pre[i + 1] = pre[i] + x;", replace: "pre[i + 1] = x;", note: "stores single values instead of running totals" }]),
];
