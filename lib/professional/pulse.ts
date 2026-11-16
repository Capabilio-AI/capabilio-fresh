/** Order matches the composer: update, project, resource, question, achievement. */
export const KINDS = ["update", "project", "resource", "ask", "win"] as const;
export type PostKind = (typeof KINDS)[number];
export const KIND_LABEL: Record<PostKind, string> = { update: "Update", project: "Project", resource: "Resource", ask: "Question", win: "Achievement" };

export const MAX_BODY = 2000;
export const MAX_TITLE = 120;
export const MAX_COMMENT = 800;
export const MAX_TAGS = 5;
export const MAX_NOTE = 160;
/** Notes disappear after this long. */
export const NOTE_HOURS = 24;
export const REPORT_REASONS = ["spam", "harassment", "misleading", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

const TAG = /#([A-Za-z][A-Za-z0-9_]{1,29})/g;

/** Up to five distinct #tags in a post, lower-cased, in the order they appear. */
export function extractTags(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(TAG)) {
    seen.add(m[1].toLowerCase());
    if (seen.size === MAX_TAGS) break;
  }
  return [...seen];
}

/** The address only when it is a plain http or https link of a sensible length; anything else is refused. */
export function safeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t || t.length > 500) return null;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export interface PostValue { kind: PostKind; title: string | null; body: string; link: string | null; tags: string[] }
export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

const isKind = (v: unknown): v is PostKind => typeof v === "string" && (KINDS as readonly string[]).includes(v);
const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** What a post needs. Everything except a plain update carries a title; a resource carries a link; anything given must be valid. */
export function validatePost(input: unknown): Checked<PostValue> {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  if (!isKind(i.kind)) return { ok: false, error: "Choose what kind of post this is." };
  const body = text(i.body);
  if (!body) return { ok: false, error: "Write something first." };
  if (body.length > MAX_BODY) return { ok: false, error: `Keep the post under ${MAX_BODY} characters.` };
  const title = text(i.title);
  if (title.length > MAX_TITLE) return { ok: false, error: `Keep the title under ${MAX_TITLE} characters.` };
  if (i.kind !== "update" && !title) return { ok: false, error: `Give your ${KIND_LABEL[i.kind].toLowerCase()} a title.` };
  const rawLink = text(i.link);
  const link = rawLink ? safeUrl(rawLink) : null;
  if (rawLink && !link) return { ok: false, error: "The link must start with http:// or https://." };
  if (i.kind === "resource" && !link) return { ok: false, error: "Add the link to the resource." };
  return { ok: true, value: { kind: i.kind, title: title || null, body, link, tags: extractTags(`${title} ${body}`) } };
}

/** A note: one short line. */
export function validateNote(input: unknown): Checked<string> {
  const body = text(input);
  if (!body) return { ok: false, error: "Write a note first." };
  if (body.length > MAX_NOTE) return { ok: false, error: `Keep the note under ${MAX_NOTE} characters.` };
  return { ok: true, value: body };
}

export function validateComment(input: unknown): Checked<string> {
  const body = text(input);
  if (!body) return { ok: false, error: "Write a comment first." };
  if (body.length > MAX_COMMENT) return { ok: false, error: `Keep the comment under ${MAX_COMMENT} characters.` };
  return { ok: true, value: body };
}

export const isReason = (v: unknown): v is ReportReason => typeof v === "string" && (REPORT_REASONS as readonly string[]).includes(v);

const DAY = 86_400_000;

/** The tags used most in the last `days` days, most used first and then alphabetical. */
export function trendingTags(posts: readonly { tags: readonly string[]; created_at: string }[], now: Date = new Date(), days = 7, limit = 5): { tag: string; count: number }[] {
  const since = now.getTime() - days * DAY;
  const counts = new Map<string, number>();
  for (const p of posts) {
    if (Date.parse(p.created_at) < since) continue;
    for (const t of new Set(p.tags)) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)).slice(0, limit);
}

/** "now", "5 min ago", "3 h ago", "yesterday", "4 days ago", then a date. */
export function agoLabel(iso: string, now: Date = new Date()): string {
  const mins = Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 60_000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)} h ago`;
  const days = Math.floor(mins / 1440);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
