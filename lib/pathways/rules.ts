import type { FactSpec, PathwaySpec } from "./schema";

/** Days a fact stays trusted when it names no validUntil. Exam rules and dates move, so the default is short. */
export const DEFAULT_FACT_DAYS = 90;
const DAY = 86_400_000;

export type Freshness = "fresh" | "due" | "stale";

/** Pure. Fresh until two weeks before it expires, due in the last two weeks, stale after: a stale fact is shown with "check the official site". */
export function freshness(fact: Pick<FactSpec, "retrievedAt" | "validUntil">, now: Date = new Date()): Freshness {
  const until = fact.validUntil ? Date.parse(fact.validUntil) : Date.parse(fact.retrievedAt) + DEFAULT_FACT_DAYS * DAY;
  if (Number.isNaN(until)) return "stale";
  const left = until - now.getTime();
  return left < 0 ? "stale" : left < 14 * DAY ? "due" : "fresh";
}

/**
 * What must NOT appear as plain words: a year, a calendar date, an amount of money, a percentage, an age, a number of attempts, vacancies or seats.
 * Each is a fact that changes and can cost a student years if wrong, so it has to be a cited fact written as {fact:key}, never prose.
 */
const FORBIDDEN: { name: string; re: RegExp }[] = [
  { name: "a year", re: /\b(19|20)\d{2}\b/ },
  { name: "a date", re: /\b\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/i },
  { name: "an amount of money", re: /₹|\brs\.?\s*\d|\binr\b|\blakh|\bcrore/i },
  { name: "a percentage", re: /\d\s*%|\bper\s?cent\b/i },
  { name: "an age or age limit", re: /\bage\b[^.]{0,40}\d|\d+\s*(years?\s*old|yrs?\b)|\bbetween\s+\d+\s+and\s+\d+\s+years/i },
  { name: "a number of attempts, vacancies or seats", re: /\d+\s*(attempts?|vacanc|posts?\b|seats?|positions?)|\b(attempts?|vacancies|seats)\b[^.]{0,20}\d/i },
];

const TOKEN = /\{fact:([a-z0-9-]+)\}/g;

function proseOf(spec: PathwaySpec): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [{ where: "summary", text: spec.summary }];
  for (const r of spec.routes) out.push({ where: `route ${r.key}`, text: `${r.title}. ${r.body}` });
  for (const s of spec.stages) for (const [i, st] of s.steps.entries()) out.push({ where: `stage ${s.key} step ${i + 1}`, text: `${st.title}. ${st.body}` });
  for (const d of spec.startThisWeek) out.push({ where: `day ${d.day}`, text: `${d.title}. ${d.body}` });
  for (const w of spec.watch) out.push({ where: `watch ${w.title}`, text: `${w.title}. ${w.how}` });
  out.push(...spec.honesty.map((t, i) => ({ where: `honesty ${i + 1}`, text: t })), ...spec.alternatives.map((t, i) => ({ where: `alternative ${i + 1}`, text: t })));
  return out;
}

/**
 * Pure. Why a pathway may not be saved, as plain sentences; an empty list means it may. The rules are the point of the whole feature: no
 * fact without a cited source, no changing number or date in prose, every {fact:key} must exist, and no duplicate keys.
 */
export function pathwayProblems(spec: PathwaySpec, today: Date = new Date()): string[] {
  const problems: string[] = [];
  const dup = (label: string, keys: string[]) => { for (const k of new Set(keys.filter((x, i) => keys.indexOf(x) !== i))) problems.push(`${label} "${k}" is used twice`); };
  dup("fact", spec.facts.map((f) => f.key));
  dup("route", spec.routes.map((r) => r.key));
  dup("stage", spec.stages.map((s) => s.key));

  const factKeys = new Set(spec.facts.map((f) => f.key));
  for (const f of spec.facts) {
    const t = Date.parse(f.retrievedAt);
    if (Number.isNaN(t)) problems.push(`fact "${f.key}" has an invalid retrieval date`);
    else if (t > today.getTime() + DAY) problems.push(`fact "${f.key}" was retrieved in the future`);
    if (f.validUntil && Date.parse(f.validUntil) < Date.parse(f.retrievedAt)) problems.push(`fact "${f.key}" expires before it was retrieved`);
  }
  for (const r of spec.routes) for (const k of r.eligibilityFacts) if (!factKeys.has(k)) problems.push(`route "${r.key}" cites the fact "${k}", which does not exist`);

  for (const { where, text } of proseOf(spec)) {
    for (const m of text.matchAll(TOKEN)) if (!factKeys.has(m[1])) problems.push(`${where} uses {fact:${m[1]}}, which does not exist`);
    const plain = text.replace(TOKEN, " ");
    for (const f of FORBIDDEN) if (f.re.test(plain)) problems.push(`${where} states ${f.name} as plain words, so put it in a cited fact and write {fact:key}`);
  }
  return problems;
}

/** Pure. Prose with each {fact:key} replaced by the fact's value, and the facts it used, in order of appearance. */
export function renderProse(text: string, facts: ReadonlyMap<string, FactSpec>): { text: string; used: FactSpec[] } {
  const used: FactSpec[] = [];
  const out = text.replace(TOKEN, (_, k: string) => {
    const f = facts.get(k);
    if (!f) return "(unavailable)";
    if (!used.includes(f)) used.push(f);
    return f.value;
  });
  return { text: out, used };
}
