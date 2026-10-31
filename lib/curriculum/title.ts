const SMALL = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);

/**
 * Syllabus PDFs print some course names in capitals ("BLOCK CHAIN TECHNOLOGY") and others in normal case. A name typed in ALL CAPS is shown
 * in title case so the list reads evenly; mixed-case names (DevOps, Linear Algebra & Calculus) are left exactly as written.
 * Short all-caps words (AI, IoT-style codes, roman numerals) are kept as they are.
 */
export function tidyTitle(title: string): string {
  const letters = title.replace(/[^A-Za-z]/g, "");
  if (letters.length < 4 || letters !== letters.toUpperCase()) return title;
  return title
    .split(/(\s+)/)
    .map((w, i) => {
      const bare = w.replace(/[^A-Za-z]/g, "");
      if (!bare || /^\s+$/.test(w)) return w;
      if (bare.length <= 2 && !SMALL.has(bare.toLowerCase())) return w; // AI, ML, IT, II
      if (/^[IVX]+$/.test(bare)) return w; // roman numerals: Programming II
      if (i > 0 && SMALL.has(bare.toLowerCase())) return w.toLowerCase();
      return w.charAt(0) + w.slice(1).toLowerCase();
    })
    .join("");
}
