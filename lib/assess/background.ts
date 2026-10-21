import { after } from "next/server";

/**
 * Runs work after the response has gone out. On serverless a bare `void promise` can be frozen the moment the response returns, so
 * warm-ups never finish; `after` keeps the function alive for them. Outside a request (scripts, tests) it just runs.
 */
export function inBackground(task: () => Promise<unknown>): void {
  const run = () => task().catch((e) => console.error("[assess] background task failed:", e));
  try {
    after(run);
  } catch {
    void run();
  }
}
