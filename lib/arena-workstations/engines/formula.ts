// Restricted spreadsheet formula engine: tokenizer → Pratt parser → tree
// evaluator. No eval/Function. Shared by the browser grid (live values) and
// the server grader, so both compute identical results.

export type FormulaError = "#DIV/0!" | "#VALUE!" | "#REF!" | "#NAME?" | "#N/A" | "#CIRC!" | "#ERROR!";
export type CellValue = number | string | boolean | null | { error: FormulaError };
export type Sheet = Record<string, string>; // "A1" -> raw input ("=SUM(A1:A3)", "12", "Delhi")

const err = (e: FormulaError): CellValue => ({ error: e });
export const isError = (v: CellValue): v is { error: FormulaError } => typeof v === "object" && v !== null && "error" in v;

// ── Addresses ────────────────────────────────────────────────────────────────
export function columnIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
export function columnLetters(index: number): string {
  let s = "";
  let n = index + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
export function parseAddress(addr: string): { col: number; row: number } | null {
  const m = /^\$?([A-Z]{1,3})\$?(\d{1,5})$/i.exec(addr);
  if (!m) return null;
  return { col: columnIndex(m[1]), row: Number(m[2]) - 1 };
}
export const address = (col: number, row: number) => `${columnLetters(col)}${row + 1}`;

// ── Tokenizer ────────────────────────────────────────────────────────────────
type Token =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "ref"; v: string }
  | { t: "name"; v: string }
  | { t: "op"; v: string }
  | { t: "(" }
  | { t: ")" }
  | { t: "," }
  | { t: ":" };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^\d*\.?\d+(?:[eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m) throw new Error("bad number");
      out.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let s = "";
      while (j < src.length) {
        if (src[j] === '"' && src[j + 1] === '"') {
          s += '"';
          j += 2;
        } else if (src[j] === '"') break;
        else s += src[j++];
      }
      if (j >= src.length) throw new Error("unterminated string");
      out.push({ t: "str", v: s });
      i = j + 1;
      continue;
    }
    const word = /^\$?[A-Za-z_][A-Za-z0-9_.]*\$?\d*/.exec(src.slice(i));
    if (word) {
      const w = word[0];
      if (parseAddress(w)) out.push({ t: "ref", v: w.replace(/\$/g, "").toUpperCase() });
      else out.push({ t: "name", v: w.toUpperCase() });
      i += w.length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === "<=" || two === ">=" || two === "<>") {
      out.push({ t: "op", v: two });
      i += 2;
      continue;
    }
    if ("+-*/^&=<>%".includes(c)) out.push({ t: "op", v: c });
    else if (c === "(") out.push({ t: "(" });
    else if (c === ")") out.push({ t: ")" });
    else if (c === "," || c === ";") out.push({ t: "," });
    else if (c === ":") out.push({ t: ":" });
    else throw new Error(`unexpected character ${c}`);
    i++;
  }
  return out;
}

// ── Parser ───────────────────────────────────────────────────────────────────
export type Node =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "bool"; v: boolean }
  | { k: "ref"; addr: string }
  | { k: "range"; from: string; to: string }
  | { k: "unary"; op: string; arg: Node }
  | { k: "percent"; arg: Node }
  | { k: "bin"; op: string; l: Node; r: Node }
  | { k: "call"; name: string; args: Node[] };

const PRECEDENCE: Record<string, number> = { "=": 1, "<>": 1, "<": 1, ">": 1, "<=": 1, ">=": 1, "&": 2, "+": 3, "-": 3, "*": 4, "/": 4, "^": 5 };

export function parseFormula(src: string): Node {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function primary(): Node {
    const tok = next();
    if (!tok) throw new Error("unexpected end");
    if (tok.t === "num") return { k: "num", v: tok.v };
    if (tok.t === "str") return { k: "str", v: tok.v };
    if (tok.t === "op" && (tok.v === "-" || tok.v === "+")) return { k: "unary", op: tok.v, arg: postfix(unaryOperand()) };
    if (tok.t === "(") {
      const e = expr(0);
      if (next()?.t !== ")") throw new Error("missing )");
      return e;
    }
    if (tok.t === "ref") {
      if (peek()?.t === ":") {
        next();
        const to = next();
        if (to?.t !== "ref") throw new Error("bad range");
        return { k: "range", from: tok.v, to: to.v };
      }
      return { k: "ref", addr: tok.v };
    }
    if (tok.t === "name") {
      if (tok.v === "TRUE" || tok.v === "FALSE") return { k: "bool", v: tok.v === "TRUE" };
      if (peek()?.t !== "(") throw new Error(`unknown name ${tok.v}`);
      next();
      const args: Node[] = [];
      if (peek()?.t !== ")") {
        args.push(expr(0));
        while (peek()?.t === ",") {
          next();
          args.push(expr(0));
        }
      }
      if (next()?.t !== ")") throw new Error("missing ) after arguments");
      return { k: "call", name: tok.v, args };
    }
    throw new Error("unexpected token");
  }
  function unaryOperand(): Node {
    return primary();
  }
  function postfix(n: Node): Node {
    let node = n;
    while (peek()?.t === "op" && (peek() as { v: string }).v === "%") {
      next();
      node = { k: "percent", arg: node };
    }
    return node;
  }
  function expr(minPrec: number): Node {
    let left = postfix(primary());
    for (;;) {
      const tok = peek();
      if (!tok || tok.t !== "op" || tok.v === "%") break;
      const prec = PRECEDENCE[tok.v];
      if (prec === undefined || prec < minPrec) break;
      next();
      const right = expr(tok.v === "^" ? prec : prec + 1);
      left = { k: "bin", op: tok.v, l: left, r: right };
    }
    return left;
  }

  const tree = expr(0);
  if (pos !== tokens.length) throw new Error("unexpected trailing input");
  return tree;
}

// ── Evaluation ───────────────────────────────────────────────────────────────
type Arg = CellValue | CellValue[][];

function toNumber(v: CellValue): number | { error: FormulaError } {
  if (isError(v)) return v;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : { error: "#VALUE!" };
}
const toText = (v: CellValue): string => (v === null ? "" : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : isError(v) ? v.error : String(v));

function matchesCriteria(value: CellValue, criteria: CellValue): boolean {
  const c = toText(criteria);
  const m = /^(<=|>=|<>|<|>|=)?(.*)$/.exec(c)!;
  const op = m[1] ?? "=";
  const target = m[2];
  const targetNum = Number(target);
  const valueNum = typeof value === "number" ? value : Number(value);
  const numeric = target.trim() !== "" && Number.isFinite(targetNum) && value !== null && value !== "" && Number.isFinite(valueNum);
  if (numeric) {
    switch (op) {
      case "=": return valueNum === targetNum;
      case "<>": return valueNum !== targetNum;
      case "<": return valueNum < targetNum;
      case ">": return valueNum > targetNum;
      case "<=": return valueNum <= targetNum;
      case ">=": return valueNum >= targetNum;
    }
  }
  const a = toText(value).trim().toLowerCase();
  const b = target.trim().toLowerCase();
  if (op === "=") return a === b;
  if (op === "<>") return a !== b;
  return false;
}

function flatten(args: Arg[]): CellValue[] {
  return args.flatMap((a) => (Array.isArray(a) ? a.flat() : [a]));
}

function numericValues(args: Arg[]): number[] | { error: FormulaError } {
  const out: number[] = [];
  for (const a of args) {
    if (Array.isArray(a)) {
      for (const v of a.flat()) {
        if (isError(v)) return v;
        if (typeof v === "number") out.push(v);
      }
    } else {
      const n = toNumber(a);
      if (typeof n !== "number") return n;
      out.push(n);
    }
  }
  return out;
}

const round = (x: number, digits: number) => {
  const f = Math.pow(10, digits);
  return Math.sign(x) * Math.round(Math.abs(x) * f) / f;
};

export const SUPPORTED_FUNCTIONS = ["SUM", "AVERAGE", "MIN", "MAX", "COUNT", "COUNTA", "COUNTIF", "SUMIF", "AVERAGEIF", "IF", "ROUND", "ABS", "IFERROR", "AND", "OR", "VLOOKUP"] as const;

export function evaluateSheet(sheet: Sheet): Record<string, CellValue> {
  const cache = new Map<string, CellValue>();
  const inProgress = new Set<string>();

  function literal(raw: string): CellValue {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed.replace(/,/g, ""));
    if (/^-?[\d,]*\.?\d+$/.test(trimmed) && Number.isFinite(n)) return n;
    if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === "true";
    return raw;
  }

  function cell(addr: string): CellValue {
    if (!parseAddress(addr)) return err("#REF!");
    if (cache.has(addr)) return cache.get(addr)!;
    if (inProgress.has(addr)) return err("#CIRC!");
    const raw = sheet[addr] ?? "";
    let value: CellValue;
    if (raw.startsWith("=")) {
      inProgress.add(addr);
      try {
        value = scalar(evalNode(parseFormula(raw.slice(1))));
      } catch {
        value = err("#ERROR!");
      }
      inProgress.delete(addr);
    } else value = literal(raw);
    cache.set(addr, value);
    return value;
  }

  function range(from: string, to: string): CellValue[][] {
    const a = parseAddress(from);
    const b = parseAddress(to);
    if (!a || !b) return [[err("#REF!")]];
    const rows: CellValue[][] = [];
    for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++) {
      const row: CellValue[] = [];
      for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++) row.push(cell(address(c, r)));
      rows.push(row);
    }
    if (rows.length * (rows[0]?.length ?? 0) > 20_000) return [[err("#REF!")]];
    return rows;
  }

  function scalar(v: Arg): CellValue {
    return Array.isArray(v) ? err("#VALUE!") : v;
  }

  function evalNode(n: Node): Arg {
    switch (n.k) {
      case "num": return n.v;
      case "str": return n.v;
      case "bool": return n.v;
      case "ref": return cell(n.addr);
      case "range": return range(n.from, n.to);
      case "percent": {
        const x = toNumber(scalar(evalNode(n.arg)));
        return typeof x === "number" ? x / 100 : x;
      }
      case "unary": {
        const x = toNumber(scalar(evalNode(n.arg)));
        if (typeof x !== "number") return x;
        return n.op === "-" ? -x : x;
      }
      case "bin": {
        const l = scalar(evalNode(n.l));
        const r = scalar(evalNode(n.r));
        if (isError(l)) return l;
        if (isError(r)) return r;
        if (n.op === "&") return toText(l) + toText(r);
        if (["=", "<>", "<", ">", "<=", ">="].includes(n.op)) {
          const bothNum = typeof l === "number" && typeof r === "number";
          const a = bothNum ? l : toText(l).toLowerCase();
          const b = bothNum ? r : toText(r).toLowerCase();
          switch (n.op) {
            case "=": return a === b;
            case "<>": return a !== b;
            case "<": return a < b;
            case ">": return a > b;
            case "<=": return a <= b;
            default: return a >= b;
          }
        }
        const a = toNumber(l);
        const b = toNumber(r);
        if (typeof a !== "number") return a;
        if (typeof b !== "number") return b;
        switch (n.op) {
          case "+": return a + b;
          case "-": return a - b;
          case "*": return a * b;
          case "/": return b === 0 ? err("#DIV/0!") : a / b;
          case "^": return Math.pow(a, b);
        }
        return err("#ERROR!");
      }
      case "call": return call(n.name, n.args);
    }
  }

  function call(name: string, argNodes: Node[]): Arg {
    const args = () => argNodes.map(evalNode);
    switch (name) {
      case "SUM": {
        const v = numericValues(args());
        return Array.isArray(v) ? v.reduce((s, x) => s + x, 0) : v;
      }
      case "AVERAGE": {
        const v = numericValues(args());
        if (!Array.isArray(v)) return v;
        return v.length === 0 ? err("#DIV/0!") : v.reduce((s, x) => s + x, 0) / v.length;
      }
      case "MIN":
      case "MAX": {
        const v = numericValues(args());
        if (!Array.isArray(v)) return v;
        if (v.length === 0) return 0;
        return name === "MIN" ? Math.min(...v) : Math.max(...v);
      }
      case "COUNT": return flatten(args()).filter((v) => typeof v === "number").length;
      case "COUNTA": return flatten(args()).filter((v) => v !== null && v !== "").length;
      case "COUNTIF": {
        if (argNodes.length !== 2) return err("#VALUE!");
        const [rng, crit] = args();
        if (!Array.isArray(rng)) return err("#VALUE!");
        return rng.flat().filter((v) => matchesCriteria(v, scalar(crit))).length;
      }
      case "SUMIF":
      case "AVERAGEIF": {
        if (argNodes.length < 2 || argNodes.length > 3) return err("#VALUE!");
        const [rng, crit, sumRng] = args();
        if (!Array.isArray(rng) || (sumRng !== undefined && !Array.isArray(sumRng))) return err("#VALUE!");
        const target = (sumRng ?? rng) as CellValue[][];
        const flatCrit = rng.flat();
        const flatTarget = target.flat();
        const picked: number[] = [];
        flatCrit.forEach((v, i) => {
          if (matchesCriteria(v, scalar(crit)) && typeof flatTarget[i] === "number") picked.push(flatTarget[i] as number);
        });
        if (name === "SUMIF") return picked.reduce((s, x) => s + x, 0);
        return picked.length === 0 ? err("#DIV/0!") : picked.reduce((s, x) => s + x, 0) / picked.length;
      }
      case "IF": {
        if (argNodes.length < 2 || argNodes.length > 3) return err("#VALUE!");
        const cond = scalar(evalNode(argNodes[0]));
        if (isError(cond)) return cond;
        const truthy = typeof cond === "number" ? cond !== 0 : typeof cond === "string" ? cond !== "" : Boolean(cond);
        if (truthy) return evalNode(argNodes[1]);
        return argNodes[2] ? evalNode(argNodes[2]) : false;
      }
      case "ROUND": {
        if (argNodes.length !== 2) return err("#VALUE!");
        const [x, d] = args().map((a) => toNumber(scalar(a)));
        if (typeof x !== "number") return x;
        if (typeof d !== "number") return d;
        return round(x, d);
      }
      case "ABS": {
        const x = toNumber(scalar(evalNode(argNodes[0])));
        return typeof x === "number" ? Math.abs(x) : x;
      }
      case "IFERROR": {
        if (argNodes.length !== 2) return err("#VALUE!");
        const v = scalar(evalNode(argNodes[0]));
        return isError(v) ? evalNode(argNodes[1]) : v;
      }
      case "AND":
      case "OR": {
        const vals = flatten(args());
        const bools = vals.map((v) => (typeof v === "number" ? v !== 0 : Boolean(v)));
        return name === "AND" ? bools.every(Boolean) : bools.some(Boolean);
      }
      case "VLOOKUP": {
        if (argNodes.length < 3 || argNodes.length > 4) return err("#VALUE!");
        const [needle, table, colIdx, approx] = args();
        if (!Array.isArray(table)) return err("#VALUE!");
        const col = toNumber(scalar(colIdx));
        if (typeof col !== "number" || col < 1 || col > (table[0]?.length ?? 0)) return err("#REF!");
        const exact = approx === undefined || scalar(approx) === false || scalar(approx) === 0;
        if (!exact) return err("#VALUE!"); // approximate-match lookups aren't supported
        const key = toText(scalar(needle)).trim().toLowerCase();
        const row = table.find((r) => toText(r[0]).trim().toLowerCase() === key);
        return row ? row[col - 1] : err("#N/A");
      }
      default:
        return err("#NAME?");
    }
  }

  const out: Record<string, CellValue> = {};
  for (const addr of Object.keys(sheet)) out[addr] = cell(addr);
  return out;
}

/**
 * Pure. Excel fill-down: shifts relative row numbers in a formula by `delta`
 * rows; `$`-anchored rows and anything inside string literals are untouched.
 */
export function shiftFormulaRows(raw: string, delta: number): string {
  if (!raw.startsWith("=")) return raw;
  return raw
    .split(/("(?:[^"]|"")*")/)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(/(\$?)([A-Za-z]{1,3})(\$?)(\d{1,5})(?![A-Za-z0-9_(])/g, (m, colAbs, col, rowAbs, row) => (rowAbs ? m : `${colAbs}${col}${Math.max(1, Number(row) + delta)}`))
    )
    .join("");
}

/** Pure. True when a formula's tree references at least one cell (i.e. it is not a hardcoded constant). */
export function formulaReferencesCells(raw: string): boolean {
  if (!raw.startsWith("=")) return false;
  try {
    const walk = (n: Node): boolean =>
      n.k === "ref" || n.k === "range" ? true : n.k === "bin" ? walk(n.l) || walk(n.r) : n.k === "unary" || n.k === "percent" ? walk(n.arg) : n.k === "call" ? n.args.some(walk) : false;
    return walk(parseFormula(raw.slice(1)));
  } catch {
    return false;
  }
}
