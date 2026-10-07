/** RFC 4180 reader: quoted cells may hold commas, doubled quotes and line breaks (Excel exports all three). Pure. */
export interface CsvRow {
  /** 1-based line the row starts on, for error messages */
  line: number;
  cells: string[];
}

/** Excel in some locales saves with ";" — pick whichever of the two the first real line uses. */
export function detectDelimiter(text: string): "," | ";" {
  const first = text.split(/\r?\n/).find((l) => l.trim() !== "" && !l.trim().startsWith("#")) ?? "";
  return (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
}

export function parseCsv(input: string): CsvRow[] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const delimiter = detectDelimiter(text);
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  const endRow = () => {
    cells.push(cell.trim());
    cell = "";
    if (cells.some((c) => c !== "")) rows.push({ line: rowLine, cells });
    cells = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') quoted = false;
      else {
        if (ch === "\n") line++;
        cell += ch;
      }
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) (cells.push(cell.trim()), (cell = ""));
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
      line++;
      rowLine = line;
    } else cell += ch;
  }
  endRow();
  return rows;
}
