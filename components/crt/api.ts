/** One door to the CRT endpoint. Throws an Error whose message is safe to show the student. */
export async function crtPost<T>(body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api/crt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("You seem to be offline. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => null)) as ({ error?: string } & T) | null;
  if (!res.ok || !json) throw new Error(json?.error ?? "Something went wrong. Please try again.");
  return json;
}

/** "12 Dec, 10:00 am" in India time, for a date and time the placement cell set. */
export const formatWhen = (iso: string): string => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

export const formatClock = (totalSeconds: number): string => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};
