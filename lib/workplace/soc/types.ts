import type { ExperienceLevel } from "../level";
import type { Difficulty } from "@/lib/arena-workstations/types";

/**
 * SOC Console (W19): a deterministic simulator of an L1 analyst's shift. Everything here is synthetic and educational only: fictional companies, fictional
 * people, documentation-only IP ranges (RFC 5737 for the internet, RFC 1918 inside the company) and reserved domains (.example, .test). No real malware,
 * no exploit code, no real organisation.
 */

export const EDUCATIONAL_NOTICE =
  "Training simulation. The company, people, hosts, IP addresses and domains are fictional; logs are generated for practice and contain no real malware or exploit code.";

export type LogSource = "auth" | "proxy" | "dns" | "endpoint" | "firewall" | "email";
export const LOG_SOURCES: readonly LogSource[] = ["auth", "proxy", "dns", "endpoint", "firewall", "email"];

/** Tries per ticket: enough to fix a slip, too few to probe one field at a time. */
export const SOC_MAX_SUBMISSIONS = 3;

export interface LogLine {
  id: string;
  /** ISO 8601 in IST */
  ts: string;
  source: LogSource;
  host: string;
  user: string;
  event: string;
  detail: string;
}

/** What the queue shows for an alert: what fired, never the verdict. */
export interface PublicAlert {
  id: string;
  ts: string;
  rule: string;
  summary: string;
  host: string;
  user: string;
}

export type Disposition = "true_positive" | "false_positive" | "benign_true_positive";
export const DISPOSITIONS: readonly { key: Disposition; label: string }[] = [
  { key: "true_positive", label: "True positive (malicious)" },
  { key: "false_positive", label: "False positive (the rule misfired)" },
  { key: "benign_true_positive", label: "Benign true positive (real activity, authorised)" },
];

export type Severity = "low" | "medium" | "high" | "critical";
export const SEVERITIES: readonly Severity[] = ["low", "medium", "high", "critical"];

/** A fixed local subset of MITRE ATT&CK (public technique ids and names). */
export const TECHNIQUES: readonly { id: string; name: string }[] = [
  { id: "T1078", name: "Valid Accounts" },
  { id: "T1110", name: "Brute Force" },
  { id: "T1566.001", name: "Phishing: Spearphishing Attachment" },
  { id: "T1566.002", name: "Phishing: Spearphishing Link" },
  { id: "T1204.002", name: "User Execution: Malicious File" },
  { id: "T1059.001", name: "Command and Scripting Interpreter: PowerShell" },
  { id: "T1046", name: "Network Service Discovery" },
  { id: "T1021.001", name: "Remote Services: Remote Desktop Protocol" },
  { id: "T1053.005", name: "Scheduled Task/Job: Scheduled Task" },
  { id: "T1547.001", name: "Boot or Logon Autostart Execution: Registry Run Keys" },
  { id: "T1071.001", name: "Application Layer Protocol: Web Protocols" },
  { id: "T1071.004", name: "Application Layer Protocol: DNS" },
  { id: "T1048", name: "Exfiltration Over Alternative Protocol" },
];

export type ResponseAction = "none" | "isolate_host" | "disable_account" | "block_domain" | "block_ip";
export const ACTIONS: readonly { key: ResponseAction; label: string }[] = [
  { key: "none", label: "No containment needed: close with notes" },
  { key: "isolate_host", label: "Isolate the host from the network (EDR)" },
  { key: "disable_account", label: "Disable the account and reset its password" },
  { key: "block_domain", label: "Block the domain at the proxy and DNS" },
  { key: "block_ip", label: "Block the source IP at the firewall" },
];

/** The team's runbook, shown with every ticket so severity, escalation and containment are decided by stated rules, not guesswork. */
export const RUNBOOK: readonly string[] = [
  "Severity: Critical = confirmed compromise of a privileged (admin) account, or company data leaving the network.",
  "Severity: High = confirmed compromise of a normal user account or a single host.",
  "Severity: Medium = suspicious activity that is not confirmed.",
  "Severity: Low = false positive or authorised activity.",
  "Escalate to L2 every confirmed true positive of High or Critical severity. Do not escalate false positives or authorised activity.",
  "Containment: a compromised account is disabled and its password reset; a host running malicious code is isolated. Authorised or misfired alerts need no containment.",
  "Evidence: cite the log line ids that prove your verdict, only those that matter.",
];

/** The fields a ticket asks for; disposition is always asked. */
export type SocField = "disposition" | "severity" | "technique" | "action" | "escalate" | "evidence";

export interface SocContent {
  company: string;
  domain: string;
  shiftDate: string;
  notice: string;
  alerts: PublicAlert[];
  logs: LogLine[];
  /** the asset inventory and known infrastructure: the analyst's fixed reference */
  assets: { name: string; detail: string }[];
  runbook: string[];
  ask: SocField[];
  deliverable: string;
  /** per-field results would let repeated tries recover the answers, so the number of submissions is small */
  maxSubmissions: number;
}

export interface AlertKey {
  disposition: Disposition;
  severity: Severity;
  /** accepted technique ids (checked only for true positives) */
  techniques: string[];
  /** accepted containment actions */
  actions: ResponseAction[];
  escalate: boolean;
  /** each group must be cited at least once (any id of the group) */
  evidence: string[][];
  /** every line of the alert's chain; citing other lines counts as noise */
  related: string[];
}

export interface SocKey {
  alerts: Record<string, AlertKey>;
}

export interface AlertAnswer {
  disposition?: string;
  severity?: string;
  technique?: string;
  action?: string;
  escalate?: boolean;
  evidence?: string[];
}

export interface SocSubmission {
  alerts: Record<string, AlertAnswer>;
  note?: string;
}

export type FamilyKey = "brute_force" | "phishing_macro" | "impossible_travel" | "port_scan" | "dns_exfil" | "beacon";

export interface SocTemplate {
  id: string;
  title: string;
  areas: string[];
  difficulty: Difficulty;
  minLevel: ExperienceLevel;
  families: FamilyKey[];
  ask: SocField[];
  requester: { name: string; title: string };
  scenario: string;
  skillTags: string[];
}
