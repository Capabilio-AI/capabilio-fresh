/** A job as far as experience is concerned: exact dates when the person gave them, otherwise the wording from their resume. */
export interface ExperienceRow { start_date: string | null; end_date: string | null; period_text: string | null }

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const TOKEN = /(?:(\d{1,2})\s*[/.-]\s*(\d{4}))|(?:([A-Za-z]{3})[a-z]*\.?\s+(\d{4}))|(\d{4})|(present|current|now|till date|to date|ongoing)/gi;
const DAY = 86_400_000;

interface Point { year: number; month: number | null }

/** The two ends of a period written in words: "08/2017 - 09/2018", "Jan 2019 to Present", "2015 - 2018". Null when no year can be read. */
export function parsePeriod(text: string): { start: Point; end: Point | "present" | null } | null {
  const points: (Point | "present")[] = [];
  for (const m of text.matchAll(TOKEN)) {
    if (m[6]) points.push("present");
    else if (m[1] && m[2]) { const mo = Number(m[1]); if (mo >= 1 && mo <= 12) points.push({ year: Number(m[2]), month: mo }); }
    else if (m[3] && m[4]) { const mo = MONTHS[m[3].toLowerCase()]; if (mo) points.push({ year: Number(m[4]), month: mo }); }
    else if (m[5]) points.push({ year: Number(m[5]), month: null });
  }
  const first = points[0];
  if (!first || first === "present" || first.year < 1960 || first.year > 2100) return null;
  const second = points[1] ?? null;
  return { start: first, end: second };
}

/** The span a row covers, in milliseconds, or null when it carries no usable dates. A period without an end year runs to `now`. */
export function spanOf(row: ExperienceRow, now: Date): [number, number] | null {
  if (row.start_date) {
    const s = Date.parse(`${row.start_date}T00:00:00Z`);
    const e = row.end_date ? Date.parse(`${row.end_date}T00:00:00Z`) : now.getTime();
    return e > s ? [s, e] : null;
  }
  const p = row.period_text ? parsePeriod(row.period_text) : null;
  if (!p) return null;
  const s = Date.UTC(p.start.year, (p.start.month ?? 1) - 1, 1);
  let e = now.getTime();
  if (p.end && p.end !== "present") e = p.end.month ? Date.UTC(p.end.year, p.end.month, 1) : Date.UTC(p.end.year + 1, 0, 1);
  const capped = Math.min(e, now.getTime());
  return capped > s ? [s, capped] : null;
}

/** Whole months of experience, with overlapping jobs counted once and gaps not counted. */
export function experienceMonths(rows: readonly ExperienceRow[], now: Date = new Date()): number {
  const spans = rows.map((r) => spanOf(r, now)).filter((s): s is [number, number] => s !== null).sort((a, b) => a[0] - b[0]);
  let days = 0;
  let curStart = -1;
  let curEnd = -1;
  for (const [s, e] of spans) {
    if (s > curEnd) {
      if (curEnd > curStart) days += (curEnd - curStart) / DAY;
      curStart = s;
      curEnd = e;
    } else if (e > curEnd) curEnd = e;
  }
  if (curEnd > curStart) days += (curEnd - curStart) / DAY;
  return Math.floor(days / 30.4375);
}

/** "13 years 3 months", "8 months", "1 year". */
export function fmtExperience(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} ${y === 1 ? "year" : "years"}` : "", m || !y ? `${m} ${m === 1 ? "month" : "months"}` : ""].filter(Boolean).join(" ");
}
