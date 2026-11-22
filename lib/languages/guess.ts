/** Languages whose lesson examples can be run in the page and compared with a guess (not pages, SQL or C#). */
const GUESSABLE = ["python", "javascript", "c", "cpp", "java"] as const;

/** Pure. Whether an example is a good "guess the output" task: it runs, and it does not wait for the student to type input. */
export function canGuess(language: string | null, code: string): boolean {
  if (!language || !(GUESSABLE as readonly string[]).includes(language)) return false;
  const asksForInput = language === "python" ? /\binput\s*\(/.test(code) : language === "javascript" ? /\bprompt\s*\(|readline|process\.stdin/.test(code) : language === "java" ? /\bScanner\b|System\.in|BufferedReader/.test(code) : /\bscanf\s*\(|\bgets\s*\(|\bfgets\s*\(|\bcin\b|\bgetchar\s*\(/.test(code);
  return !asksForInput;
}

const lines = (s: string) => s.replace(/\r/g, "").split("\n").map((l) => l.trim().replace(/\s+/g, " "));

/** Pure. Whether a guess matches what the program printed. Extra spaces and blank lines at the ends do not count; the words and numbers must be the same. */
export function sameOutput(guess: string, actual: string): boolean {
  const a = lines(guess).join("\n").trim();
  const b = lines(actual).join("\n").trim();
  return a.length > 0 && a === b;
}
