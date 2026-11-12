import type { Rng } from "../rng";
import { problem } from "../application-developer/code-problems";

/**
 * Cloud and Platform Support Engineer tickets for the shared code workstation: reading service logs the way a support engineer does when a customer
 * reports an outage. The student's function runs in their browser; the server compares what it returned with the answers below.
 */
const CAST = {
  oncall: { name: "Karthik Menon", title: "Site Reliability Lead" },
  support: { name: "Farah Sheikh", title: "Customer Support Lead" },
};

const LEVELS = ["INFO", "WARN", "ERROR"] as const;
const parse = (line: string) => {
  const m = /^(\S+) (INFO|WARN|ERROR|DEBUG) (\S+) (.*)$/.exec(line);
  return m ? { level: m[2], service: m[3] } : null;
};

const countByLevel = (lines: string[]) => {
  const counts: Record<string, number> = { INFO: 0, WARN: 0, ERROR: 0 };
  for (const line of lines) {
    const p = parse(line);
    if (p && (LEVELS as readonly string[]).includes(p.level)) counts[p.level]++;
  }
  return counts;
};

const noisyServices = (lines: string[], threshold: number) => {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const p = parse(line);
    if (p?.level === "ERROR") counts.set(p.service, (counts.get(p.service) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n >= threshold).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
};

const SERVICES = ["payments", "auth", "search", "billing", "gateway"];
const MESSAGES = ["timeout calling upstream", "request completed", "cache miss", "connection reset", "retrying in 2s", "started"];
const logCase = (rng: Rng): string[] =>
  Array.from({ length: rng.int(3, 12) }, (_, i) => {
    if (rng.chance(0.08)) return rng.pick(["", "--- restart ---", "garbled line without a level"]);
    const stamp = `2026-03-01T10:${String(i).padStart(2, "0")}:00Z`;
    return `${stamp} ${rng.weighted([["INFO", 5], ["WARN", 2], ["ERROR", 4], ["DEBUG", 2]])} ${rng.pick(SERVICES)} ${rng.pick(MESSAGES)}`;
  });

export const CLOUD_SUPPORT_CODE_PROBLEMS = [
  problem({
    id: "cps-count-by-level", area: "cps-log-triage", difficulty: "easy", minLevel: "fresher", fn: "count_by_level", params: ["lines"], requester: CAST.support,
    title: "How bad is the customer's log? Count lines by level",
    scenario: "Hi, a customer sent us a log file and says 'it is full of errors'. Before an engineer reads it, please give me the counts of INFO, WARN and ERROR lines so I can tell whether that is true. Each line looks like '2026-03-01T10:00:00Z ERROR payments timeout calling upstream'.",
    deliverable: "Write count_by_level(lines) returning an object with exactly the keys INFO, WARN and ERROR and how many lines have each level (the second word of the line). DEBUG lines, blank lines and lines that do not follow the format are not counted.",
    tags: ["Log analysis", "Parsing", "Support"],
    cases: (rng) => [[[]], [["2026-03-01T10:00:00Z ERROR payments timeout"]], [["2026-03-01T10:00:00Z DEBUG auth ok", "", "garbled", "2026-03-01T10:01:00Z WARN auth slow"]], ...Array.from({ length: 7 }, () => [logCase(rng)])],
    solve: countByLevel as never,
  }),
  problem({
    id: "cps-noisy-services", area: "cps-log-triage", difficulty: "medium", minLevel: "fresher", fn: "noisy_services", params: ["lines", "threshold"], requester: CAST.oncall,
    title: "Which services are failing the most?",
    scenario: "Hello, a customer's whole platform is slow and the log mixes a dozen services. I want to look at the services that are actually failing first, not read the log from the top. A service is the third word of each line.",
    deliverable: "Write noisy_services(lines, threshold): count the ERROR lines of each service (format '<timestamp> <LEVEL> <service> <message>') and return a list of [service, count] pairs for the services with at least threshold errors, the most errors first and ties in alphabetical order of service. Lines of other levels and lines that do not follow the format are ignored.",
    tags: ["Log analysis", "Aggregation", "Incident triage"],
    cases: (rng) => [[[], 1], [["2026-03-01T10:00:00Z ERROR b x", "2026-03-01T10:01:00Z ERROR a x", "2026-03-01T10:02:00Z ERROR b x"], 1], [["2026-03-01T10:00:00Z ERROR a x", "2026-03-01T10:01:00Z WARN a x"], 2], [["2026-03-01T10:00:00Z ERROR z x", "2026-03-01T10:01:00Z ERROR a x"], 1], ...Array.from({ length: 6 }, () => [logCase(rng), rng.int(1, 3)])],
    solve: noisyServices as never,
  }),
];
