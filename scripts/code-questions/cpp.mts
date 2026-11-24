// Source snippets for the C++ code-reading questions. The generator runs them; the answers are NOT written here. Only the modules added with scripts/author-lang.mts have a bank.
import type { Language, Spec } from "../gen-code-questions.mts";
import { extra } from "./cpp-extra";

export const lang: Language = {
  language: "cpp",
  show: (s) => (s.top ? `${s.top.trim()}\n\n` : "") + "int main() {\n" + s.body.trim().split("\n").map((l) => `    ${l}`).join("\n") + "\n}",
  wrap: (shown) => `#include <bits/stdc++.h>\nusing namespace std;\n\n${shown}\n`,
};

export const specs: Spec[] = [...extra];
