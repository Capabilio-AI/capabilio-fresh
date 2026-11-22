// Smoke test of the code runner the platform really uses (self-hosted Judge0 when JUDGE0_URL is set, otherwise the shared Wandbox runner).
// Runs one tiny stdin program per language, so you see which languages work, how fast, and where the platform is NOT production-ready.
// Usage: npm run judge:health        Writes nothing. Exit code 1 if any language fails, so it can gate a deploy.
import { runCode, COMPILER_BY_LANGUAGE } from "@/lib/code-execution/wandbox";
import { judge0Configured, JUDGE0_IDS } from "@/lib/code-execution/judge0";

/** Each program reads "3 4" and must print 7. */
const PROGRAMS: Record<string, string> = {
  python: "a, b = map(int, input().split())\nprint(a + b)\n",
  c: '#include <stdio.h>\nint main(void){int a,b;scanf("%d %d",&a,&b);printf("%d\\n",a+b);return 0;}\n',
  cpp: "#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b<<\"\\n\";}\n",
  java: "import java.util.*;\npublic class Main{public static void main(String[] x){Scanner s=new Scanner(System.in);System.out.println(s.nextInt()+s.nextInt());}}\n",
  javascript: 'const [a,b]=require("fs").readFileSync(0,"utf8").trim().split(/\\s+/).map(Number);console.log(a+b);\n',
  typescript: 'declare const require: any;\nconst [a,b]:number[]=require("fs").readFileSync(0,"utf8").trim().split(/\\s+/).map(Number);console.log(a+b);\n',
  ruby: "a, b = gets.split.map(&:to_i)\nputs a + b\n",
  php: "<?php\n[$a, $b] = array_map('intval', explode(' ', trim(fgets(STDIN))));\necho $a + $b, \"\\n\";\n",
  csharp: "using System;\nclass P{static void Main(){var t=Console.ReadLine().Split(' ');Console.WriteLine(int.Parse(t[0])+int.Parse(t[1]));}}\n",
  go: 'package main\nimport "fmt"\nfunc main(){var a,b int;fmt.Scan(&a,&b);fmt.Println(a+b)}\n',
  rust: "use std::io::*;\nfn main(){let mut s=String::new();stdin().read_to_string(&mut s).unwrap();let v:Vec<i32>=s.split_whitespace().map(|x|x.parse().unwrap()).collect();println!(\"{}\",v[0]+v[1]);}\n",
  kotlin: "fun main(){val (a,b)=readLine()!!.split(\" \").map{it.toInt()};println(a+b)}\n",
};

// The shared runner drops old compiler versions without notice; a pinned name that no longer exists fails every run in that language.
let pinsGone: string[] = [];
try {
  const list = (await (await fetch("https://wandbox.org/api/list.json", { signal: AbortSignal.timeout(20_000) })).json()) as { name: string }[];
  const have = new Set(list.map((c) => c.name));
  pinsGone = Object.entries(COMPILER_BY_LANGUAGE).filter(([, c]) => !have.has(c)).map(([l, c]) => `${l} (${c})`);
  console.log(pinsGone.length ? `PINNED COMPILERS MISSING on Wandbox: ${pinsGone.join(", ")}` : "All pinned Wandbox compilers exist.");
} catch (e) {
  console.log(`Could not read the Wandbox compiler list: ${(e as Error).message}`);
}

const own = judge0Configured();
console.log(own ? `Runner: self-hosted Judge0 (${process.env.JUDGE0_URL})` : "Runner: shared public Wandbox (NOT production-grade: no SLA, rate-limited, slow for Java and C++; C#, Go, Rust and Kotlin are unavailable)");
const languages = Object.keys(PROGRAMS).filter((l) => own || ["python", "c", "cpp", "java", "javascript", "typescript", "ruby", "php"].includes(l));
const rows: { language: string; result: string; ms: number; detail: string }[] = [];
for (const language of languages) {
  const t0 = Date.now();
  try {
    const r = await runCode(language, PROGRAMS[language], "3 4\n");
    const ok = r.stdout.trim() === "7" && !r.compileError;
    rows.push({ language, result: ok ? "ok" : "FAIL", ms: Date.now() - t0, detail: ok ? "" : (r.compileError || r.stderr || `got "${r.stdout.trim()}"`).slice(0, 80) });
  } catch (e) {
    rows.push({ language, result: "FAIL", ms: Date.now() - t0, detail: (e as Error).message.slice(0, 80) });
  }
}
console.table(rows);
const missing = Object.keys(JUDGE0_IDS).filter((l) => !languages.includes(l) && l in PROGRAMS);
if (missing.length) console.log(`Not tested here (needs Judge0): ${missing.join(", ")}`);
const slow = rows.filter((r) => r.result === "ok" && r.ms > 8000).map((r) => r.language);
if (slow.length) console.log(`Slow (> 8 s for a hello-world sum): ${slow.join(", ")}. A student would wait this long on every Run.`);
const failed = rows.filter((r) => r.result !== "ok");
if (pinsGone.length) failed.push({ language: "pins", result: "FAIL", ms: 0, detail: pinsGone.join(", ") });
console.log(failed.length ? `\n${failed.length} of ${rows.length} languages FAILED: ${failed.map((r) => r.language).join(", ")}` : `\nAll ${rows.length} tested languages passed.`);
process.exit(failed.length ? 1 : 0);
