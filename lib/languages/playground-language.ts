import { playgroundLanguage, type PlaygroundLanguage } from "@/lib/playground/playground";

/** Tracks whose every example is in the track's own language. The web tracks are read from the code (a page, a script), and C# has no in-page runner. */
const OWN: Record<string, PlaygroundLanguage | undefined> = { c: "c", java: "java", python: "python", cpp: "cpp", sql: "sql" };

/** Pure. How a lesson example is shown and run, or null when it can only be shown as code. */
export const exampleLanguage = (trackKey: string, code: string): PlaygroundLanguage | null => OWN[trackKey] ?? (trackKey === "csharp" ? null : playgroundLanguage("", code));
