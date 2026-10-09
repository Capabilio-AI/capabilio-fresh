import { LlmError } from "./types";

/** Process-wide queue: a burst of pool top-ups must not stampede the provider's rate limit. */
export class Limiter {
  private active = 0;
  private waiting: Array<() => void> = [];
  constructor(private readonly max: number) {}
  async run<T>(job: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active++;
    try {
      return await job();
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }
}

export interface Backoff {
  random: () => number;
  baseDelayMs: number;
  maxDelayMs: number;
}

/** "Equal jitter" exponential backoff in [exp/2, exp], never below a server-sent Retry-After. */
export function backoffDelay(attempt: number, error: LlmError, b: Backoff): number {
  const exp = Math.min(b.maxDelayMs, b.baseDelayMs * 2 ** attempt);
  // honour Retry-After, but never sit silent for minutes: past the cap the caller is better off failing over or surfacing the error
  return Math.max(Math.round(exp / 2 + b.random() * (exp / 2)), Math.min(error.retryAfterMs ?? 0, b.maxDelayMs * 2));
}
