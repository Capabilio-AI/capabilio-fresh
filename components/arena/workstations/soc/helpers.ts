import { LOG_SOURCES, TECHNIQUES, type AlertAnswer, type LogLine, type LogSource, type SocField } from "@/lib/workplace/soc/types";

/** Pure view helpers for the SOC console. Nothing here knows or derives a verdict: it only filters, counts and groups what the page already holds. */

export interface LogFilter {
  query: string;
  source: string;
  host: string;
  user: string;
  /** seconds-of-day range from a timeline bucket, inclusive start, exclusive end */
  range?: { from: number; to: number } | null;
}

export const EMPTY_FILTER: LogFilter = { query: "", source: "", host: "", user: "", range: null };

/** Seconds into the day of an ISO timestamp such as 2026-10-12T09:14:03+05:30 (read as written, no timezone maths). */
export function secOfDay(ts: string): number {
  return Number(ts.slice(11, 13)) * 3600 + Number(ts.slice(14, 16)) * 60 + Number(ts.slice(17, 19) || 0);
}

export const searchTerms = (query: string): string[] => query.toLowerCase().split(/\s+/).filter(Boolean);

/** All search words must appear somewhere in the line; source/host/user/time-range narrow it further. */
export function filterLogs(logs: readonly LogLine[], f: LogFilter): LogLine[] {
  const terms = searchTerms(f.query);
  const host = f.host.trim().toLowerCase();
  const user = f.user.trim().toLowerCase();
  return logs.filter((l) => {
    if (f.source && l.source !== f.source) return false;
    if (host && !l.host.toLowerCase().includes(host)) return false;
    if (user && !l.user.toLowerCase().includes(user)) return false;
    if (f.range) {
      const s = secOfDay(l.ts);
      if (s < f.range.from || s >= f.range.to) return false;
    }
    if (!terms.length) return true;
    const hay = `${l.id} ${l.ts} ${l.source} ${l.host} ${l.user} ${l.event} ${l.detail}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

export interface Segment {
  text: string;
  hit: boolean;
}

/** Splits text into plain and matching runs for highlighting (case-insensitive, any of the terms). */
export function highlightSegments(text: string, terms: readonly string[]): Segment[] {
  if (!terms.length || !text) return [{ text, hit: false }];
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length);
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  return text
    .split(re)
    .filter((s) => s !== "")
    .map((s) => ({ text: s, hit: terms.includes(s.toLowerCase()) }));
}

export interface Bucket {
  from: number;
  to: number;
  total: number;
  bySource: Record<LogSource, number>;
}

const emptyBySource = (): Record<LogSource, number> => Object.fromEntries(LOG_SOURCES.map((s) => [s, 0])) as Record<LogSource, number>;

/** Histogram of events per equal time bucket across [from, to). Lines outside the span are ignored. */
export function bucketHistogram(logs: readonly LogLine[], span: { from: number; to: number }, count: number): Bucket[] {
  const n = Math.max(1, Math.floor(count));
  const width = Math.max(1, (span.to - span.from) / n);
  const buckets: Bucket[] = Array.from({ length: n }, (_, i) => ({ from: span.from + i * width, to: span.from + (i + 1) * width, total: 0, bySource: emptyBySource() }));
  for (const l of logs) {
    const s = secOfDay(l.ts);
    if (s < span.from || s >= span.to) continue;
    const b = buckets[Math.min(n - 1, Math.floor((s - span.from) / width))];
    b.total += 1;
    b.bySource[l.source] += 1;
  }
  return buckets;
}

/** The shift's time span, rounded out to whole minutes so the last line falls inside the final bucket. */
export function shiftSpan(logs: readonly LogLine[]): { from: number; to: number } {
  if (!logs.length) return { from: 0, to: 60 };
  const secs = logs.map((l) => secOfDay(l.ts));
  return { from: Math.floor(Math.min(...secs) / 60) * 60, to: Math.floor(Math.max(...secs) / 60) * 60 + 60 };
}

export const hhmm = (sec: number): string => `${String(Math.floor(sec / 3600) % 24).padStart(2, "0")}:${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}`;

/** How many of the asked decisions are filled in for one alert. */
export function decisionProgress(answer: AlertAnswer | undefined, ask: readonly SocField[]): { done: number; total: number } {
  const a = answer ?? {};
  const filled: Record<SocField, boolean> = {
    disposition: !!a.disposition,
    severity: !!a.severity,
    technique: !!a.technique,
    action: !!a.action,
    escalate: typeof a.escalate === "boolean",
    evidence: (a.evidence?.length ?? 0) > 0,
  };
  return { done: ask.filter((f) => filled[f]).length, total: ask.length };
}

/** Distinct sorted values of a log field, for the host/user suggestions. */
export const distinct = (logs: readonly LogLine[], key: "host" | "user"): string[] => [...new Set(logs.map((l) => l[key]).filter(Boolean))].sort();

/** ATT&CK tactic for each technique in the local subset (public mapping; a technique can span tactics, the primary one is used). */
const TACTIC_OF: Record<string, string> = {
  T1566: "Initial Access",
  T1078: "Initial Access",
  T1204: "Execution",
  T1059: "Execution",
  T1053: "Persistence",
  T1547: "Persistence",
  T1110: "Credential Access",
  T1046: "Discovery",
  T1021: "Lateral Movement",
  T1071: "Command and Control",
  T1048: "Exfiltration",
};
const TACTIC_ORDER = ["Initial Access", "Execution", "Persistence", "Credential Access", "Discovery", "Lateral Movement", "Command and Control", "Exfiltration", "Other"];

export function techniquesByTactic(): { tactic: string; items: { id: string; name: string }[] }[] {
  const groups = new Map<string, { id: string; name: string }[]>();
  for (const t of TECHNIQUES) {
    const tactic = TACTIC_OF[t.id.split(".")[0]] ?? "Other";
    groups.set(tactic, [...(groups.get(tactic) ?? []), t]);
  }
  return TACTIC_ORDER.filter((t) => groups.has(t)).map((tactic) => ({ tactic, items: groups.get(tactic)! }));
}
