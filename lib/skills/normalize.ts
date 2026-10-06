/** Canonical form used for alias storage and lookup: lowercase, accents removed, punctuation dropped (keeping + and #), spaces collapsed. */
export function normalizeSkillText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
