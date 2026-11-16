export const STAGES = ["saved", "applied", "screening", "interview", "offer", "accepted", "rejected", "withdrawn"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = { saved: "Saved", applied: "Applied", screening: "Screening", interview: "Interview", offer: "Offer", accepted: "Accepted", rejected: "Rejected", withdrawn: "Withdrawn" };
export const OPEN_STAGES: readonly Stage[] = ["saved", "applied", "screening", "interview", "offer"];
export const CLOSED_STAGES: readonly Stage[] = ["accepted", "rejected", "withdrawn"];

export const ROUNDS = ["screen", "technical", "hr", "final", "offer", "other"] as const;
export type Round = (typeof ROUNDS)[number];
export const ROUND_LABEL: Record<Round, string> = { screen: "Screening call", technical: "Technical", hr: "HR", final: "Final", offer: "Offer", other: "Other" };
export const OUTCOMES = ["positive", "mixed", "negative", "pending"] as const;
export type Outcome = (typeof OUTCOMES)[number];
export const OUTCOME_LABEL: Record<Outcome, string> = { positive: "Went well", mixed: "Mixed", negative: "Did not go well", pending: "Waiting to hear" };

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[ \t]+/g, " ").trim().slice(0, max + 1) : "");
const day = (v: unknown, now: Date): string | null => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const t = Date.parse(`${v}T00:00:00Z`);
  return Number.isNaN(t) || t > now.getTime() + 86_400_000 ? null : v;
};
const isStage = (v: unknown): v is Stage => typeof v === "string" && (STAGES as readonly string[]).includes(v);

export interface ApplicationValue { company: string; role: string; link: string | null; stage: Stage; appliedOn: string | null; notes: string | null }

/** A job the professional is tracking. The link, when given, must be http or https; the date is not in the future. */
export function validateApplication(input: unknown, now: Date = new Date()): Checked<ApplicationValue> {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const company = clean(i.company, 120);
  const role = clean(i.role, 120);
  if (!company || company.length > 120) return { ok: false, error: "Tell us the company (up to 120 characters)." };
  if (!role || role.length > 120) return { ok: false, error: "Tell us the role (up to 120 characters)." };
  const stage = i.stage === undefined || i.stage === "" ? "applied" : i.stage;
  if (!isStage(stage)) return { ok: false, error: "Choose a stage." };
  const rawLink = clean(i.link, 500);
  let link: string | null = null;
  if (rawLink) {
    try {
      const u = new URL(rawLink);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("scheme");
      link = u.toString();
    } catch {
      return { ok: false, error: "The link must start with http:// or https://." };
    }
    if (link.length > 500) return { ok: false, error: "That link is too long." };
  }
  const rawDate = typeof i.appliedOn === "string" ? i.appliedOn : "";
  const appliedOn = rawDate ? day(rawDate, now) : null;
  if (rawDate && !appliedOn) return { ok: false, error: "Choose a valid date, not in the future." };
  const notes = typeof i.notes === "string" ? i.notes.trim() : "";
  if (notes.length > 2000) return { ok: false, error: "Keep the notes under 2,000 characters." };
  return { ok: true, value: { company, role, link, stage, appliedOn, notes: notes || null } };
}

/** The changes allowed on an existing application: its stage and its notes. */
export function validateApplicationUpdate(input: unknown): Checked<{ stage?: Stage; notes?: string | null }> {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: { stage?: Stage; notes?: string | null } = {};
  if (i.stage !== undefined) { if (!isStage(i.stage)) return { ok: false, error: "Choose a stage." }; out.stage = i.stage; }
  if (i.notes !== undefined) {
    const n = typeof i.notes === "string" ? i.notes.trim() : "";
    if (n.length > 2000) return { ok: false, error: "Keep the notes under 2,000 characters." };
    out.notes = n || null;
  }
  return Object.keys(out).length ? { ok: true, value: out } : { ok: false, error: "Nothing to change." };
}

export interface FeedbackValue { applicationId: string; round: Round; outcome: Outcome; wentWell: string | null; toImprove: string | null; givenOn: string }

/** What an interviewer or recruiter told the professional about one round. At least one of the two notes is needed unless it is still pending. */
export function validateFeedback(input: unknown, now: Date = new Date()): Checked<FeedbackValue> {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  if (typeof i.applicationId !== "string" || !UUID.test(i.applicationId)) return { ok: false, error: "Choose the application." };
  if (typeof i.round !== "string" || !(ROUNDS as readonly string[]).includes(i.round)) return { ok: false, error: "Choose the round." };
  if (typeof i.outcome !== "string" || !(OUTCOMES as readonly string[]).includes(i.outcome)) return { ok: false, error: "Choose how it went." };
  const wentWell = typeof i.wentWell === "string" ? i.wentWell.trim() : "";
  const toImprove = typeof i.toImprove === "string" ? i.toImprove.trim() : "";
  if (wentWell.length > 1000 || toImprove.length > 1000) return { ok: false, error: "Keep each note under 1,000 characters." };
  if (i.outcome !== "pending" && !wentWell && !toImprove) return { ok: false, error: "Write what went well or what to improve." };
  const givenOn = day(i.givenOn ?? new Date(now).toISOString().slice(0, 10), now);
  if (!givenOn) return { ok: false, error: "Choose a valid date, not in the future." };
  return { ok: true, value: { applicationId: i.applicationId, round: i.round as Round, outcome: i.outcome as Outcome, wentWell: wentWell || null, toImprove: toImprove || null, givenOn } };
}

const STOP = new Set("the a an and or but to of in on at for with is are was were be been it this that my your our you i we they them from as by not no more less too very need needs better improve work working".split(" "));

export interface Insights {
  total: number;
  byOutcome: Record<Outcome, number>;
  byRound: { round: Round; positive: number; total: number }[];
  themes: { word: string; count: number }[];
}

/** Patterns across all feedback: how it went overall, round by round, and the words that keep coming up under "to improve". */
export function insights(rows: readonly { round: Round; outcome: Outcome; to_improve: string | null }[]): Insights {
  const byOutcome: Record<Outcome, number> = { positive: 0, mixed: 0, negative: 0, pending: 0 };
  const rounds = new Map<Round, { positive: number; total: number }>();
  const words = new Map<string, number>();
  for (const r of rows) {
    byOutcome[r.outcome]++;
    if (r.outcome !== "pending") {
      const cur = rounds.get(r.round) ?? { positive: 0, total: 0 };
      rounds.set(r.round, { positive: cur.positive + (r.outcome === "positive" ? 1 : 0), total: cur.total + 1 });
    }
    const seen = new Set<string>();
    for (const w of (r.to_improve ?? "").toLowerCase().match(/[a-z][a-z+#.-]{2,}/g) ?? []) if (!STOP.has(w) && !seen.has(w)) { seen.add(w); words.set(w, (words.get(w) ?? 0) + 1); }
  }
  return {
    total: rows.length,
    byOutcome,
    byRound: ROUNDS.filter((r) => rounds.has(r)).map((round) => ({ round, ...rounds.get(round)! })),
    themes: [...words].filter(([, n]) => n >= 2).map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word)).slice(0, 6),
  };
}
