import type { Cell, Dataset } from "./dataset";

/**
 * A small, pure evaluator for the DAX an analyst writes in their first year: SUM / AVERAGE / COUNTROWS / DISTINCTCOUNT, DIVIDE, CALCULATE with column
 * filters, ALL, IF, and the SUMX / AVERAGEX iterators. It follows DAX's filter-context rule, which is what makes DAX hard: the chart gives each bar a
 * filter (its axis value plus the visual's filters), CALCULATE replaces the filter on any column it names, and ALL clears filters. There is no eval and
 * no host access: the formula is parsed into a tree of the few node kinds below and interpreted.
 */

export class DaxError extends Error {}

const MAX_LENGTH = 400;
const MAX_DEPTH = 24;

type Value = number | string | boolean | null;

type Node =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "col"; name: string }
  | { t: "call"; fn: string; args: Node[] }
  | { t: "bin"; op: string; l: Node; r: Node }
  | { t: "neg"; e: Node }
  | { t: "id"; name: string };

// ── tokens ───────────────────────────────────────────────────────────────────
type Tok = { k: "num" | "str" | "col" | "id" | "op" | "end"; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) i++;
    else if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      const m = /^\d*\.?\d+(?:[eE][+-]?\d+)?/.exec(src.slice(i))!;
      out.push({ k: "num", v: m[0] });
      i += m[0].length;
    } else if (c === '"') {
      let j = i + 1;
      let s = "";
      while (j < src.length && !(src[j] === '"' && src[j + 1] !== '"')) {
        if (src[j] === '"') j++;
        s += src[j++];
      }
      if (j >= src.length) throw new DaxError("A text value is missing its closing quote.");
      out.push({ k: "str", v: s });
      i = j + 1;
    } else if (c === "[") {
      const j = src.indexOf("]", i);
      if (j === -1) throw new DaxError("A column name is missing its closing ].");
      out.push({ k: "col", v: src.slice(i + 1, j).trim() });
      i = j + 1;
    } else if (/[A-Za-z_']/.test(c)) {
      const m = /^(?:'[^']*'|[A-Za-z_][A-Za-z0-9_]*)/.exec(src.slice(i));
      if (!m) throw new DaxError(`Unexpected character ${c}.`);
      out.push({ k: "id", v: m[0].replace(/^'|'$/g, "") });
      i += m[0].length;
    } else {
      const two = src.slice(i, i + 2);
      if (["<>", "<=", ">=", "&&", "||"].includes(two)) {
        out.push({ k: "op", v: two });
        i += 2;
      } else if ("+-*/(),=<>".includes(c)) {
        out.push({ k: "op", v: c });
        i++;
      } else throw new DaxError(`Unexpected character ${c}.`);
    }
  }
  out.push({ k: "end", v: "" });
  return out;
}

// ── parser (precedence climbing) ─────────────────────────────────────────────
const BINARY: [string[], number][] = [[["||"], 1], [["&&"], 2], [["=", "<>", "<", "<=", ">", ">="], 3], [["+", "-"], 4], [["*", "/"], 5]];
const precedence = (op: string) => BINARY.find(([ops]) => ops.includes(op))?.[1] ?? 0;

class Parser {
  private p = 0;
  constructor(private readonly toks: Tok[]) {}
  private get cur() {
    return this.toks[this.p];
  }
  private isOp(v: string): boolean {
    return this.cur.k === "op" && this.cur.v === v;
  }
  private take(): Tok {
    return this.toks[this.p++];
  }
  private expectOp(v: string) {
    if (this.cur.k !== "op" || this.cur.v !== v) throw new DaxError(`Expected "${v}" here.`);
    this.p++;
  }

  parse(): Node {
    const n = this.expr(1, 0);
    if (this.cur.k !== "end") throw new DaxError(`Unexpected "${this.cur.v}" after the end of the formula.`);
    return n;
  }

  private expr(min: number, depth: number): Node {
    if (depth > MAX_DEPTH) throw new DaxError("That formula is nested too deeply.");
    let left = this.unary(depth);
    while (this.cur.k === "op" && precedence(this.cur.v) >= min) {
      const op = this.take().v;
      const right = this.expr(precedence(op) + 1, depth + 1);
      left = { t: "bin", op, l: left, r: right };
    }
    return left;
  }

  private unary(depth: number): Node {
    if (this.cur.k === "op" && this.cur.v === "-") {
      this.take();
      return { t: "neg", e: this.unary(depth + 1) };
    }
    return this.primary(depth);
  }

  private primary(depth: number): Node {
    const t = this.take();
    if (t.k === "num") return { t: "num", v: Number(t.v) };
    if (t.k === "str") return { t: "str", v: t.v };
    if (t.k === "col") return { t: "col", name: t.v };
    if (t.k === "op" && t.v === "(") {
      const e = this.expr(1, depth + 1);
      this.expectOp(")");
      return e;
    }
    if (t.k === "id") {
      if (this.cur.k === "col") return { t: "col", name: this.take().v }; // Table[column]
      if (this.isOp("(")) {
        this.take();
        const args: Node[] = [];
        if (!this.isOp(")")) {
          for (;;) {
            args.push(this.expr(1, depth + 1));
            if (this.isOp(",")) this.take();
            else break;
          }
        }
        this.expectOp(")");
        return { t: "call", fn: t.v.toUpperCase(), args };
      }
      return { t: "id", name: t.v };
    }
    throw new DaxError(t.k === "end" ? "The formula ends too early." : `Unexpected "${t.v}".`);
  }
}

export function parseDax(src: string): Node {
  if (src.trim() === "") throw new DaxError("Type a formula, for example SUM([revenue]).");
  if (src.length > MAX_LENGTH) throw new DaxError(`Formulas are limited to ${MAX_LENGTH} characters here.`);
  return new Parser(tokenize(src)).parse();
}

// ── evaluation ───────────────────────────────────────────────────────────────
/** One filter in the context: it constrains the columns it names; a new filter on any of those columns replaces it. */
export interface ContextFilter {
  columns: ReadonlySet<string>;
  test: (row: readonly Cell[]) => boolean;
}

interface Env {
  ds: Dataset;
  filters: readonly ContextFilter[];
  /** the row being iterated by SUMX / AVERAGEX, or evaluating a CALCULATE filter */
  row: readonly Cell[] | null;
}

const colIndex = (ds: Dataset, name: string): number => {
  const i = ds.columns.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());
  if (i === -1) throw new DaxError(`There is no column named [${name}]. Columns: ${ds.columns.map((c) => c.name).join(", ")}.`);
  return i;
};

const visibleRows = (env: Env) => env.ds.rows.filter((r) => env.filters.every((f) => f.test(r)));
const num = (v: Value): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "boolean" ? (v ? 1 : 0) : null);

function columnOf(node: Node, ds: Dataset): number {
  if (node.t !== "col") throw new DaxError("This function needs a column, written like [revenue].");
  return colIndex(ds, node.name);
}

function evalNode(n: Node, env: Env): Value {
  switch (n.t) {
    case "num":
    case "str":
      return n.v;
    case "id":
      if (n.name.toUpperCase() === "TRUE") return true;
      if (n.name.toUpperCase() === "FALSE") return false;
      if (n.name.toUpperCase() === "BLANK") return null;
      throw new DaxError(`"${n.name}" is not something a measure can use here.`);
    case "col": {
      if (!env.row) throw new DaxError(`[${n.name}] on its own has no row to read. Wrap it in SUM( ), AVERAGE( ) or another aggregation.`);
      return (env.row[colIndex(env.ds, n.name)] ?? null) as Value;
    }
    case "neg": {
      const v = num(evalNode(n.e, env));
      return v === null ? null : -v;
    }
    case "bin":
      return evalBinary(n, env);
    case "call":
      return evalCall(n.fn, n.args, env);
  }
}

function evalBinary(n: Extract<Node, { t: "bin" }>, env: Env): Value {
  const l = evalNode(n.l, env);
  const r = evalNode(n.r, env);
  switch (n.op) {
    case "+": case "-": case "*": case "/": {
      const a = num(l) ?? 0; // DAX treats a blank as 0 in arithmetic
      const b = num(r) ?? 0;
      if (n.op === "+") return a + b;
      if (n.op === "-") return a - b;
      if (n.op === "*") return a * b;
      if (b === 0) throw new DaxError("That divides by zero. Use DIVIDE(a, b), which returns blank instead.");
      return a / b;
    }
    case "&&": return l === true && r === true;
    case "||": return l === true || r === true;
    default: {
      if (l === null || r === null) return false;
      const both = typeof l === "number" && typeof r === "number";
      const a = both ? l : String(l).toLowerCase();
      const b = both ? r : String(r).toLowerCase();
      if (n.op === "=") return a === b;
      if (n.op === "<>") return a !== b;
      if (n.op === "<") return a < b;
      if (n.op === "<=") return a <= b;
      if (n.op === ">") return a > b;
      return a >= b;
    }
  }
}

/** The columns a boolean filter expression mentions: the filters on those columns are the ones CALCULATE replaces. */
function mentioned(n: Node, out: Set<string>) {
  if (n.t === "col") out.add(n.name.toLowerCase());
  else if (n.t === "bin") {
    mentioned(n.l, out);
    mentioned(n.r, out);
  } else if (n.t === "neg") mentioned(n.e, out);
  else if (n.t === "call") n.args.forEach((a) => mentioned(a, out));
}

function evalCalculate(args: Node[], env: Env): Value {
  if (args.length < 1) throw new DaxError("CALCULATE needs an expression, then its filters.");
  let filters = [...env.filters];
  for (const f of args.slice(1)) {
    if (f.t === "call" && f.fn === "ALL") {
      if (f.args.length === 0) filters = [];
      else {
        const drop = new Set(f.args.map((a) => columnOf(a, env.ds)).map((i) => env.ds.columns[i].name.toLowerCase()));
        filters = filters.filter((x) => ![...x.columns].some((c) => drop.has(c)));
      }
      continue;
    }
    const cols = new Set<string>();
    mentioned(f, cols);
    if (cols.size === 0) throw new DaxError("A CALCULATE filter must test a column, for example [status] = \"delivered\".");
    cols.forEach((c) => colIndex(env.ds, c));
    filters = filters.filter((x) => ![...x.columns].some((c) => cols.has(c)));
    filters.push({ columns: cols, test: (row) => evalNode(f, { ...env, filters: [], row }) === true });
  }
  return evalNode(args[0], { ...env, filters });
}

function evalCall(fn: string, args: Node[], env: Env): Value {
  const rows = () => visibleRows(env);
  const exactly = (k: number) => {
    if (args.length !== k) throw new DaxError(`${fn} takes ${k} argument${k === 1 ? "" : "s"}.`);
  };
  switch (fn) {
    case "CALCULATE": return evalCalculate(args, env);
    case "SUM": case "AVERAGE": case "MIN": case "MAX": {
      exactly(1);
      const i = columnOf(args[0], env.ds);
      if (env.ds.columns[i].type !== "number") throw new DaxError(`${fn} needs a number column, and [${env.ds.columns[i].name}] is ${env.ds.columns[i].type}.`);
      const xs = rows().map((r) => r[i]).filter((v): v is number => typeof v === "number");
      if (xs.length === 0) return null;
      if (fn === "SUM") return xs.reduce((s, x) => s + x, 0);
      if (fn === "AVERAGE") return xs.reduce((s, x) => s + x, 0) / xs.length;
      return fn === "MIN" ? Math.min(...xs) : Math.max(...xs);
    }
    case "COUNT": {
      exactly(1);
      const i = columnOf(args[0], env.ds);
      return rows().filter((r) => r[i] !== null && r[i] !== "").length;
    }
    case "COUNTROWS": return rows().length;
    case "DISTINCTCOUNT": {
      exactly(1);
      const i = columnOf(args[0], env.ds);
      return new Set(rows().map((r) => r[i]).filter((v) => v !== null && v !== "")).size;
    }
    case "DIVIDE": {
      if (args.length < 2 || args.length > 3) throw new DaxError("DIVIDE takes a numerator, a denominator and an optional value for when the denominator is 0.");
      const a = num(evalNode(args[0], env));
      const b = num(evalNode(args[1], env));
      if (a === null || b === null || b === 0) return args[2] ? evalNode(args[2], env) : null;
      return a / b;
    }
    case "IF": {
      if (args.length < 2 || args.length > 3) throw new DaxError("IF takes a test, a value if true and an optional value if false.");
      return evalNode(args[0], env) === true ? evalNode(args[1], env) : args[2] ? evalNode(args[2], env) : null;
    }
    case "ROUND": {
      exactly(2);
      const v = num(evalNode(args[0], env));
      const d = num(evalNode(args[1], env)) ?? 0;
      return v === null ? null : Math.round(v * 10 ** d) / 10 ** d;
    }
    case "ABS": {
      exactly(1);
      const v = num(evalNode(args[0], env));
      return v === null ? null : Math.abs(v);
    }
    case "SUMX": case "AVERAGEX": {
      exactly(2);
      if (args[0].t !== "id" && args[0].t !== "col") throw new DaxError(`${fn} starts with the table name, then the expression to work out for each row.`);
      const vals = rows().map((r) => num(evalNode(args[1], { ...env, row: r }))).filter((v): v is number => v !== null);
      if (vals.length === 0) return null;
      const sum = vals.reduce((s, x) => s + x, 0);
      return fn === "SUMX" ? sum : sum / vals.length;
    }
    case "ALL": throw new DaxError("ALL( ) belongs inside CALCULATE, for example CALCULATE(SUM([revenue]), ALL()).");
    default: throw new DaxError(`${fn} is not available in this builder. You can use: SUM, AVERAGE, MIN, MAX, COUNT, COUNTROWS, DISTINCTCOUNT, DIVIDE, CALCULATE, ALL, IF, ROUND, ABS, SUMX, AVERAGEX.`);
  }
}

/** Evaluates a measure for one filter context. Returns null for a blank result; throws DaxError with a message a learner can act on. */
export function evaluateMeasure(ds: Dataset, formula: string, filters: readonly ContextFilter[]): number | null {
  const v = evalNode(parseDax(formula), { ds, filters, row: null });
  if (v === null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  throw new DaxError("A measure has to work out to a number.");
}
