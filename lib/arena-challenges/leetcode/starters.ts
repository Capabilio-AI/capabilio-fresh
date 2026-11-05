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

const HINT = "Read the input as described, print the answer exactly as the output format says.";

const GENERIC: Record<Exclude<JudgeLanguage, "python" | "c">, string> = {
  go: `package main\n\nimport (\n\t"bufio"\n\t"fmt"\n\t"os"\n)\n\nfunc main() {\n\tin := bufio.NewReader(os.Stdin)\n\t// ${HINT}\n\tvar a int\n\tfmt.Fscan(in, &a)\n\t_ = a\n}\n`,
  rust: `use std::io::{self, Read};\n\nfn main() {\n    let mut input = String::new();\n    io::stdin().read_to_string(&mut input).unwrap();\n    // ${HINT}\n}\n`,
  csharp: `using System;\n\nclass Program {\n    static void Main() {\n        string input = Console.In.ReadToEnd();\n        // ${HINT}\n    }\n}\n`,
  kotlin: `fun main() {\n    val lines = generateSequence(::readLine).toList()\n    // ${HINT}\n}\n`,
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    // ${HINT}\n    // TODO: read from cin, write to cout\n    return 0;\n}\n`,
  java: `import java.util.*;\nimport java.io.*;\n\nclass Main {\n    public static void main(String[] args) throws IOException {\n        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));\n        // ${HINT}\n        // TODO: read lines with in.readLine(), print with System.out\n    }\n}\n`,
  javascript: `const lines = require("fs").readFileSync(0, "utf8").split("\\n");\n// ${HINT}\n// TODO: parse \`lines\`, then console.log(answer)\n`,
  typescript: `declare const require: any;\nconst lines: string[] = require("fs").readFileSync(0, "utf8").split("\\n");\n// ${HINT}\n// TODO: parse \`lines\`, then console.log(answer)\n`,
  ruby: `lines = STDIN.read.split("\\n")\n# ${HINT}\n# TODO: parse lines, then puts answer\n`,
  php: `<?php\n$lines = explode("\\n", stream_get_contents(STDIN));\n// ${HINT}\n// TODO: parse $lines, then echo the answer\n`,
};

/** The starter for a language: the problem's own Python and C skeletons, a generic stdin skeleton for the rest. */
export function starterFor(problem: PublicProblem, lang: JudgeLanguage): string {
  if (problem.debug && problem.debugStarter && (problem.debugLang ?? "python") === lang) return problem.debugStarter;
  if (lang === "python") return problem.starters.python;
  if (lang === "c") return problem.starters.c;
  return GENERIC[lang];
}
