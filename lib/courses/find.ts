import type { Track } from "@/lib/languages/types";

/**
 * "What do you want to learn?" A student types a word or two (or taps an example) and gets real things to start: a language course that fits, and the roles
 * that use the topic. It reads our own catalogue only; no AI, so it is fast, free and gives the same answer every time.
 */

type TrackKey = Track["key"];

/** Words that carry no meaning for a search ("I want to learn the basics of ..."). */
const STOP = new Set(["i", "want", "wants", "to", "learn", "learning", "how", "the", "a", "an", "in", "and", "of", "for", "about", "course", "courses", "tutorial", "tutorials", "basic", "basics", "start", "what", "is", "me", "my", "on", "with", "using", "use", "can", "please", "need", "study"]);

/** Everyday words students use, mapped to the language course that teaches it, with one plain sentence for why. */
export const TOPIC_HINTS: Record<string, { tracks: TrackKey[]; why: string }> = {
  embedded: { tracks: ["c"], why: "Embedded devices are programmed in C." },
  microcontroller: { tracks: ["c"], why: "Microcontrollers are programmed in C." },
  firmware: { tracks: ["c"], why: "Firmware is written in C." },
  arduino: { tracks: ["c", "cpp"], why: "Arduino programs are written in C and C++." },
  iot: { tracks: ["c", "python"], why: "IoT devices use C, and the data side uses Python." },
  robotics: { tracks: ["c", "python"], why: "Robots are programmed in C and Python." },
  web: { tracks: ["html", "javascript"], why: "Websites are built with HTML, CSS and JavaScript." },
  website: { tracks: ["html", "javascript"], why: "Websites are built with HTML, CSS and JavaScript." },
  frontend: { tracks: ["html", "javascript"], why: "The part of a website you see is HTML, CSS and JavaScript." },
  app: { tracks: ["java", "javascript"], why: "Many apps are written in Java or JavaScript." },
  android: { tracks: ["java"], why: "Android apps are written in Java and Kotlin." },
  backend: { tracks: ["java", "python", "sql"], why: "Servers are written in Java or Python and keep their data in SQL." },
  data: { tracks: ["python", "sql"], why: "Data work uses Python and SQL." },
  analytics: { tracks: ["python", "sql"], why: "Data work uses Python and SQL." },
  database: { tracks: ["sql"], why: "Databases are asked questions with SQL." },
  ai: { tracks: ["python"], why: "AI and machine learning are done in Python." },
  ml: { tracks: ["python"], why: "AI and machine learning are done in Python." },
  game: { tracks: ["csharp", "cpp"], why: "Games are made with C# (Unity) and C++." },
  unity: { tracks: ["csharp"], why: "Unity games are written in C#." },
  placement: { tracks: ["c", "java", "python"], why: "Placement tests ask you to solve problems in C, Java or Python." },
  interview: { tracks: ["c", "java", "python"], why: "Interviews ask you to solve problems in C, Java or Python." },
  coding: { tracks: ["python", "c"], why: "Python and C are the two best languages to start coding with." },
  programming: { tracks: ["python", "c"], why: "Python and C are the two best languages to start with." },
  oops: { tracks: ["java", "cpp", "python"], why: "Java, C++ and Python all teach classes and objects." },
  cyber: { tracks: ["python", "c"], why: "Security work needs Python for scripts and C to understand memory." },
};

/** Roadmap topics we already have a course for. A topic that matches opens that course; any other topic says it is coming. */
const TOPIC_TRACKS: [RegExp, TrackKey][] = [
  [/\bc programming\b|\bembedded c\b|\bprogramming fundamentals\b/i, "c"],
  [/(?<![a-z0-9])c\+\+/i, "cpp"],
  [/(?<![a-z0-9])c#|\.net\b/i, "csharp"],
  [/\bpython\b/i, "python"],
  [/\bjava\b(?!script)/i, "java"],
  [/\bjavascript\b/i, "javascript"],
  [/\bsql\b|\bdatabase/i, "sql"],
  [/\bhtml\b|\bcss\b/i, "html"],
];

/** Pure. The language course that teaches a roadmap topic, or null when we do not have one yet. */
export const topicTrack = (title: string): TrackKey | null => TOPIC_TRACKS.find(([re]) => re.test(title))?.[1] ?? null;

/** Pure. The words that matter in what the student typed: lower case, no filler, c++ and c# kept whole, at most 8. */
export function searchWords(query: string): string[] {
  const words = query.toLowerCase().replace(/[^a-z0-9+#\s]/g, " ").split(/\s+/).filter((w) => w.length > 0 && !STOP.has(w));
  return [...new Set(words)].slice(0, 8);
}

/** Pure. Whether `word` appears as a whole word in `text` (so the word "c" does not match every word that contains a c). */
export function hasWord(text: string, word: string): boolean {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9+#])${esc}(?![a-z0-9+#])`, "i").test(text);
}

/** Pure. The recommended language courses for the words, in order, each with the reason. Several words may agree; the first reason is kept. */
export function recommendedTracks(words: readonly string[]): { track: TrackKey; why: string }[] {
  const out = new Map<TrackKey, string>();
  for (const w of words) {
    const hint = TOPIC_HINTS[w];
    if (hint) for (const t of hint.tracks) if (!out.has(t)) out.set(t, hint.why);
  }
  return [...out].map(([track, why]) => ({ track, why }));
}

export interface LanguageHit { kind: "course" | "module" | "lesson"; track: TrackKey; trackTitle: string; title: string; trail: string; href: string; score: number }

/** Pure. Language courses, modules and lessons that match the words. A word in a title counts more than a word in a summary; a whole-word match is needed. */
export function searchLanguages(words: readonly string[], tracks: readonly Track[], limit = 8): LanguageHit[] {
  if (words.length === 0) return [];
  const score = (title: string, summary: string) => words.reduce((n, w) => n + (hasWord(title, w) ? 3 : 0) + (hasWord(summary, w) ? 1 : 0), 0);
  const hits: LanguageHit[] = [];
  for (const t of tracks) {
    const ts = score(t.title, t.tagline);
    if (ts > 0) hits.push({ kind: "course", track: t.key, trackTitle: t.title, title: t.title, trail: t.tagline, href: `/skillstudio/courses/${t.key}`, score: ts + 5 });
    for (const m of t.modules) {
      const ms = score(m.title, m.summary);
      if (ms > 0) hits.push({ kind: "module", track: t.key, trackTitle: t.title, title: m.title, trail: `${t.title}, module`, href: `/skillstudio/courses/${t.key}/${m.lessons[0].key}`, score: ms + 1 });
      for (const l of m.lessons) {
        const ls = score(l.title, l.lesson.summary);
        if (ls > 0) hits.push({ kind: "lesson", track: t.key, trackTitle: t.title, title: l.title, trail: `${t.title}, ${m.title}`, href: `/skillstudio/courses/${t.key}/${l.key}`, score: ls });
      }
    }
  }
  return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}

export interface RoleTopic { title: string; stage: string }
export interface RoleRow { key: string; name: string; category: string; description: string | null; topics: RoleTopic[] }
export interface RoleHit { key: string; name: string; category: string; matched: string[]; topicCount: number; score: number }

/** Pure. Roles whose name, description or roadmap topics match the words. The role name counts most; each matching topic adds a little. */
export function searchRoles(words: readonly string[], roles: readonly RoleRow[], limit = 6): RoleHit[] {
  if (words.length === 0) return [];
  const out: RoleHit[] = [];
  for (const r of roles) {
    const matched = r.topics.filter((t) => words.some((w) => hasWord(t.title, w))).map((t) => t.title);
    const nameHits = words.filter((w) => hasWord(r.name, w)).length;
    const descHits = words.filter((w) => r.description && hasWord(r.description, w)).length;
    const score = nameHits * 6 + descHits * 2 + matched.length;
    if (score > 0) out.push({ key: r.key, name: r.name, category: r.category, matched: matched.slice(0, 5), topicCount: r.topics.length, score });
  }
  return out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit);
}

/** The four plain stages of a role roadmap, in the order a student goes through them, with words a first-generation student can follow. */
export const STAGES: { key: string; title: string; blurb: string }[] = [
  { key: "FOUNDATION", title: "Start here", blurb: "The basics everything else is built on." },
  { key: "CORE", title: "Main skills", blurb: "The skills you will use every day in this job." },
  { key: "SPECIALIZATION", title: "Go deeper", blurb: "Special topics that make you stand out." },
  { key: "JOB_READY", title: "Get job ready", blurb: "Working with a team, testing and showing your work." },
];
