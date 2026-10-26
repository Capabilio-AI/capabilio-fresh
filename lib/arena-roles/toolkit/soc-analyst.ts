import type { RoleToolkit } from "./types";

/** IT-11 SOC Analyst: what the student is told about the SOC Console before and during Arena work. */
export const TOOLKIT: RoleToolkit = {
  roleKey: "soc-analyst",
  roleId: "IT-11",
  stream: "Cybersecurity",
  headline: "Work an L1 SOC shift: triage the alert queue, prove each verdict from the logs, map it to ATT&CK and start the response.",
  workstations: [
    {
      name: "SOC Console",
      mirrors: ["Splunk", "Microsoft Sentinel", "EDR console", "TheHive", "MITRE ATT&CK Navigator"],
      toolType: "soc_workspace",
      tier: "S",
      runsIn: "browser",
      summary: "An alert queue and a few hundred synthetic log lines you search in the browser, then a disposition, severity, technique, containment and escalation decision per alert.",
    },
  ],
  environment: [
    { label: "Alert queue", detail: "Two or three alerts per shift from identity, endpoint, proxy, DNS and firewall rules." },
    { label: "Logs", detail: "About 250 to 350 lines of auth, proxy, DNS, endpoint, firewall and email events for one day at a fictional Indian company." },
    { label: "Asset list", detail: "The company's VPN egress, approved scanner, SSO server, admin accounts and staff laptops." },
    { label: "Runbook", detail: "The team's severity, escalation and containment rules, shown with every ticket." },
    { label: "ATT&CK reference", detail: "A fixed local list of MITRE ATT&CK techniques to map confirmed activity to." },
  ],
  firstWeek: [
    "Triage two identity alerts: one brute-forced login, one impossible-travel alarm caused by the VPN.",
    "Prove a login alert by citing the exact auth log lines.",
    "Tell an approved vulnerability scan apart from a real attack and map the attack to ATT&CK.",
    "Contain a laptop after Word starts PowerShell, and decide whether it goes to L2.",
    "Work a phishing click end to end: email, link, download, macro, verdict and evidence.",
  ],
  portfolioArtifacts: [
    "Graded shift decisions per alert, with the per-check results",
    "Findings notes and the explain-your-work answers attached to each solved ticket",
  ],
  honestLimits: [
    "Synthetic logs from six scenario families; not a live SIEM, EDR or network, and nothing malicious runs.",
    "Choices come from fixed lists, so free-form investigation and report writing are not graded.",
    "Writing detection rules, SIEM query languages, forensics and malware analysis are not assessed yet.",
    "No hard tickets yet (lateral movement, multi-stage intrusions).",
    "Educational simulation only: fictional company, documentation-only IP ranges, reserved domains.",
  ],
};
