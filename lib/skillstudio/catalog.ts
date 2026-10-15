// What SkillStudio shows and recommends, derived from the student's own modules. Pure: no database, no clock.
import type { Stage } from "@/lib/roadmap-visual/graph-types";
import type { LearningModule, ModuleTopic, ModulesView } from "./modules";

export const courseHref = (moduleKey: string) => `/skillstudio/course/${encodeURIComponent(moduleKey)}`;
export const lessonHref = (moduleKey: string, topicKey: string) => `${courseHref(moduleKey)}/${encodeURIComponent(topicKey)}`;

/** A topic is finished only when evidence proves it, and a skipped one is not asked for. */
const isOpen = (t: ModuleTopic) => t.status !== "TARGET_MET" && t.status !== "SKIPPED" && t.status !== "LOCKED";
const gapOf = (t: ModuleTopic) => (t.level === null ? (t.target ?? 100) : Math.max(0, (t.target ?? 100) - t.level));

export interface CourseStats {
  lessons: number;
  proven: number;
  learning: number;
  /** 0-100, null until something is measured */
  pct: number | null;
}

export function courseStats(m: LearningModule): CourseStats {
  return {
    lessons: m.topics.length,
    proven: m.topics.filter((t) => t.status === "TARGET_MET").length,
    learning: m.topics.filter((t) => t.userState === "LEARNING").length,
    pct: m.progress === null ? null : Math.round(m.progress),
  };
}

export type CourseState = "new" | "in-progress" | "complete";
export function courseState(m: LearningModule): CourseState {
  const s = courseStats(m);
  if (s.lessons > 0 && s.proven === s.lessons) return "complete";
  return s.proven > 0 || s.learning > 0 || (s.pct ?? 0) > 0 ? "in-progress" : "new";
}

export function overall(modules: readonly LearningModule[]) {
  const topics = modules.flatMap((m) => m.topics);
  const measured = topics.filter((t) => t.level !== null).length;
  const pcts = modules.map((m) => m.progress).filter((p): p is number => p !== null);
  return {
    lessons: topics.length,
    proven: topics.filter((t) => t.status === "TARGET_MET").length,
    learning: topics.filter((t) => t.userState === "LEARNING").length,
    measured,
    pct: pcts.length === 0 ? null : Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length),
  };
}

export interface Pick {
  module: LearningModule;
  topic: ModuleTopic;
  reason: "continue" | "gap" | "start";
}

/** Every open topic, what to do now first: ones the student marked Learning, then modules at their stage, then the biggest gap. */
function ranked(modules: readonly LearningModule[]): Pick[] {
  const all = modules.flatMap((module) => module.topics.filter(isOpen).map((topic) => ({ module, topic })));
  const score = (p: { module: LearningModule; topic: ModuleTopic }) => (p.topic.userState === "LEARNING" ? 1000 : 0) + (p.module.focus ? 200 : 0) + gapOf(p.topic);
  return all
    .sort((a, b) => score(b) - score(a))
    .map((p) => ({ ...p, reason: p.topic.userState === "LEARNING" ? ("continue" as const) : p.topic.level === null ? ("start" as const) : ("gap" as const) }));
}

export const nextPick = (modules: readonly LearningModule[]): Pick | null => ranked(modules)[0] ?? null;

/** More to learn after the next pick, one per module first so the list spans the path instead of draining one module. */
export function recommended(modules: readonly LearningModule[], count: number): Pick[] {
  const rest = ranked(modules).slice(1);
  const seen = new Set<string>();
  const firstPerModule = rest.filter((p) => (seen.has(p.module.key) ? false : (seen.add(p.module.key), true)));
  return [...firstPerModule, ...rest.filter((p) => !firstPerModule.includes(p))].slice(0, count);
}

export type CourseFilter = "all" | "now" | Stage;
export function filterCourses(modules: readonly LearningModule[], f: { stage: CourseFilter; query: string }): LearningModule[] {
  const q = f.query.trim().toLowerCase();
  return modules.filter((m) => {
    if (f.stage === "now" ? !m.focus : f.stage !== "all" && m.stage !== f.stage) return false;
    return !q || m.title.toLowerCase().includes(q) || m.topics.some((t) => t.title.toLowerCase().includes(q));
  });
}

/** The lessons either side of one in its course, for Previous and Next. */
export function neighbours(m: LearningModule, topicKey: string): { prev: ModuleTopic | null; next: ModuleTopic | null; index: number } {
  const i = m.topics.findIndex((t) => t.key === topicKey);
  return { prev: i > 0 ? m.topics[i - 1] : null, next: i >= 0 && i < m.topics.length - 1 ? m.topics[i + 1] : null, index: i };
}

export const findTopic = (view: ModulesView, topicKey: string): { module: LearningModule; topic: ModuleTopic } | null => {
  for (const m of view.modules) {
    const topic = m.topics.find((t) => t.key === topicKey);
    if (topic) return { module: m, topic };
  }
  return null;
};
