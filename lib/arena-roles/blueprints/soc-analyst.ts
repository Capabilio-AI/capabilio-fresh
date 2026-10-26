import type { RoleBlueprint } from "../blueprint";

/**
 * IT-11 SOC Analyst. Mirrors supabase/migrations/134_soc_analyst_role.sql, which is NOT yet applied to production.
 *
 * What this role really assesses: L1 decisions on a simulated shift (tools/soc.ts). The shift -- alert queue and synthetic logs -- is generated from a
 * seed; the student searches it in the browser and submits, per alert, a disposition, severity, ATT&CK technique, containment action, escalation and the
 * log lines that prove it. The server derives the answer key from the same seed. It is not a live SIEM, EDR or network.
 */
const SOC = { toolType: "soc_workspace", generationVersion: "soc.gen.v1", gradingVersion: "soc.grade.v1", executionMode: "computed-key", status: "enabled" } as const;

export const SOC_ANALYST: RoleBlueprint = {
  roleId: "IT-11",
  domainRoleKey: "soc-analyst",
  name: "SOC Analyst",
  competencies: [
    { id: "soc.triage", label: "Alert triage: true positive, false positive or authorised activity" },
    { id: "soc.severity", label: "Severity and escalation by a stated runbook" },
    { id: "soc.logs", label: "Log search and citing the lines that prove a verdict" },
    { id: "soc.correlation", label: "Correlating events across auth, proxy, DNS, endpoint, firewall and email logs" },
    { id: "soc.attack", label: "Mapping confirmed activity to MITRE ATT&CK techniques" },
    { id: "soc.containment", label: "Choosing the containment action for an incident" },
    { id: "soc.phishing", label: "Following a phishing email through click, download and execution" },
  ],
  unassessed: [
    { id: "soc.reporting", label: "Writing the incident report (the findings note is kept for the interview, not graded)" },
    { id: "soc.detection", label: "Writing or tuning detection rules and SIEM queries" },
    { id: "soc.tools", label: "Operating a real SIEM, EDR, packet capture or threat-intel platform" },
    { id: "soc.forensics", label: "Host or memory forensics and malware analysis" },
  ],
  areas: [
    { areaKey: "alert-triage", ...SOC, competencies: ["soc.triage", "soc.severity"] },
    { areaKey: "log-investigation", ...SOC, competencies: ["soc.logs", "soc.correlation", "soc.triage"] },
    { areaKey: "threat-mapping", ...SOC, competencies: ["soc.attack", "soc.triage"] },
    { areaKey: "incident-response", ...SOC, competencies: ["soc.containment", "soc.severity", "soc.triage"] },
    { areaKey: "phishing-analysis", ...SOC, competencies: ["soc.phishing", "soc.logs", "soc.attack", "soc.containment"] },
  ],
  limitations: [
    "Every shift is a deterministic simulation over synthetic logs from six scenario families. It models how the evidence looks, not a live SIEM, EDR or network, and no real attack is run.",
    "Decisions are picked from fixed lists (dispositions, severities, a local subset of ATT&CK, five containment actions), so the role checks judgement against stated rules, not free-form analysis.",
    "Severity, escalation and containment follow the runbook shown with every ticket; a real team's policy may differ.",
    "The findings note is not graded; the explain-your-work interview is the only check that the student can explain the verdict.",
    "Hard difficulty serves the easy and medium tickets: there are no hard SOC tickets yet (lateral movement, multi-stage chains).",
  ],
};
