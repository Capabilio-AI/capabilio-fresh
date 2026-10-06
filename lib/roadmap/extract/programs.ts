/** Pure. Programme-level facts from the syllabus: PO/PSO statements and the regulation named in the running header. */
export interface ProgramOutcome {
  code: string;
  kind: "PO" | "PSO";
  text: string;
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function readItems(lines: string[], prefix: "PO" | "PSO"): ProgramOutcome[] {
  const item = new RegExp(`^${prefix}\\s?(\\d{1,2})\\s*[:.]\\s*(.*)$`, "i");
  const out: { n: number; text: string }[] = [];
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    const m = item.exec(t);
    if (m) out.push({ n: Number(m[1]), text: m[2] });
    else if (out.length > 0) out[out.length - 1].text += ` ${t}`;
  }
  return out.map((o) => ({ code: `${prefix}${o.n}`, kind: prefix, text: clean(o.text).replace(/^"|"$/g, "").trim() })).filter((o) => o.text.length > 8);
}

/** Only the region between the PO heading and the PSO/mapping headings is read, so a course's "PO1 PO2 …" matrix can never be mistaken for outcomes. */
export function parseProgramOutcomes(pages: string[]): { pos: ProgramOutcome[]; psos: ProgramOutcome[] } {
  const lines = pages.join("\n").split(/\r?\n/);
  const find = (re: RegExp, from = 0) => lines.findIndex((l, i) => i >= from && re.test(l.trim()));
  const poStart = find(/^Programme Outcomes\s*\(POs\)/i);
  const psoStart = find(/^Programme Specific Outcomes\s*\(PSOs\)/i, Math.max(poStart, 0));
  const psoEnd = psoStart < 0 ? -1 : find(/^(Mapping of|Model Lab|PEO\s*\\)/i, psoStart + 1);
  const pos = poStart < 0 ? [] : readItems(lines.slice(poStart + 1, psoStart > poStart ? psoStart : poStart + 60), "PO");
  const psos = psoStart < 0 ? [] : readItems(lines.slice(psoStart + 1, psoEnd > psoStart ? psoEnd : psoStart + 30), "PSO");
  return { pos, psos };
}

/** The regulation is read from the "R23 B.Tech … COURSE STRUCTURE" style header only — never guessed from body text. */
export function detectRegulation(headerText: string): { regulation: string | null; program: string | null } {
  const m = /\b(R\d{2})\s+(B\.?\s?Tech|M\.?\s?Tech|B\.?\s?Pharm|MBA|MCA)\b/i.exec(headerText);
  if (!m) return { regulation: null, program: null };
  return { regulation: m[1].toUpperCase(), program: m[2].replace(/\s+/g, "").replace(/^B\.?Tech$/i, "B.Tech").replace(/^M\.?Tech$/i, "M.Tech") };
}
