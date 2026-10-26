import type { Rng } from "../rng";
import type { AlertKey, FamilyKey } from "./types";
import { SCAN_WINDOW, SHIFT_SECONDS, type Company, type Person, type RawLine } from "./world";

/** A chain line; `group` marks it as evidence (any line of a group proves that part of the verdict). */
export type ChainLine = RawLine & { group?: number };

export interface Incident {
  alert: { ts: number; rule: string; summary: string; host: string; user: string };
  lines: ChainLine[];
  key: Omit<AlertKey, "evidence" | "related">;
  groups: number;
}

type Family = (rng: Rng, c: Company, actor: Person) => Incident;

const hex = (rng: Rng, n: number) => Array.from({ length: n }, () => "0123456789abcdef"[rng.int(0, 15)]).join("");
/** an outside address from the RFC 5737 documentation ranges */
const outside = (rng: Rng) => `${rng.pick(["203.0.113", "192.0.2"])}.${rng.int(2, 250)}`;
const start = (rng: Rng, from = 1800, to = SHIFT_SECONDS - 5400) => rng.int(from, to);

/** Many failed logins from outside, then one that works: a guessed password. Admin target => critical. */
const bruteForce: Family = (rng, c, actor) => {
  const t0 = start(rng);
  const src = outside(rng);
  const fails = rng.int(12, 22);
  const lines: ChainLine[] = Array.from({ length: fails }, (_, i) => ({ ts: t0 + i * rng.int(6, 11), source: "auth", host: c.ssoHost, user: actor.user, event: "logon_failed", detail: `src=${src} app=mail.${c.domain} reason=bad_password geo=unknown`, group: 0 }));
  const tOk = t0 + fails * 11 + 20;
  lines.push({ ts: tOk, source: "auth", host: c.ssoHost, user: actor.user, event: "logon_success", detail: `src=${src} app=mail.${c.domain} method=password geo=unknown`, group: 1 });
  lines.push({ ts: tOk + 90, source: "auth", host: c.ssoHost, user: actor.user, event: "mailbox_rule_created", detail: `src=${src} rule="forward all to external" app=mail.${c.domain}` });
  return {
    alert: { ts: tOk + 60, rule: "AUTH-07 Many failed logins followed by success", summary: `${fails} failed logins for ${actor.user} from one address, then a successful login.`, host: c.ssoHost, user: actor.user },
    lines,
    key: { disposition: "true_positive", severity: actor.admin ? "critical" : "high", techniques: ["T1110"], actions: ["disable_account"], escalate: true },
    groups: 2,
  };
};

/** A link in an email, a macro document, Word starting PowerShell: a user ran something malicious. */
const phishingMacro: Family = (rng, c, actor) => {
  const t0 = start(rng);
  const site = `invoice-share-${hex(rng, 4)}.test`;
  const lines: ChainLine[] = [
    { ts: t0, source: "email", host: "MAIL-GW01", user: actor.user, event: "message_delivered", detail: `from=billing@accounts-${hex(rng, 3)}.test subject="Invoice overdue: action needed" links=1 verdict=clean`, group: 0 },
    { ts: t0 + rng.int(200, 900), source: "proxy", host: actor.host, user: actor.user, event: "http_request", detail: `GET http://${site}/view?doc=${hex(rng, 6)} status=200 bytes=48211 category=newly-registered`, group: 0 },
  ];
  const t1 = lines[1].ts + rng.int(20, 60);
  lines.push(
    { ts: t1, source: "endpoint", host: actor.host, user: actor.user, event: "file_created", detail: `path=C:\\Users\\${actor.user}\\Downloads\\invoice_oct.docm source=browser` },
    { ts: t1 + 15, source: "endpoint", host: actor.host, user: actor.user, event: "process_start", detail: `image=C:\\Program Files\\Microsoft Office\\WINWORD.EXE parent=explorer.exe args="invoice_oct.docm" signed=yes` },
    { ts: t1 + 24, source: "endpoint", host: actor.host, user: actor.user, event: "process_start", detail: `image=C:\\Windows\\System32\\powershell.exe parent=WINWORD.EXE args="-nop -w hidden -enc [training placeholder]" signed=yes`, group: 1 },
    { ts: t1 + 30, source: "dns", host: actor.host, user: actor.user, event: "dns_query", detail: `q=${site} type=A rcode=NOERROR` },
  );
  return {
    alert: { ts: t1 + 40, rule: "EDR-12 Office application started a script interpreter", summary: `WINWORD.EXE started powershell.exe on ${actor.host}.`, host: actor.host, user: actor.user },
    lines,
    key: { disposition: "true_positive", severity: "high", techniques: ["T1204.002", "T1566.002", "T1059.001"], actions: ["isolate_host"], escalate: true },
    groups: 2,
  };
};

/** Mumbai then "Singapore" minutes later, but Singapore is the company's own VPN egress: the rule misfired. */
const impossibleTravel: Family = (rng, c, actor) => {
  const t0 = start(rng);
  const lines: ChainLine[] = [
    { ts: t0, source: "auth", host: c.ssoHost, user: actor.user, event: "logon_success", detail: `src=${actor.ip} app=hr.${c.domain} method=password+otp geo=Mumbai,IN` },
    { ts: t0 + rng.int(300, 500), source: "auth", host: "VPN-GW01", user: actor.user, event: "vpn_connected", detail: `client=${actor.host} assigned_egress=${c.vpnEgress} method=certificate+otp`, group: 0 },
  ];
  const t1 = lines[1].ts + rng.int(60, 240);
  lines.push({ ts: t1, source: "auth", host: c.ssoHost, user: actor.user, event: "logon_success", detail: `src=${c.vpnEgress} app=erp.${c.domain} method=password+otp geo=Singapore,SG`, group: 1 });
  return {
    alert: { ts: t1 + 30, rule: "AUTH-21 Impossible travel", summary: `${actor.user} logged in from Mumbai and from Singapore ${Math.round((t1 - t0) / 60)} minutes apart.`, host: c.ssoHost, user: actor.user },
    lines,
    key: { disposition: "false_positive", severity: "low", techniques: [], actions: ["none"], escalate: false },
    groups: 2,
  };
};

/** Many ports probed from one internal address, but it is the approved scanner in its window: real, and authorised. */
const portScan: Family = (rng, c) => {
  const t0 = rng.int(SCAN_WINDOW[0] + 300, SCAN_WINDOW[1] - 2400);
  const lines: ChainLine[] = [
    { ts: t0 - 20, source: "endpoint", host: c.scanner.host, user: "svc-scanner", event: "process_start", detail: `image=C:\\Program Files\\KavachScan\\kavachscan.exe parent=services.exe args="--job daily-internal" signed=yes`, group: 1 },
  ];
  const ports = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 993, 1433, 3306, 3389, 5900, 8080];
  const targets = rng.int(2, 3);
  for (let t = 0; t < targets; t++) {
    const dst = rng.pick(c.people).ip;
    for (const [i, port] of rng.shuffle(ports).slice(0, rng.int(9, 13)).entries()) {
      lines.push({ ts: t0 + t * 600 + i * rng.int(1, 3), source: "firewall", host: "FW-CORE01", user: "-", event: port === 443 || port === 3389 ? "conn_allowed" : "conn_denied", detail: `src=${c.scanner.ip} dst=${dst} dport=${port} proto=tcp`, group: 0 });
    }
  }
  return {
    alert: { ts: t0 + targets * 600, rule: "NET-03 Port scan detected", summary: `${c.scanner.ip} connected to many ports on several hosts.`, host: "FW-CORE01", user: "-" },
    lines,
    key: { disposition: "benign_true_positive", severity: "low", techniques: [], actions: ["none"], escalate: false },
    groups: 2,
  };
};

/** A process reads a finance file, then the host sends long encoded TXT lookups to one rare domain: data leaving over DNS. */
const dnsExfil: Family = (rng, c, actor) => {
  const t0 = start(rng);
  const domain = `datasync-${hex(rng, 4)}.test`;
  const lines: ChainLine[] = [
    { ts: t0, source: "endpoint", host: actor.host, user: actor.user, event: "file_read", detail: `path=D:\\Finance\\payroll_${rng.pick(["sep", "oct"])}_2026.xlsx process=C:\\Users\\${actor.user}\\AppData\\Local\\syncsvc.exe`, group: 1 },
  ];
  const n = rng.int(22, 34);
  for (let i = 0; i < n; i++) lines.push({ ts: t0 + 60 + i * rng.int(8, 20), source: "dns", host: actor.host, user: actor.user, event: "dns_query", detail: `q=${hex(rng, 40)}.${i}.${domain} type=TXT rcode=NOERROR`, group: 0 });
  return {
    alert: { ts: t0 + 60 + n * 20, rule: "DNS-09 Long queries to a rare domain", summary: `${actor.host} sent ${n} long TXT lookups to one domain seen nowhere else.`, host: actor.host, user: actor.user },
    lines,
    key: { disposition: "true_positive", severity: "critical", techniques: ["T1048", "T1071.004"], actions: ["isolate_host"], escalate: true },
    groups: 2,
  };
};

/** A new unsigned program set to start at logon, then calls home every five minutes like clockwork: a malware beacon. */
const beacon: Family = (rng, c, actor) => {
  const t0 = start(rng, 1200, SHIFT_SECONDS - 9000);
  const domain = `upd-check-${hex(rng, 4)}.test`;
  const exe = `C:\\Users\\${actor.user}\\AppData\\Roaming\\updchk.exe`;
  const lines: ChainLine[] = [
    { ts: t0, source: "endpoint", host: actor.host, user: actor.user, event: "file_created", detail: `path=${exe} signed=no`, group: 1 },
    { ts: t0 + 5, source: "endpoint", host: actor.host, user: actor.user, event: "registry_set", detail: `key=HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\UpdateCheck value=${exe}`, group: 1 },
  ];
  const n = rng.int(14, 20);
  const bytes = rng.int(380, 460);
  for (let i = 0; i < n; i++) lines.push({ ts: t0 + 120 + i * 300 + rng.int(-3, 3), source: "proxy", host: actor.host, user: actor.user, event: "http_request", detail: `POST http://${domain}/gate status=200 bytes=${bytes} category=uncategorized agent="updchk/1.0"`, group: 0 });
  return {
    alert: { ts: t0 + 120 + n * 300, rule: "PRX-14 Periodic connections to a rare domain", summary: `${actor.host} contacted one uncategorised domain ${n} times at a regular interval.`, host: actor.host, user: actor.user },
    lines,
    key: { disposition: "true_positive", severity: "high", techniques: ["T1071.001"], actions: ["isolate_host"], escalate: true },
    groups: 2,
  };
};

export const FAMILIES: Record<FamilyKey, Family> = {
  brute_force: bruteForce,
  phishing_macro: phishingMacro,
  impossible_travel: impossibleTravel,
  port_scan: portScan,
  dns_exfil: dnsExfil,
  beacon,
};
