/**
 * Grades the short note an analyst writes to the person who asked. It is not a judgement of prose. It checks the three things a good note always has,
 * each against the real answer: it states the key figure correctly, it names where the finding is, and it says what to do next. Anything a person could
 * not act on fails. These are number and keyword checks, and the interface says so.
 */
export interface NoteKey {
  /** the figure(s) the note must state, with how far a stated figure may be off and still count */
  figures: { value: number; tolerance: number }[];
  /** names the note must mention (a channel, a city, a product, a date); a date may be written 2026-05-14, 14 May or May 14 */
  names: string[];
}

export interface NoteCheck {
  label: string;
  passed: boolean;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const ACTION_CUES = /\b(recommend|suggest|propose|should|need to|needs to|must|next step|next steps|action|please (?:check|fix|review|reload|pause|stop|investigate)|let'?s|we can|i would|i'd|fix|re-?load|investigate|review|pause|stop|audit|follow up|follow-up|monitor|escalate)\b/i;

/** Every amount written in the note, in rupees or plain numbers: 1,25,000 / ₹1.25 lakh / 85k / 2 crore / 4.5% all become numbers. */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  const re = /(-?\d[\d,]*(?:\.\d+)?)\s*(crore|cr|lakhs?|lacs?|million|mn|thousand|k|m)?\b/gi;
  for (const m of text.matchAll(re)) {
    const base = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(base)) continue;
    const unit = (m[2] ?? "").toLowerCase();
    const scale = /^crore|^cr$/.test(unit) ? 1e7 : /^lakh|^lac/.test(unit) ? 1e5 : /^million$|^mn$|^m$/.test(unit) ? 1e6 : /^thousand$|^k$/.test(unit) ? 1e3 : 1;
    out.push(base * scale);
  }
  return out;
}

const wordCount = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const norm = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();

function mentions(note: string, name: string): boolean {
  const n = norm(name);
  const text = norm(note);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(n);
  if (iso) {
    const day = Number(iso[3]);
    const month = MONTHS[Number(iso[2]) - 1];
    return text.includes(n) || new RegExp(`\\b${day}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${month.slice(0, 3)}[a-z]*\\b|\\b${month.slice(0, 3)}[a-z]*\\s+${day}(?:st|nd|rd|th)?\\b`).test(text);
  }
  return text.includes(n);
}

export function gradeNote(note: string | undefined, key: NoteKey): { passed: boolean; checks: NoteCheck[] } {
  const text = (note ?? "").trim();
  const nums = numbersIn(text);
  const words = wordCount(text);
  const checks: NoteCheck[] = [
    { label: "States the key figure correctly", passed: key.figures.length === 0 || key.figures.every((f) => nums.some((n) => Math.abs(n - f.value) <= Math.max(f.tolerance, Math.abs(f.value) * 0.005))) },
    { label: "Names where the finding is", passed: key.names.length === 0 || key.names.every((n) => mentions(text, n)) },
    { label: "Says what to do next", passed: ACTION_CUES.test(text) },
    { label: "Short enough to read (20 to 150 words)", passed: words >= 20 && words <= 150 },
  ];
  return { passed: checks.every((c) => c.passed), checks };
}

/** TEST SUPPORT: a note that satisfies every check for this key, to drive end-to-end tests through the real grader. */
export function referenceNote(key: NoteKey): string {
  const figures = key.figures.map((f) => f.value.toLocaleString("en-IN")).join(" and ");
  return `The finding is ${key.names.join(" and ")}${figures ? `, with a figure of ${figures}` : ""}. I recommend we review it with the owner and follow up on the next steps before the next report goes out.`;
}
