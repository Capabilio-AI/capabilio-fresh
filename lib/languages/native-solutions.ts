import { extraNativeSolutions } from "./c/native-extra";
import { extraNativeSolutions as extraJavaSolutions } from "./java/native-extra";
import { extraNativeSolutions as extraCppSolutions } from "./cpp/native-extra";
/**
 * An independent solution to each module problem, written in the track's own language (not Python). CI compiles and runs each one on every test of its
 * problem, so a statement that two languages read differently, or an expected output that only Python's rules produce, is found before a student is.
 * Java solutions are checked in CI only (there is no JDK on every machine): see tracks.test.ts. Keys are `<track>/<module>`.
 */
export const NATIVE_SOLUTIONS: Record<string, string> = {
  ...extraNativeSolutions,
  ...extraJavaSolutions,
  ...extraCppSolutions,
  "c/c-basics": String.raw`#include <stdio.h>
int main(void) { long n; scanf("%ld", &n); int d[] = {500, 100, 50, 20, 10, 5, 2, 1}; for (int i = 0; i < 8; i++) { printf("%d %ld\n", d[i], n / d[i]); n %= d[i]; } return 0; }
`,
  "c/c-control": String.raw`#include <stdio.h>
int main(void) { long long n; scanf("%lld", &n); int c = 0; while (n != 1) { n = n % 2 == 0 ? n / 2 : 3 * n + 1; c++; } printf("%d\n", c); return 0; }
`,
  "c/c-functions": String.raw`#include <stdio.h>
long long gcd(long long a, long long b) { return b == 0 ? a : gcd(b, a % b); }
int main(void) { long long a, b; scanf("%lld %lld", &a, &b); long long g = gcd(a, b); printf("%lld %lld\n", g, a / g * b); return 0; }
`,
  "c/c-arrays": String.raw`#include <stdio.h>
int main(void) { int n, k, a[1000]; scanf("%d %d", &n, &k); for (int i = 0; i < n; i++) scanf("%d", &a[i]); k %= n; for (int i = 0; i < n; i++) printf(i ? " %d" : "%d", a[(i - k + n) % n]); printf("\n"); return 0; }
`,
  "c/c-strings": String.raw`#include <stdio.h>
#include <string.h>
int main(void) { int k; char s[512]; scanf("%d", &k); fgets(s, sizeof s, stdin); fgets(s, sizeof s, stdin); s[strcspn(s, "\n")] = 0; k %= 26;
  for (int i = 0; s[i]; i++) { char c = s[i]; if (c >= 'a' && c <= 'z') c = 'a' + (c - 'a' + k) % 26; else if (c >= 'A' && c <= 'Z') c = 'A' + (c - 'A' + k) % 26; putchar(c); } putchar('\n'); return 0; }
`,
  "c/c-pointers": String.raw`#include <stdio.h>
#include <stdlib.h>
int main(void) { int n; scanf("%d", &n); long *a = malloc(n * sizeof *a); for (int i = 0; i < n; i++) scanf("%ld", &a[i]);
  long *p = a, *q = a + n - 1; while (p < q) { long t = *p; *p++ = *q; *q-- = t; } for (int i = 0; i < n; i++) printf(i ? " %ld" : "%ld", a[i]); printf("\n"); free(a); return 0; }
`,
  "c/c-memory": String.raw`#include <stdio.h>
#include <stdlib.h>
static int cmp(const void *x, const void *y) { long a = *(const long *)x, b = *(const long *)y; return (a > b) - (a < b); }
int main(void) { int n; scanf("%d", &n); long *a = malloc(n * sizeof *a); for (int i = 0; i < n; i++) scanf("%ld", &a[i]); qsort(a, n, sizeof *a, cmp); for (int i = 0; i < n; i++) printf(i ? " %ld" : "%ld", a[i]); printf("\n"); free(a); return 0; }
`,
  "c/c-structs": String.raw`#include <stdio.h>
#include <string.h>
struct Student { char name[32]; int marks; };
int main(void) { int n; scanf("%d", &n); struct Student best = {"", -1}, s; for (int i = 0; i < n; i++) { scanf("%31s %d", s.name, &s.marks); if (s.marks > best.marks) best = s; } printf("%s %d\n", best.name, best.marks); return 0; }
`,
  "c/c-files": String.raw`#include <stdio.h>
int main(void) { int c, last = '\n', nl = 0, chars = 0, words = 0, inword = 0, any = 0; while ((c = getchar()) != EOF) { any = 1; last = c; if (c == '\n') nl++; else chars++; if (c == ' ' || c == '\n') inword = 0; else if (!inword) { inword = 1; words++; } }
  printf("%d %d %d\n", nl + (any && last != '\n'), words, chars); return 0; }
`,
  "c/c-advanced": String.raw`#include <stdio.h>
int main(void) { unsigned long long n; scanf("%llu", &n); int bits = 0; for (unsigned long long m = n; m; m &= m - 1) bits++; printf("%d %s\n", bits, n > 0 && (n & (n - 1)) == 0 ? "YES" : "NO"); return 0; }
`,
  "cpp/cpp-basics": String.raw`#include <iostream>
#include <string>
#include <algorithm>
int main() { std::string s; std::cin >> s; int sum = 0; for (char c : s) sum += c - '0'; std::reverse(s.begin(), s.end()); std::cout << s.size() << " " << sum << " " << std::stoll(s) << "\n"; }
`,
  "cpp/cpp-functions": String.raw`#include <iostream>
int main() { unsigned long long b, e, m, r = 1; std::cin >> b >> e >> m; r %= m; b %= m; while (e) { if (e & 1) r = r * b % m; b = b * b % m; e >>= 1; } std::cout << r << "\n"; }
`,
  "cpp/cpp-stl": String.raw`#include <iostream>
#include <set>
#include <vector>
#include <string>
#include <algorithm>
int main() { int n; std::cin >> n; std::set<std::string> u; for (int i = 0; i < n; i++) { std::string w; std::cin >> w; u.insert(w); }
  std::vector<std::string> v(u.begin(), u.end()); std::sort(v.begin(), v.end(), [](const std::string &a, const std::string &b) { return a.size() != b.size() ? a.size() < b.size() : a < b; });
  for (size_t i = 0; i < v.size(); i++) std::cout << (i ? " " : "") << v[i]; std::cout << "\n"; }
`,
  "cpp/cpp-memory": String.raw`#include <iostream>
#include <vector>
#include <string>
int main() { int c; std::cin >> c; std::vector<long long> s; while (c--) { std::string op; std::cin >> op;
    if (op == "push") { long long x; std::cin >> x; s.push_back(x); } else if (op == "pop") { if (!s.empty()) s.pop_back(); }
    else if (op == "top") { if (s.empty()) std::cout << "empty\n"; else std::cout << s.back() << "\n"; } else std::cout << s.size() << "\n"; } }
`,
  "cpp/cpp-oop": String.raw`#include <iostream>
#include <map>
#include <string>
class Inventory { std::map<std::string, long long> stock; public:
  void add(const std::string &i, long long q) { stock[i] += q; }
  bool remove(const std::string &i, long long q) { if (stock[i] < q) return false; stock[i] -= q; return true; }
  long long query(const std::string &i) { auto f = stock.find(i); return f == stock.end() ? 0 : f->second; } };
int main() { int c; std::cin >> c; Inventory inv; while (c--) { std::string op, item; long long q = 0; std::cin >> op >> item; if (op != "query") std::cin >> q;
    if (op == "add") inv.add(item, q); else if (op == "remove") { if (!inv.remove(item, q)) std::cout << "short\n"; } else std::cout << inv.query(item) << "\n"; } }
`,
  "cpp/cpp-practice": String.raw`#include <iostream>
#include <vector>
#include <algorithm>
int main() { int n; std::cin >> n; std::vector<long long> a(n); for (auto &x : a) std::cin >> x; std::vector<int> dp(n, 1);
  for (int i = 0; i < n; i++) for (int j = 0; j < i; j++) if (a[j] < a[i]) dp[i] = std::max(dp[i], dp[j] + 1); std::cout << *std::max_element(dp.begin(), dp.end()) << "\n"; }
`,
  "javascript/js-basics": String.raw`const [a, b] = require("fs").readFileSync(0, "utf8").trim().split(/\s+/).map(Number);
let c = 0;
for (let y = a; y <= b; y++) if (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) c++;
console.log(c);
`,
  "javascript/js-functions": String.raw`const s = require("fs").readFileSync(0, "utf8").split("\n")[0];
const match = { ")": "(", "]": "[", "}": "{" };
const stack = [];
let ok = true;
for (const ch of s) {
  if ("([{".includes(ch)) stack.push(ch);
  else if (stack.pop() !== match[ch]) { ok = false; break; }
}
console.log(ok && stack.length === 0 ? "YES" : "NO");
`,
  "javascript/js-data": String.raw`const lines = require("fs").readFileSync(0, "utf8").split("\n");
const totals = new Map();
for (let i = 1; i <= Number(lines[0]); i++) {
  const [name, q, p] = lines[i].split(" ");
  totals.set(name, (totals.get(name) || 0) + Number(q) * Number(p));
}
for (const k of [...totals.keys()].sort()) console.log(k + " " + totals.get(k));
`,
  "javascript/js-modern": String.raw`const lines = require("fs").readFileSync(0, "utf8").split("\n");
function valid(line) {
  const parts = line.split(",");
  if (parts.length !== 3) return false;
  const [name, age, email] = parts;
  if (name.trim() === "") return false;
  if (!/^\d+$/.test(age) || Number(age) > 120) return false;
  const at = email.split("@");
  return at.length === 2 && at[0].length > 0 && at[1].includes(".");
}
let ok = 0, first = 0;
for (let i = 1; i <= Number(lines[0]); i++) {
  if (valid(lines[i])) ok++;
  else if (!first) first = i;
}
console.log(ok + " " + first);
`,
  "java/java-basics": String.raw`import java.util.*;
public class Main { public static void main(String[] args) { Scanner s = new Scanner(System.in); long a = s.nextLong(), p = s.nextLong(); int y = s.nextInt(); for (int i = 0; i < y; i++) a += a * p / 100; System.out.println(a); } }
`,
  "java/java-control": String.raw`import java.util.*;
public class Main { public static void main(String[] args) { int n = new Scanner(System.in).nextInt(); boolean[] composite = new boolean[n + 1]; int count = 0;
    for (int i = 2; i <= n; i++) { if (!composite[i]) { count++; for (long j = (long) i * i; j <= n; j += i) composite[(int) j] = true; } } System.out.println(count); } }
`,
  "java/java-methods": String.raw`import java.util.*;
public class Main { static long fib(int n) { long a = 0, b = 1; for (int i = 0; i < n; i++) { long t = a + b; a = b; b = t; } return a; }
  public static void main(String[] args) { System.out.println(fib(new Scanner(System.in).nextInt())); } }
`,
  "java/java-arrays": String.raw`import java.util.*;
public class Main { static String key(String w) { char[] c = w.toLowerCase().toCharArray(); Arrays.sort(c); return new String(c); }
  public static void main(String[] args) { Scanner s = new Scanner(System.in); String a = s.next(), b = s.next(); System.out.println(key(a).equals(key(b)) ? "YES" : "NO"); } }
`,
  "java/java-oop": String.raw`import java.util.*;
public class Main {
  static abstract class Shape { abstract long fence(); }
  static class Rect extends Shape { long w, h; Rect(long w, long h) { this.w = w; this.h = h; } long fence() { return 2 * (w + h); } }
  static class Square extends Shape { long s; Square(long s) { this.s = s; } long fence() { return 4 * s; } }
  static class Tri extends Shape { long a, b, c; Tri(long a, long b, long c) { this.a = a; this.b = b; this.c = c; } long fence() { return a + b + c; } }
  public static void main(String[] args) { Scanner in = new Scanner(System.in); int n = in.nextInt(); long total = 0;
    for (int i = 0; i < n; i++) { String k = in.next(); Shape sh = k.equals("rect") ? new Rect(in.nextLong(), in.nextLong()) : k.equals("square") ? new Square(in.nextLong()) : new Tri(in.nextLong(), in.nextLong(), in.nextLong()); total += sh.fence(); }
    System.out.println(total); } }
`,
  "java/java-exceptions": String.raw`import java.util.*;
public class Main {
  static String calc(String a, String op, String b) {
    long x, y;
    try { x = Long.parseLong(a); y = Long.parseLong(b); } catch (NumberFormatException e) { return "error"; }
    switch (op) {
      case "+": return String.valueOf(x + y);
      case "-": return String.valueOf(x - y);
      case "*": return String.valueOf(x * y);
      case "/": return (y == 0 || x % y != 0) ? "error" : String.valueOf(x / y);
      default: return "error";
    } }
  public static void main(String[] args) { Scanner in = new Scanner(System.in); int n = in.nextInt(); for (int i = 0; i < n; i++) System.out.println(calc(in.next(), in.next(), in.next())); } }
`,
  "java/java-collections": String.raw`import java.util.*;
public class Main { public static void main(String[] args) { Scanner in = new Scanner(System.in); int n = in.nextInt(), k = in.nextInt(); Map<Integer, Integer> c = new HashMap<>();
    for (int i = 0; i < n; i++) c.merge(in.nextInt(), 1, Integer::sum);
    List<Map.Entry<Integer, Integer>> e = new ArrayList<>(c.entrySet());
    e.sort((p, q) -> !q.getValue().equals(p.getValue()) ? q.getValue() - p.getValue() : p.getKey() - q.getKey());
    StringBuilder sb = new StringBuilder(); for (int i = 0; i < Math.min(k, e.size()); i++) { if (i > 0) sb.append(' '); sb.append(e.get(i).getKey()); } System.out.println(sb); } }
`,
  "java/java-modern": String.raw`import java.util.*;
public class Main { public static void main(String[] args) { Scanner in = new Scanner(System.in); int n = in.nextInt(); TreeMap<String, Long> t = new TreeMap<>();
    for (int i = 0; i < n; i++) { in.next(); String d = in.next(); long s = in.nextLong(); t.merge(d, s, Long::sum); }
    String best = null; long top = -1; for (Map.Entry<String, Long> e : t.entrySet()) if (e.getValue() > top) { top = e.getValue(); best = e.getKey(); }
    System.out.println(best + " " + top); } }
`,
  "java/java-tools": String.raw`import java.io.*;
import java.util.*;
public class Main { public static void main(String[] args) throws IOException { BufferedReader r = new BufferedReader(new InputStreamReader(System.in)); Map<String, Integer> c = new LinkedHashMap<>(); c.put("INFO", 0); c.put("WARN", 0); c.put("ERROR", 0);
    String line; while ((line = r.readLine()) != null) { String t = line.trim(); if (t.isEmpty()) continue; String w = t.split("\\s+")[0]; if (c.containsKey(w)) c.put(w, c.get(w) + 1); }
    for (Map.Entry<String, Integer> e : c.entrySet()) System.out.println(e.getKey() + " " + e.getValue()); } }
`,
  "csharp/cs-basics": String.raw`using System;
class Program { static void Main() { int n = int.Parse(Console.ReadLine()); string[] t = Console.ReadLine().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries); int[] c = new int[5];
    for (int i = 0; i < n; i++) { int s = int.Parse(t[i]); c[s >= 90 ? 0 : s >= 80 ? 1 : s >= 70 ? 2 : s >= 60 ? 3 : 4]++; }
    string[] g = { "A", "B", "C", "D", "F" }; for (int i = 0; i < 5; i++) Console.WriteLine(g[i] + " " + c[i]); } }
`,
  "csharp/cs-data": String.raw`using System;
using System.Linq;
class Program { static void Main() { var words = Console.ReadLine().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries).Distinct();
    foreach (var g in words.GroupBy(w => w.Length).OrderBy(g => g.Key)) Console.WriteLine(g.Key + ": " + string.Join(" ", g.OrderBy(w => w, StringComparer.Ordinal))); } }
`,
  "csharp/cs-oop": String.raw`using System;
abstract class Employee { public string Name; protected Employee(string name) { Name = name; } public abstract long Pay(); }
class Hourly : Employee { long rate, hours; public Hourly(string n, long r, long h) : base(n) { rate = r; hours = h; } public override long Pay() { return rate * Math.Min(hours, 40) + 2 * rate * Math.Max(hours - 40, 0); } }
class Salaried : Employee { long monthly; public Salaried(string n, long m) : base(n) { monthly = m; } public override long Pay() { return monthly; } }
class Manager : Salaried { long bonus; public Manager(string n, long m, long b) : base(n, m) { bonus = b; } public override long Pay() { return base.Pay() + bonus; } }
class Program { static void Main() { int n = int.Parse(Console.ReadLine()); long total = 0;
    for (int i = 0; i < n; i++) { string[] p = Console.ReadLine().Split(' '); Employee e = p[0] == "hourly" ? new Hourly(p[1], long.Parse(p[2]), long.Parse(p[3])) : p[0] == "salaried" ? new Salaried(p[1], long.Parse(p[2])) : (Employee)new Manager(p[1], long.Parse(p[2]), long.Parse(p[3]));
      Console.WriteLine(e.Name + " " + e.Pay()); total += e.Pay(); }
    Console.WriteLine("TOTAL " + total); } }
`,
  "csharp/cs-modern": String.raw`using System;
using System.Linq;
class Program { static void Main() { int n = int.Parse(Console.ReadLine()); var orders = new System.Collections.Generic.List<string[]>();
    for (int i = 0; i < n; i++) orders.Add(Console.ReadLine().Split(' '));
    var top = orders.Where(o => o[3] == "paid").GroupBy(o => o[1]).Select(g => new { Name = g.Key, Total = g.Sum(o => long.Parse(o[2])) }).OrderByDescending(x => x.Total).ThenBy(x => x.Name, StringComparer.Ordinal).Take(3);
    foreach (var x in top) Console.WriteLine(x.Name + " " + x.Total); } }
`,
};
