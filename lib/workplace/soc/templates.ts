import type { SocTemplate } from "./types";

const LEAD = { name: "Deepa Raghavan", title: "SOC Lead (L2)" };
const MANAGER = { name: "Imran Sheikh", title: "Security Operations Manager" };

/**
 * One template per (area, difficulty). Each picks the incident families in its queue and the fields the analyst must decide; the shift itself (company,
 * people, timings, log lines) comes from the seed. Every area has a fresher-level easy ticket.
 */
export const SOC_TEMPLATES: readonly SocTemplate[] = [
  {
    id: "triage-first-shift", title: "First shift: triage two login alerts", areas: ["alert-triage"], difficulty: "easy", minLevel: "fresher",
    families: ["brute_force", "impossible_travel"], ask: ["disposition", "severity", "escalate"], requester: LEAD,
    scenario: "Welcome to the queue. Two identity alerts fired this morning. Decide which one is real, how bad it is under our runbook, and whether it comes to me. Use the logs and the asset list, not your gut.",
    skillTags: ["alert triage", "authentication logs"],
  },
  {
    id: "triage-mixed-queue", title: "Triage a mixed queue of three alerts", areas: ["alert-triage"], difficulty: "medium", minLevel: "fresher",
    families: ["phishing_macro", "port_scan", "beacon"], ask: ["disposition", "severity", "escalate"], requester: LEAD,
    scenario: "Three alerts from three different tools are waiting. At least one of them is noise from something we run ourselves. Triage all three: verdict, severity and escalation, as the runbook says.",
    skillTags: ["alert triage", "endpoint", "proxy"],
  },
  {
    id: "logs-brute-force", title: "Prove a login alert from the auth logs", areas: ["log-investigation"], difficulty: "easy", minLevel: "fresher",
    families: ["brute_force"], ask: ["disposition", "evidence"], requester: LEAD,
    scenario: "A failed-then-successful login alert fired. Before anyone acts, I want it proven from the logs: give your verdict and cite the exact log lines that show it.",
    skillTags: ["log search", "authentication logs"],
  },
  {
    id: "logs-dns-and-travel", title: "Find the evidence behind two alerts", areas: ["log-investigation"], difficulty: "medium", minLevel: "fresher",
    families: ["dns_exfil", "impossible_travel"], ask: ["disposition", "evidence"], requester: MANAGER,
    scenario: "Two alerts, one DNS and one travel. I need each verdict backed by the log lines that prove it, whether it is real or not. Cite only what matters: a reviewer will read every line you list.",
    skillTags: ["log search", "dns", "correlation"],
  },
  {
    id: "mapping-scan-or-attack", title: "Map two alerts to ATT&CK", areas: ["threat-mapping"], difficulty: "easy", minLevel: "fresher",
    families: ["port_scan", "brute_force"], ask: ["disposition", "technique"], requester: LEAD,
    scenario: "We report every confirmed incident against MITRE ATT&CK. Decide which of these two alerts is malicious and map it to the technique that best describes what the attacker did.",
    skillTags: ["mitre att&ck", "triage"],
  },
  {
    id: "mapping-beacon-exfil", title: "Map a beacon and a DNS alert to ATT&CK", areas: ["threat-mapping"], difficulty: "medium", minLevel: "fresher",
    families: ["beacon", "dns_exfil"], ask: ["disposition", "technique"], requester: MANAGER,
    scenario: "Two network alerts from different hosts. For each one that is malicious, pick the ATT&CK technique that matches the behaviour in the logs. This goes into the monthly threat report.",
    skillTags: ["mitre att&ck", "network"],
  },
  {
    id: "ir-macro-host", title: "Contain a host after a macro alert", areas: ["incident-response"], difficulty: "easy", minLevel: "fresher",
    families: ["phishing_macro", "port_scan"], ask: ["disposition", "action", "escalate"], requester: LEAD,
    scenario: "Word started PowerShell on a laptop, and the firewall flagged a port scan. For each alert decide whether it is real, what containment you trigger, and whether it comes to L2. Follow the runbook.",
    skillTags: ["incident response", "edr"],
  },
  {
    id: "ir-exfil-and-scan", title: "Respond to a DNS alert and a scan alert", areas: ["incident-response"], difficulty: "medium", minLevel: "fresher",
    families: ["dns_exfil", "port_scan"], ask: ["disposition", "severity", "action", "escalate"], requester: MANAGER,
    scenario: "Two alerts landed together. One may mean data is leaving us; the other may be our own tooling. For each: verdict, severity, containment and escalation. Do not contain what does not need containing.",
    skillTags: ["incident response", "containment"],
  },
  {
    id: "phish-click", title: "Work a phishing click end to end", areas: ["phishing-analysis"], difficulty: "easy", minLevel: "fresher",
    families: ["phishing_macro", "impossible_travel"], ask: ["disposition", "severity", "technique", "action", "escalate", "evidence"], requester: LEAD,
    scenario: "A user clicked something in an email and the EDR fired; an identity alert came in around the same time. Work both alerts fully: verdict, severity, technique, containment, escalation and the log lines that prove it.",
    skillTags: ["phishing", "email", "endpoint"],
  },
];
