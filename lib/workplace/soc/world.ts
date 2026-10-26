import type { Rng } from "../rng";
import type { LogSource } from "./types";

/** One generated event before it gets its public id; `ts` is seconds after the shift starts at 08:00 IST. */
export interface RawLine {
  ts: number;
  source: LogSource;
  host: string;
  user: string;
  event: string;
  detail: string;
}

export interface Person {
  user: string;
  host: string;
  ip: string;
  admin: boolean;
}

export interface Company {
  name: string;
  domain: string;
  prefix: string;
  people: Person[];
  vpnEgress: string;
  scanner: { host: string; ip: string };
  ssoHost: string;
}

export const SHIFT_SECONDS = 8 * 3600;
/** the approved scanner's window, seconds after 08:00 (10:00 to 12:00) */
export const SCAN_WINDOW: readonly [number, number] = [2 * 3600, 4 * 3600];

const COMPANIES: readonly { name: string; domain: string; prefix: string }[] = [
  { name: "Tarang Logistics Pvt Ltd", domain: "taranglogistics.example", prefix: "TRG" },
  { name: "Saptagiri FinServ", domain: "saptagirifin.example", prefix: "SGF" },
  { name: "Nilgiri Health Labs", domain: "nilgirihealth.example", prefix: "NHL" },
  { name: "Kaveri Retail Systems", domain: "kaveriretail.example", prefix: "KRS" },
  { name: "Godavari Agro Exports", domain: "godavariagro.example", prefix: "GAE" },
];

const NAMES: readonly string[] = [
  "priya.nair", "arjun.mehta", "kavya.reddy", "rohan.iyer", "sneha.kulkarni", "vikram.singh", "ananya.das", "rahul.verma",
  "meera.pillai", "aditya.joshi", "divya.menon", "karthik.rao", "pooja.sharma", "nikhil.gupta", "lakshmi.subramanian", "farhan.qureshi",
];

export function makeCompany(rng: Rng): Company {
  const c = rng.pick(COMPANIES);
  const names = rng.shuffle(NAMES).slice(0, 12);
  const people = names.map((user, i) => ({ user, host: `${c.prefix}-LT-${String(rng.int(100, 999))}${i}`, ip: `10.10.${rng.int(1, 30)}.${rng.int(10, 250)}`, admin: i < 2 }));
  return { ...c, people, vpnEgress: `198.51.100.${rng.int(10, 60)}`, scanner: { host: `${c.prefix}-SEC-SCAN01`, ip: `10.20.5.${rng.int(10, 40)}` }, ssoHost: `${c.prefix}-SSO01` };
}

/** The analyst's fixed reference: what is normal here. */
export function assetsOf(c: Company): { name: string; detail: string }[] {
  return [
    { name: `${c.vpnEgress}`, detail: "Corporate VPN egress (Singapore point of presence). Staff on VPN appear to come from Singapore." },
    { name: `${c.scanner.host} (${c.scanner.ip})`, detail: "Approved internal vulnerability scanner (service account svc-scanner). Scheduled scan window: 10:00–12:00 IST daily." },
    { name: c.ssoHost, detail: "Single sign-on server. Logs every login to company apps." },
    { name: "10.0.0.0/8", detail: "Company network. Office users are in 10.10.x.x." },
    { name: "Domain admins", detail: c.people.filter((p) => p.admin).map((p) => p.user).join(", ") },
    { name: "Staff laptops", detail: c.people.map((p) => `${p.user} → ${p.host}`).join("; ") },
  ];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-14T09:12:33+05:30" for `seconds` after 08:00 on `date`. */
export function stamp(date: string, seconds: number): string {
  const s = Math.max(0, Math.round(seconds)) + 8 * 3600;
  return `${date}T${pad(Math.floor(s / 3600) % 24)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}+05:30`;
}

const SAAS = ["mail", "docs", "erp", "hr", "wiki"];
const SITES = ["news.example", "weather.example", "learning.example", "maps.example", "cdn.workspace.example"];
const APPS = ["chrome.exe", "outlook.exe", "teams.exe", "excel.exe", "acrord32.exe"];

/** Ordinary office traffic: logins, browsing, lookups, apps, firewall allows, and a typo-then-login that looks like nothing. */
export function noise(rng: Rng, c: Company, count: number): RawLine[] {
  const lines: RawLine[] = [];
  for (let i = 0; i < count; i++) {
    const p = rng.pick(c.people);
    const ts = rng.int(60, SHIFT_SECONDS - 60);
    const kind = rng.weighted([["auth", 3], ["proxy", 4], ["dns", 4], ["endpoint", 3], ["firewall", 2], ["email", 1]] as const);
    if (kind === "auth") lines.push({ ts, source: "auth", host: c.ssoHost, user: p.user, event: "logon_success", detail: `src=${p.ip} app=${rng.pick(SAAS)}.${c.domain} method=password+otp geo=Mumbai,IN` });
    else if (kind === "proxy") {
      const site = rng.chance(0.5) ? `${rng.pick(SAAS)}.${c.domain}` : rng.pick(SITES);
      lines.push({ ts, source: "proxy", host: p.host, user: p.user, event: "http_request", detail: `GET https://${site}/ status=200 bytes=${rng.int(800, 90000)} category=business` });
    } else if (kind === "dns") lines.push({ ts, source: "dns", host: p.host, user: p.user, event: "dns_query", detail: `q=${rng.chance(0.5) ? `${rng.pick(SAAS)}.${c.domain}` : rng.pick(SITES)} type=A rcode=NOERROR` });
    else if (kind === "endpoint") lines.push({ ts, source: "endpoint", host: p.host, user: p.user, event: "process_start", detail: `image=C:\\Program Files\\${rng.pick(APPS)} parent=explorer.exe signed=yes` });
    else if (kind === "firewall") lines.push({ ts, source: "firewall", host: "FW-EDGE01", user: "-", event: "conn_allowed", detail: `src=${p.ip} dst=10.0.${rng.int(1, 9)}.${rng.int(2, 250)} dport=443 proto=tcp` });
    else lines.push({ ts, source: "email", host: "MAIL-GW01", user: p.user, event: "message_delivered", detail: `from=${rng.pick(c.people).user}@${c.domain} subject="${rng.pick(["Weekly report", "Team lunch Friday", "Leave approved", "Q3 review deck"])}" verdict=clean` });
  }
  // a mistyped password, then a normal login from the office: benign and not alerted
  const p = rng.pick(c.people);
  const t = rng.int(600, SHIFT_SECONDS - 900);
  lines.push(
    { ts: t, source: "auth", host: c.ssoHost, user: p.user, event: "logon_failed", detail: `src=${p.ip} app=mail.${c.domain} reason=bad_password geo=Mumbai,IN` },
    { ts: t + 40, source: "auth", host: c.ssoHost, user: p.user, event: "logon_success", detail: `src=${p.ip} app=mail.${c.domain} method=password+otp geo=Mumbai,IN` },
  );
  return lines;
}
