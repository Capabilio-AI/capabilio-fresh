import type { GradeCheck } from "@/lib/arena-workstations/types";
import type { BusinessDocsContent, BusinessDocsKey, BusinessDocsSubmission, ProcessStep } from "./types";

// Every check is a structural or traceability rule. None of them judges how well something is written.

type Story = BusinessDocsSubmission["stories"][number];
const check = (label: string, passed: boolean): GradeCheck => ({ label, passed });
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const sameName = (a: string, b: string) => norm(a) === norm(b);
const samePair = (a: readonly string[], b: readonly string[]) => [...a].map(norm).sort().join("|") === [...b].map(norm).sort().join("|");

const STORY = /^as an? (.{2,}?),? i want (?:to )?(.{2,}?),? so that (.{2,})$/;
const GIVEN_WHEN_THEN = /^\s*given\b[\s\S]+?\bwhen\b[\s\S]+?\bthen\b\s*\S/i;
const NUMBER = /(?:^|[^\w])\d+(?:[.,]\d+)?(?![a-z])/i;
/** words that make a criterion untestable unless a number pins them down */
export const VAGUE_WORDS = ["fast", "faster", "quick", "quickly", "slow", "user-friendly", "user friendly", "easy", "easily", "simple", "intuitive", "efficient", "seamless", "seamlessly", "robust", "responsive", "soon", "asap", "as soon as possible", "appropriate", "reasonable", "minimal", "better", "nice", "flexible", "etc"];
const VAGUE = new RegExp(`\\b(${VAGUE_WORDS.map((w) => w.replace(/[-\s]/g, "[-\\s]")).join("|")})\\b`, "i");

export function isStory(text: string): boolean {
  const m = STORY.exec(norm(text));
  return !!m && norm(m[2]) !== norm(m[3]);
}
export const isGivenWhenThen = (c: string) => GIVEN_WHEN_THEN.test(c);
export const isMeasurable = (c: string) => !VAGUE.test(c) || NUMBER.test(c);

const mentions = (s: Story, keywords: string[]) => {
  const all = norm([s.text, ...s.criteria].join(" "));
  return keywords.some((k) => all.includes(k));
};
const covering = (stories: Story[], noteId: string) => stories.filter((s) => s.covers.some((c) => sameName(c, noteId)));

export function storyChecks(sub: BusinessDocsSubmission, content: BusinessDocsContent, key: BusinessDocsKey): GradeCheck[] {
  const { stories } = sub;
  const noteIds = content.notes.map((n) => n.id);
  const criteria = stories.flatMap((s) => s.criteria.filter((c) => c.trim()));
  const texts = stories.map((s) => norm(s.text));
  const out = [
    check("Every stakeholder requirement is covered by a story", key.mustCover.every((r) => covering(stories, r.id).some((s) => mentions(s, r.keywords)))),
    check("Every story uses the form: As a …, I want …, so that …", stories.length > 0 && stories.every((s) => isStory(s.text))),
    check("Every story traces to a statement in the notes", stories.length > 0 && stories.every((s) => s.covers.length > 0 && s.covers.every((c) => noteIds.some((n) => sameName(n, c))))),
    check("Every story has at least one acceptance criterion", stories.length > 0 && stories.every((s) => s.criteria.some((c) => c.trim()))),
    check("Acceptance criteria are written as Given / When / Then", criteria.length > 0 && criteria.every(isGivenWhenThen)),
    check("Acceptance criteria are measurable (no vague word without a number)", criteria.length > 0 && criteria.every(isMeasurable)),
    check("Vague requests are pinned to a number", key.vague.every((v) => covering(stories, v).some((s) => s.criteria.some((c) => NUMBER.test(c))))),
    check("No duplicate stories", stories.length > 0 && new Set(texts).size === texts.length),
  ];
  if (key.contradiction) {
    const [a, b] = key.contradiction;
    out.push(check("No story builds both sides of a contradiction", !(covering(stories, a).length && covering(stories, b).length)));
  }
  return out;
}

export function issueChecks(sub: BusinessDocsSubmission, key: BusinessDocsKey): GradeCheck[] {
  const flagged = (kind: "contradiction" | "duplicate", pair: [string, string]) => sub.issues.some((i) => i.kind === kind && samePair(i.refs, pair));
  const real = (i: BusinessDocsSubmission["issues"][number]) => {
    const pair = i.kind === "contradiction" ? key.contradiction : key.duplicate;
    return !!pair && samePair(i.refs, pair);
  };
  return [
    ...(key.contradiction ? [check("The contradiction between two statements is flagged", flagged("contradiction", key.contradiction))] : []),
    ...(key.duplicate ? [check("The repeated request is flagged as a duplicate", flagged("duplicate", key.duplicate))] : []),
    check("Every flagged issue is real (no false alarms)", sub.issues.every(real)),
  ];
}

export function testChecks(sub: BusinessDocsSubmission, key: BusinessDocsKey): GradeCheck[] {
  const { stories, tests } = sub;
  const storyIds = new Set(stories.map((s) => norm(s.id)));
  const tested = new Set(tests.flatMap((t) => t.covers.map(norm)));
  const testIds = tests.map((t) => norm(t.id));
  return [
    check("Every requirement traces to at least one test", key.mustCover.every((r) => covering(stories, r.id).some((s) => tested.has(norm(s.id))))),
    check("Every story has a test", stories.length > 0 && stories.every((s) => tested.has(norm(s.id)))),
    check("No orphan tests (each one traces to a story)", tests.length > 0 && tests.every((t) => t.covers.length > 0 && t.covers.every((c) => storyIds.has(norm(c))))),
    check("Test IDs are unique", tests.length > 0 && new Set(testIds).size === testIds.length),
  ];
}

/** Every step reachable from `from` (inclusive), following links to steps that exist. */
function reachable(byId: Map<string, ProcessStep>, from: string): Set<string> {
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id) || !byId.has(id)) continue;
    seen.add(id);
    stack.push(...byId.get(id)!.next.map((n) => norm(n.to)));
  }
  return seen;
}

export function processChecks(sub: BusinessDocsSubmission, content: BusinessDocsContent, key: BusinessDocsKey): GradeCheck[] {
  const steps = sub.process;
  const byId = new Map(steps.map((s) => [norm(s.id), s]));
  const starts = steps.filter((s) => s.type === "start");
  const ends = steps.filter((s) => s.type === "end");
  const fromStart = starts.length === 1 ? reachable(byId, norm(starts[0].id)) : new Set<string>();
  const endIds = new Set(ends.map((e) => norm(e.id)));
  const leadsToEnd = (id: string) => [...reachable(byId, id)].some((r) => endIds.has(r));
  const work = steps.filter((s) => s.type === "task" || s.type === "decision");
  const decisions = steps.filter((s) => s.type === "decision");
  const rejoins = (d: ProcessStep) => {
    const sets = d.next.map((n) => reachable(byId, norm(n.to)));
    return sets.length >= 2 && [...sets[0]].some((id) => sets.every((s) => s.has(id)));
  };
  const required = key.requiredSteps ?? [];
  return [
    check("Exactly one start and at least one end", starts.length === 1 && ends.length >= 1),
    check("Unique step IDs, and every link points to a real step", byId.size === steps.length && steps.every((s) => s.next.every((n) => byId.has(norm(n.to)) && norm(n.to) !== norm(s.id)))),
    check("Every task and decision has an owner from the team list", work.length > 0 && work.every((s) => content.roles.some((r) => sameName(r, s.owner)))),
    check("Every step can be reached from the start", steps.length > 0 && steps.every((s) => fromStart.has(norm(s.id)))),
    check("Every step leads to an end, and ends lead nowhere", steps.length > 0 && ends.every((e) => e.next.length === 0) && steps.every((s) => leadsToEnd(norm(s.id)))),
    check("Only decisions branch, and each decision has at least two labelled branches", steps.every((s) => (s.type === "decision" ? s.next.length >= 2 && new Set(s.next.map((n) => norm(n.label))).size === s.next.length && s.next.every((n) => n.label.trim()) : s.next.length <= 1))),
    check("The branches of every decision rejoin", decisions.length > 0 && decisions.every(rejoins)),
    check("Every step the notes describe is on the map with the right owner", required.every((r) => steps.some((s) => s.type === r.type && r.keywords.some((k) => norm(s.label).includes(k)) && r.owners.some((o) => sameName(o, s.owner))))),
  ];
}

export function raciChecks(sub: BusinessDocsSubmission, content: BusinessDocsContent, key: BusinessDocsKey): GradeCheck[] {
  const tasks = content.raciTasks ?? [];
  const letters = (taskId: string) => {
    const row = sub.raci[taskId] ?? {};
    return content.roles.map((r) => row[r] ?? "");
  };
  const count = (taskId: string, l: string) => letters(taskId).filter((x) => x === l).length;
  return [
    check("Every task in the matrix has someone assigned", tasks.every((t) => letters(t.id).some(Boolean))),
    check("Exactly one Accountable (A) per task", tasks.every((t) => count(t.id, "A") === 1)),
    check("At least one Responsible (R) per task", tasks.every((t) => count(t.id, "R") >= 1)),
    check("The matrix matches the decision rights stated in the notes", (key.raciExpect ?? []).every((e) => (sub.raci[e.task] ?? {})[e.role] === e.letter)),
  ];
}

export function gapChecks(sub: BusinessDocsSubmission, content: BusinessDocsContent, key: BusinessDocsKey): GradeCheck[] {
  const rows = sub.gaps;
  const raised = (id: string) => rows.some((g) => sameName(g.note, id));
  return [
    check("Every requirement the current process misses has a gap row", (key.gaps ?? []).every(raised)),
    check("No gap is raised for something the current process already does", !(key.met ?? []).some(raised)),
    check("Every gap row points to a statement in the notes", rows.length > 0 && rows.every((g) => content.notes.some((n) => sameName(n.id, g.note)))),
    check("Every gap row states the current state, the target state, an action and an owner from the team", rows.length > 0 && rows.every((g) => g.current.trim() && g.target.trim() && g.action.trim() && content.roles.some((r) => sameName(r, g.owner)))),
  ];
}
