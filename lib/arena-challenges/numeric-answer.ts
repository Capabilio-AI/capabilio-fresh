const RELATIVE_TOLERANCE = 0.01;
const ABSOLUTE_TOLERANCE = 1e-9;

/** Pure. Reads the leading number from a student's answer ("1,250", "12.5 N", "1.2e3"); null if there isn't one. */
export function parseNumericAnswer(input: string): number | null {
  const match = input.replace(/,/g, "").trim().match(/^[-+]?(\d+(\.\d*)?|\.\d+)(e[-+]?\d+)?/i);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

/** Pure. Within 1% of the expected value — tolerates reasonable rounding in hand calculations. */
export function isNumericAnswerCorrect(submitted: string, expected: string): boolean {
  const got = parseNumericAnswer(submitted);
  const want = parseNumericAnswer(expected);
  if (got === null || want === null) return false;
  return Math.abs(got - want) <= Math.max(ABSOLUTE_TOLERANCE, Math.abs(want) * RELATIVE_TOLERANCE);
}
