/** Tiny, safe calculator for the worksheet: + - * / ^, parentheses, unary minus, pi, e, and sqrt/sin/cos/tan/ln/log/abs (radians). No eval. */
const FUNCTIONS: Record<string, (x: number) => number> = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, ln: Math.log, log: Math.log10, abs: Math.abs };
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

export type CalcResult = { ok: true; value: number } | { ok: false; error: string };

export function evaluateExpression(input: string): CalcResult {
  const tokens = input.replace(/,/g, "").toLowerCase().match(/\d+\.?\d*(?:e[-+]?\d+)?|\.\d+|[a-z]+|[-+*/^()]|\S/g) ?? [];
  let pos = 0;
  const peek = () => tokens[pos];
  const fail = (message: string): never => {
    throw new Error(message);
  };

  function primary(): number {
    const t = tokens[pos++];
    if (t === undefined) return fail("Expression ends early.");
    if (/^[\d.]/.test(t)) {
      const n = Number(t);
      return Number.isFinite(n) ? n : fail(`"${t}" is not a number.`);
    }
    if (t === "(") {
      const v = additive();
      if (tokens[pos++] !== ")") fail("Missing ).");
      return v;
    }
    if (t in CONSTANTS) return CONSTANTS[t];
    if (t in FUNCTIONS) {
      if (tokens[pos++] !== "(") fail(`${t} needs ( ).`);
      const v = additive();
      if (tokens[pos++] !== ")") fail("Missing ).");
      return FUNCTIONS[t](v);
    }
    return fail(`Unexpected "${t}".`);
  }
  function unary(): number {
    if (peek() === "-") {
      pos++;
      return -unary();
    }
    if (peek() === "+") {
      pos++;
      return unary();
    }
    return power();
  }
  function power(): number {
    const base = primary();
    if (peek() === "^") {
      pos++;
      return Math.pow(base, unary()); // right-associative, allows 2^-1
    }
    return base;
  }
  function multiplicative(): number {
    let v = unary();
    while (peek() === "*" || peek() === "/") v = tokens[pos++] === "*" ? v * unary() : v / unary();
    return v;
  }
  function additive(): number {
    let v = multiplicative();
    while (peek() === "+" || peek() === "-") v = tokens[pos++] === "+" ? v + multiplicative() : v - multiplicative();
    return v;
  }

  try {
    if (tokens.length === 0) return { ok: false, error: "Type an expression." };
    const value = additive();
    if (pos < tokens.length) fail(`Unexpected "${tokens[pos]}".`);
    return Number.isFinite(value) ? { ok: true, value } : { ok: false, error: "That doesn't give a finite number." };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
