export interface CsvSubjectRow {
  branch: string;
  year: number;
  semester: number | null;
  name: string;
  code: string | null;
}

export type CsvParse = { ok: true; rows: CsvSubjectRow[] } | { ok: false; errors: string[] };

export const CSV_TEMPLATE = "branch,year,semester,subject_name,subject_code\n";
/** Downloadable starter file: replace the example rows with your own (the first line is the header). */
export const CSV_SAMPLE =
  CSV_TEMPLATE +
  [
    "Computer Science and Engineering,1,1,Engineering Mathematics I,MA101",
    "Computer Science and Engineering,2,1,Data Structures,CS201",
    "Computer Science and Engineering,2,2,Database Management Systems,CS202",
    "Computer Science and Engineering,3,1,Operating Systems,CS301",
    'Computer Science and Engineering,3,2,"Machine Learning, Introduction",CS302',
    "Electronics and Communication Engineering,2,1,Signals and Systems,EC201",
    "Mechanical Engineering,3,1,Thermodynamics,ME301",
  ].join("\n") +
  "\n";
const MAX_ROWS = 300;

/** Minimal RFC-4180-ish line splitter: handles quoted fields with commas and "" escapes. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') (cur += '"'), i++;
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") (out.push(cur), (cur = ""));
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Pure. The admin previews these rows before anything is sent; the server validates them again. */
export function parseCurriculumCsv(text: string): CsvParse {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { ok: false, errors: ["The file is empty."] };
  const header = splitLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (n: string) => header.indexOf(n);
  const [b, y, s, n, c] = ["branch", "year", "semester", "subject_name", "subject_code"].map(idx);
  if (b < 0 || y < 0 || n < 0) return { ok: false, errors: ["Header must include: branch, year, subject_name (semester and subject_code are optional)."] };
  if (lines.length - 1 > MAX_ROWS) return { ok: false, errors: [`At most ${MAX_ROWS} subjects per import.`] };

  const rows: CsvSubjectRow[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((line, i) => {
    const f = splitLine(line);
    const lineNo = i + 2;
    const year = Number(f[y]);
    const semRaw = s >= 0 ? f[s] : "";
    const semester = semRaw ? Number(semRaw) : null;
    if (!f[b]) errors.push(`Line ${lineNo}: branch is missing.`);
    if (!f[n]) errors.push(`Line ${lineNo}: subject_name is missing.`);
    if (!Number.isInteger(year) || year < 1 || year > 6) errors.push(`Line ${lineNo}: year must be 1–6.`);
    if (semester !== null && (!Number.isInteger(semester) || semester < 1 || semester > 2)) errors.push(`Line ${lineNo}: semester must be 1 or 2.`);
    if (f[b] && f[n] && Number.isInteger(year) && year >= 1 && year <= 6) {
      rows.push({ branch: f[b], year, semester, name: f[n], code: c >= 0 && f[c] ? f[c] : null });
    }
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, rows };
}
