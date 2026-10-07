import { z } from "zod";
import { hashtagsOf, type PostKind } from "./format";

/**
 * What each kind of post carries. A project is not a question is not an achievement: each has its own fields, validated here and
 * stored in posts.meta, so the composer and the card can show what actually matters for that kind.
 */
export const MAX_DOC_BYTES = 10 * 1024 * 1024;

const httpUrl = z.string().trim().max(500).url().refine((u) => /^https?:\/\//i.test(u), "Use a full http(s) link.");
const optionalUrl = httpUrl.optional().or(z.literal("").transform(() => undefined));
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal("").transform(() => undefined));

/** Lower-cased, de-duplicated tags with the leading # removed; anything that isn't a usable tag is dropped. */
export function normalizeTags(tags: readonly string[], max: number): string[] {
  const clean = tags.map((t) => t.trim().replace(/^#+/, "").toLowerCase().replace(/\s+/g, "-")).filter((t) => /^[a-z0-9][a-z0-9+#._-]{0,29}$/.test(t));
  return [...new Set(clean)].slice(0, max);
}
const tagList = (max: number) => z.array(z.string().max(40)).max(max + 4).default([]).transform((t) => normalizeTags(t, max));

const Attachment = z.object({ path: z.string().max(300), name: z.string().trim().min(1).max(200), size: z.number().int().min(1).max(MAX_DOC_BYTES) }).strict();
const media = { imagePath: z.string().max(300).optional(), attachment: Attachment.optional() };

export const PostInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("post"), content: z.string().trim().min(1).max(3000), ...media }).strict(),
  z
    .object({
      kind: z.literal("project"),
      title: z.string().trim().min(3).max(100),
      content: z.string().trim().min(10).max(3000),
      stack: tagList(8),
      repoUrl: optionalUrl,
      demoUrl: optionalUrl,
      status: z.enum(["building", "shipped"]).default("building"),
      ...media,
    })
    .strict(),
  z.object({ kind: z.literal("question"), title: z.string().trim().min(10).max(150), content: z.string().trim().max(3000).default(""), tags: tagList(5), ...media }).strict(),
  z
    .object({
      kind: z.literal("achievement"),
      title: z.string().trim().min(3).max(120),
      issuer: optionalText(100),
      achievedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date.").optional().or(z.literal("").transform(() => undefined)),
      proofUrl: optionalUrl,
      content: z.string().trim().max(1000).default(""),
      ...media,
    })
    .strict(),
]);
export type PostInput = z.infer<typeof PostInputSchema>;

export type PostMeta =
  | { kind: "project"; title: string; stack: string[]; repoUrl?: string; demoUrl?: string; status: "building" | "shipped" }
  | { kind: "question"; title: string; tags: string[] }
  | { kind: "achievement"; title: string; issuer?: string; achievedOn?: string; proofUrl?: string };

export interface PostRowFields {
  content: string;
  kind: PostKind;
  meta: Record<string, unknown> | null;
  image_path: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  /** #hashtags in the text plus the structured tags (stack, question tags), lower-cased */
  tags: string[];
}

const compact = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0)));

/** Pure. The columns to store for a validated post. */
export function toRowFields(input: PostInput): PostRowFields {
  const files = { image_path: input.imagePath ?? null, attachment_path: input.attachment?.path ?? null, attachment_name: input.attachment?.name ?? null, attachment_size: input.attachment?.size ?? null };
  const withTags = (content: string, extra: readonly string[] = []) => [...new Set([...hashtagsOf(content), ...extra])];
  switch (input.kind) {
    case "post":
      return { content: input.content, kind: "post", meta: null, tags: withTags(input.content), ...files };
    case "project":
      return { content: input.content, kind: "project", meta: compact({ title: input.title, stack: input.stack, repoUrl: input.repoUrl, demoUrl: input.demoUrl, status: input.status }), tags: withTags(input.content, input.stack), ...files };
    case "question":
      return { content: input.content, kind: "question", meta: compact({ title: input.title, tags: input.tags }), tags: withTags(`${input.title} ${input.content}`, input.tags), ...files };
    case "achievement":
      return { content: input.content, kind: "achievement", meta: compact({ title: input.title, issuer: input.issuer, achievedOn: input.achievedOn, proofUrl: input.proofUrl }), tags: withTags(`${input.title} ${input.content}`), ...files };
  }
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Tolerant reader for stored meta (old rows have none). Null when there is nothing structured to show. */
export function readMeta(kind: PostKind, meta: unknown): PostMeta | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  const title = str(m.title);
  if (!title) return null;
  if (kind === "project") return { kind, title, stack: strs(m.stack), repoUrl: str(m.repoUrl), demoUrl: str(m.demoUrl), status: m.status === "shipped" ? "shipped" : "building" };
  if (kind === "question") return { kind, title, tags: strs(m.tags) };
  if (kind === "achievement") return { kind, title, issuer: str(m.issuer), achievedOn: str(m.achievedOn), proofUrl: str(m.proofUrl) };
  return null;
}

/** Every tag a post carries in its structured fields, for trending. */
export const metaTags = (meta: PostMeta | null): string[] => (meta?.kind === "project" ? meta.stack : meta?.kind === "question" ? meta.tags : []);
