export function initialsOf(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0]?.slice(0, 2).toUpperCase() ?? "?";
}

export function relativeTime(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Hours left on a story, for the viewer's "expires in" label. */
export function hoursLeft(expiresAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 3_600_000));
}

const TAG = /(^|\s)#([A-Za-z][A-Za-z0-9_]{1,29})\b/g;

/** Lower-cased hashtags in a text, in order, without duplicates. */
export function hashtagsOf(text: string): string[] {
  return [...new Set([...text.matchAll(TAG)].map((m) => m[2].toLowerCase()))];
}

/** Splits text into plain and #tag parts so a renderer can link the tags without dangerouslySetInnerHTML. */
export function splitTags(text: string): { text: string; tag?: string }[] {
  const out: { text: string; tag?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(TAG)) {
    const start = (m.index ?? 0) + m[1].length;
    if (start > last) out.push({ text: text.slice(last, start) });
    out.push({ text: `#${m[2]}`, tag: m[2].toLowerCase() });
    last = start + m[2].length + 1;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** Escapes LIKE wildcards so a search string is matched literally. */
export const escapeLike = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const LEGACY = /^\[(Project|Question|Achievement)\]\s*/;
export type PostKind = "post" | "project" | "question" | "achievement";
/** Posts written before the kind column carried their type as a text prefix. */
export function legacyKind(content: string): { kind: PostKind; content: string } {
  const m = LEGACY.exec(content);
  return m ? { kind: m[1].toLowerCase() as PostKind, content: content.slice(m[0].length) } : { kind: "post", content };
}
