// Source snippets for the Java code-reading questions. The generator runs them; the answers are NOT written here. Only the modules added with scripts/author-lang.mts have a bank.
import type { Language, Spec } from "../gen-code-questions.mts";
import { extra } from "./java-extra";

export const lang: Language = {
  language: "java",
  show: (s) => (s.top ? `${s.top.trim()}\n\n` : "") + "public class Main {\n    public static void main(String[] args) {\n" + s.body.trim().split("\n").map((l) => `        ${l}`).join("\n") + "\n    }\n}",
  wrap: (shown) => `import java.util.*;\nimport java.util.function.*;\nimport java.util.stream.*;\n\n${shown}\n`,
};

export const specs: Spec[] = [...extra];
