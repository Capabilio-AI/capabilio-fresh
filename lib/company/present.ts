import { SIZE_BANDS } from "./profile-schema";

export const DEFAULT_ACCENT = "#3a45c4";

const HEX = /^#[0-9a-f]{6}$/i;

/** Pure. A company's accent if it is a valid 6-digit hex, otherwise the house indigo. Never lets a bad stored value reach a style attribute. */
export function accentFor(raw: string | null | undefined): string {
  return raw && HEX.test(raw) ? raw.toLowerCase() : DEFAULT_ACCENT;
}

const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** Pure. WCAG relative luminance of a 6-digit hex. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Pure. Ink or white, whichever reads better on this accent (so any colour a company picks keeps a legible button). */
export function inkOn(hex: string): "#0c1020" | "#ffffff" {
  const L = luminance(hex);
  const withWhite = 1.05 / (L + 0.05);
  const withInk = (L + 0.05) / (luminance("#0c1020") + 0.05);
  return withWhite >= withInk ? "#ffffff" : "#0c1020";
}

export const POST_TYPE_LABEL: Record<string, string> = { update: "Update", hiring: "Hiring", milestone: "Milestone", event: "Event", announcement: "Announcement" };

/** Pure. The one-line facts under a company's name: only what it has filled in, in a fixed order. */
export function factLine(f: { industry: string | null; sizeBand: string | null; city: string | null; foundedYear: number | null }): string[] {
  const size = f.sizeBand && (SIZE_BANDS as readonly string[]).includes(f.sizeBand) ? `${f.sizeBand} people` : null;
  return [f.industry, size, f.city, f.foundedYear ? `Founded ${f.foundedYear}` : null].filter((x): x is string => Boolean(x));
}
