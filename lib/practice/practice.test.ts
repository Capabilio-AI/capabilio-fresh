import { describe, expect, it } from "vitest";
import { EXERCISE_LANGUAGES, GeneratedExercises, exercisePrompt, isExerciseLanguage, normalizeOutput, outputsMatch, practiceLanguages, publicExercise, restoreLineBreaks, runnableLanguage, topicKeyFor, type StoredExercise } from "./practice";

describe("runnableLanguage", () => {
  it("reads the language from the topic name", () => {
    expect(runnableLanguage("Python Lists and Tuples")).toBe("python");
    expect(runnableLanguage("Java Inheritance")).toBe("java");
    expect(runnableLanguage("C++ Pointers")).toBe("cpp");
    expect(runnableLanguage("C Programming Basics")).toBe("c");
    expect(runnableLanguage("JavaScript Closures")).toBe("javascript");
    expect(runnableLanguage("TypeScript Generics")).toBe("typescript");
  });
  it("does not mistake JavaScript for Java, or a word with a 'c' for C", () => {
    expect(runnableLanguage("JavaScript Arrays")).toBe("javascript");
    expect(runnableLanguage("Cloud Computing Concepts")).toBeNull();
    expect(runnableLanguage("Concurrency")).toBeNull();
  });
  it("falls back to the shape of the code", () => {
    expect(runnableLanguage("Loops", '#include <stdio.h>\nint main(){ return 0; }')).toBe("c");
    expect(runnableLanguage("Loops", "#include <iostream>\nint main(){}")).toBe("cpp");
    expect(runnableLanguage("Loops", "def f(x):\n    return x")).toBe("python");
    expect(runnableLanguage("Loops", "public static void main(String[] a){}")).toBe("java");
    expect(runnableLanguage("Loops", "console.log(1)")).toBe("javascript");
  });
  it("says nothing for skills that are not code, or for SQL (the runner has no SQL)", () => {
    expect(runnableLanguage("Structural Analysis")).toBeNull();
    expect(runnableLanguage("SQL Joins", "SELECT * FROM a JOIN b")).toBeNull();
  });
});

describe("output comparison", () => {
  it("ignores trailing spaces and blank lines, and Windows line ends, but nothing else", () => {
    expect(normalizeOutput("a  \r\nb\n\n")).toBe("a\nb");
    expect(outputsMatch("3\n", "3")).toBe(true);
    expect(outputsMatch("1 2\n", "1  2")).toBe(false);
    expect(outputsMatch("Hello", "hello")).toBe(false);
  });
});

const tests = [
  { input: "2\n", expected: "4", hidden: false },
  { input: "3\n", expected: "9", hidden: false },
  { input: "10\n", expected: "100", hidden: true },
];
const stored: StoredExercise = { id: "e1", title: "Square", instructions: "Read n, print n squared.", language: "python", starterCode: "n = int(input())\n", solution: "n=int(input())\nprint(n*n)", tests };

describe("publicExercise", () => {
  it("never carries the solution or the hidden tests' answers", () => {
    const p = publicExercise(stored);
    expect(JSON.stringify(p)).not.toContain("n*n");
    expect(JSON.stringify(p)).not.toContain("100");
    expect(p.visibleTests).toEqual([{ input: "2\n", expected: "4" }, { input: "3\n", expected: "9" }]);
    expect(p.hiddenTests).toBe(1);
  });
});

describe("GeneratedExercises", () => {
  const ok = { exercises: [{ title: "Square", instructions: "Read an integer and print its square.", starterCode: "n = int(input())\n", solution: "n=int(input())\nprint(n*n)", tests }] };
  it("accepts a complete set", () => expect(GeneratedExercises.safeParse(ok).success).toBe(true));
  it("needs at least two tests, one of them visible", () => {
    expect(GeneratedExercises.safeParse({ exercises: [{ ...ok.exercises[0], tests: [tests[0]] }] }).success).toBe(false);
    expect(GeneratedExercises.safeParse({ exercises: [{ ...ok.exercises[0], tests: tests.map((t) => ({ ...t, hidden: true })) }] }).success).toBe(false);
  });
});

describe("exercisePrompt and keys", () => {
  it("asks for stdin/stdout programs in the right language about the right topic", () => {
    const p = exercisePrompt({ title: "Python Lists", summary: "Ordered collections.", language: "python" });
    expect(p).toContain("Python Lists");
    expect(p).toMatch(/standard input/i);
    expect(p).toMatch(/python/i);
  });
  it("keys roadmap topics and language-track lessons apart", () => {
    expect(topicKeyFor({ kind: "topic", nodeKey: "sql-joins" })).toBe("topic:sql-joins");
    expect(topicKeyFor({ kind: "track", track: "python", lessonKey: "lists" })).toBe("track:python:lists");
  });
  it("only offers exercises in languages that read standard input the same way", () => {
    expect([...EXERCISE_LANGUAGES].sort()).toEqual(["c", "cpp", "java", "python"]);
  });
});

describe("where exercises are offered", () => {
  it("is Python and C on the free shared runner, and all four with a dedicated one", () => {
    expect([...practiceLanguages(false)]).toEqual(["python", "c"]);
    expect([...practiceLanguages(true)].sort()).toEqual(["c", "cpp", "java", "python"]);
    expect(isExerciseLanguage("java")).toBe(false);
    expect(isExerciseLanguage("java", true)).toBe(true);
    expect(isExerciseLanguage("python")).toBe(true);
    expect(isExerciseLanguage(null)).toBe(false);
  });
});

describe("restoreLineBreaks", () => {
  it("turns a flattened program back into lines", () => {
    expect(restoreLineBreaks("import java.util.*;\\npublic class Main{\\n}")).toBe("import java.util.*;\npublic class Main{\n}");
  });
  it("leaves a normal program alone, including one whose strings contain \\n", () => {
    const real = 'print("a\\nb")\nprint(1)';
    expect(restoreLineBreaks(real)).toBe(real);
    expect(restoreLineBreaks("x = 1")).toBe("x = 1");
  });
});
