import type { PublicProblem } from "./problem";

/** Languages the Arena judge accepts, in the order the editor lists them. Each runs on the same stdin/stdout tests. */
export const JUDGE_LANGUAGES = [
  { id: "python", label: "Python 3" },
  { id: "cpp", label: "C++" },
  { id: "c", label: "C" },
  { id: "java", label: "Java" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "ruby", label: "Ruby" },
  { id: "php", label: "PHP" },
  // only offered when the platform runs its own judge (JUDGE0_URL set and NEXT_PUBLIC_EXTRA_LANGUAGES=1): the shared public runner is too slow for them
  ...(process.env.NEXT_PUBLIC_EXTRA_LANGUAGES === "1" ? ([{ id: "go", label: "Go" }, { id: "rust", label: "Rust" }, { id: "csharp", label: "C#" }, { id: "kotlin", label: "Kotlin" }] as const) : []),
] as const;
export type JudgeLanguage = (typeof JUDGE_LANGUAGES)[number]["id"];

/** Comment lines that tell the student what the program reads and prints, taken from the problem itself. */
const header = (p: PublicProblem, mark: string) => [`${mark} Input: ${p.inputFormat.replace(/\s+/g, " ")}`, `${mark} Output: ${p.outputFormat.replace(/\s+/g, " ")}`].join("\n");

const GENERIC: Record<Exclude<JudgeLanguage, "python" | "c">, (p: PublicProblem) => string> = {
  go: (p) => `package main\n\nimport (\n\t"bufio"\n\t"fmt"\n\t"os"\n)\n\nfunc main() {\n\tin := bufio.NewReader(os.Stdin)\n${header(p, "\t//")}\n\tvar a int\n\tfmt.Fscan(in, &a)\n\t_ = a\n}\n`,
  rust: (p) => `use std::io::{self, Read};\n\nfn main() {\n    let mut input = String::new();\n    io::stdin().read_to_string(&mut input).unwrap();\n    let mut it = input.split_whitespace();\n${header(p, "    //")}\n    let _first = it.next();\n}\n`,
  csharp: (p) => `using System;\nusing System.Linq;\n\nclass Program {\n    static void Main() {\n        string[] tokens = Console.In.ReadToEnd().Split((char[])null, StringSplitOptions.RemoveEmptyEntries);\n${header(p, "        //")}\n    }\n}\n`,
  kotlin: (p) => `fun main() {\n    val tokens = System.\`in\`.bufferedReader().readText().split(Regex("\\\\s+")).filter { it.isNotEmpty() }\n${header(p, "    //")}\n}\n`,
  cpp: (p) => `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n${header(p, "    //")}\n    // read with cin >> x, print with cout << answer << "\\n"\n    return 0;\n}\n`,
  java: (p) => `import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        Scanner in = new Scanner(System.in);\n${header(p, "        //")}\n        // read with in.nextInt() / in.next() / in.nextLine(), print with System.out.println(answer)\n    }\n}\n`,
  javascript: (p) => `const tokens = require("fs").readFileSync(0, "utf8").split(/\\s+/).filter(Boolean);\n${header(p, "//")}\n// tokens holds every whitespace-separated value of the input, in order. Print with console.log(answer)\n`,
  typescript: (p) => `declare const require: any;\nconst tokens: string[] = require("fs").readFileSync(0, "utf8").split(/\\s+/).filter(Boolean);\n${header(p, "//")}\n// tokens holds every whitespace-separated value of the input, in order. Print with console.log(answer)\n`,
  ruby: (p) => `tokens = STDIN.read.split\n${header(p, "#")}\n# tokens holds every whitespace-separated value of the input. Print with puts answer\n`,
  php: (p) => `<?php\n$tokens = preg_split('/\\s+/', trim(stream_get_contents(STDIN)));\n${header(p, "//")}\n// $tokens holds every whitespace-separated value of the input. Print with echo $answer\n`,
};

/** The starter for a language: the problem's own Python and C skeletons, a generic stdin skeleton for the rest. */
export function starterFor(problem: PublicProblem, lang: JudgeLanguage): string {
  if (problem.debug && problem.debugStarter && (problem.debugLang ?? "python") === lang) return problem.debugStarter;
  if (lang === "python") return problem.starters.python;
  if (lang === "c") return problem.starters.c;
  return GENERIC[lang](problem);
}
