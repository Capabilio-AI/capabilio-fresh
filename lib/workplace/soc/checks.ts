import type { GradeCheck } from "@/lib/arena-workstations/types";
import { SEVERITIES, type AlertAnswer, type AlertKey, type Severity, type SocContent, type SocKey, type SocSubmission } from "./types";

/** citing more than this many lines outside the alert's own chain reads as guessing, not evidence */
export const MAX_NOISE_LINES = 2;

function evidenceOk(key: AlertKey, cited: readonly string[] = []): boolean {
  const set = new Set(cited);
  const related = new Set(key.related);
  const noise = [...set].filter((id) => !related.has(id)).length;
  return key.evidence.every((group) => group.some((id) => set.has(id))) && noise <= MAX_NOISE_LINES;
}

function severityCheck(id: string, expected: Severity, given: string | undefined): GradeCheck {
  const gap = Math.abs(SEVERITIES.indexOf(expected) - SEVERITIES.indexOf(given as Severity));
  if (given && SEVERITIES.includes(given as Severity) && gap === 0) return { label: `${id}: severity`, passed: true };
  // partial: one level off is said, never in which direction
  if (given && SEVERITIES.includes(given as Severity) && gap === 1) return { label: `${id}: severity (close, one level off)`, passed: false };
  return { label: `${id}: severity`, passed: false };
}

function alertChecks(id: string, key: AlertKey, a: AlertAnswer, ask: SocContent["ask"]): GradeCheck[] {
  const malicious = key.disposition === "true_positive";
  const checks: GradeCheck[] = [{ label: `${id}: disposition`, passed: a.disposition === key.disposition }];
  if (ask.includes("severity")) checks.push(severityCheck(id, key.severity, a.severity));
  if (ask.includes("technique") && malicious) checks.push({ label: `${id}: ATT&CK technique`, passed: !!a.technique && key.techniques.includes(a.technique) });
  if (ask.includes("action")) checks.push({ label: `${id}: containment action`, passed: !!a.action && (key.actions as string[]).includes(a.action) });
  if (ask.includes("escalate")) checks.push({ label: `${id}: escalation decision`, passed: a.escalate === key.escalate });
  if (ask.includes("evidence")) checks.push({ label: `${id}: evidence cited`, passed: evidenceOk(key, a.evidence) });
  return checks;
}

/** Pure. One check per asked field per alert, in queue order; never the expected values. */
export function gradeShift(content: SocContent, key: SocKey, submission: SocSubmission): GradeCheck[] {
  return content.alerts.flatMap((alert) => {
    const k = key.alerts[alert.id];
    return k ? alertChecks(alert.id, k, submission.alerts[alert.id] ?? {}, content.ask) : [];
  });
}

/** The answer that passes every check: used by the tests to prove each ticket is fair. */
export function solutionFor(key: SocKey): SocSubmission {
  return {
    alerts: Object.fromEntries(
      Object.entries(key.alerts).map(([id, k]) => [id, { disposition: k.disposition, severity: k.severity, technique: k.techniques[0], action: k.actions[0], escalate: k.escalate, evidence: k.evidence.map((g) => g[0]) }]),
    ),
    note: "Reviewed each alert against the logs and the runbook.",
  };
}
