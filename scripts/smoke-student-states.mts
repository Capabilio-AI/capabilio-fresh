// Smoke test across student states. Signs in as each seeded test account and loads the pages a student uses, following redirects.
// It fails on a server error, a redirect loop, or a page that renders an error. Run it against a running app before merging a change that touches
// the student path, the dashboard, SkillStudio, the assessment or the gate:
//   node --env-file=.env.local --import tsx scripts/smoke-student-states.mts [baseUrl]
import { createClient } from "@supabase/supabase-js";

const base = process.argv[2] ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const password = process.env.TEST_ACCOUNTS_PASSWORD!.trim();
const ref = new URL(url).hostname.split(".")[0];
const CHUNK = 3180;

const ACCOUNTS = [
  "student.y1", "student.y1.role", "student.y2", "student.y2.role", "student.y3", "student.y3.pending", "student.y3.switched", "student.y4",
].map((n) => `${n}@capabilio.test`);
const PAGES = ["/dashboard", "/assessment", "/skillstudio", "/explore", "/dashboard/roadmap", "/arena", "/dashboard/passport", "/dashboard/skills", "/dashboard/skills?view=gaps", "/skillstudio/certifications"];
const MAX_HOPS = 6;


// The rules the product has promised. A change that breaks one of these fails here, before it reaches students.
const NO_ROLE = new Set(["student.y1@capabilio.test", "student.y2@capabilio.test"]);
const PATH_HEADINGS = ["You are at the start", "Keep practising", "Time to choose your role"];
function rules(email: string, path: string, body: string): string | null {
  // No page may push a finished student to an assessment they are not meant to take yet (the role assessment comes with 3rd-year Plan B).
  if (path.startsWith("/dashboard/passport") || path.startsWith("/dashboard/skills")) {
    if (body.includes("Go to assessment") || body.includes("Continue Assessment")) return `${path} links to the assessment`;
  }
  if (path === "/dashboard") {
    if (body.includes("Finish your assessment to unlock")) return "dashboard is locked (a finished student must not see the unlock screen)";
    if (body.includes("Retake assessment")) return "dashboard still offers Retake assessment";
    if (NO_ROLE.has(email)) {
      if (body.includes("Recommended career direction") || body.includes("Next best action")) return "a student with no role is shown a role recommendation";
      if (!PATH_HEADINGS.some((h) => body.includes(h))) return "a student with no role does not see the what-happens-next card";
    }
  }
  return null;
}

async function cookieFor(email: string): Promise<string> {
  const { data, error } = await createClient(url, key).auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  const value = `base64-${Buffer.from(JSON.stringify(data.session)).toString("base64url")}`;
  const name = `sb-${ref}-auth-token`;
  if (value.length <= CHUNK) return `${name}=${value}`;
  const parts: string[] = [];
  for (let i = 0; i * CHUNK < value.length; i++) parts.push(`${name}.${i}=${value.slice(i * CHUNK, (i + 1) * CHUNK)}`);
  return parts.join("; ");
}

async function visit(email: string, path: string, cookie: string): Promise<{ ok: boolean; note: string }> {
  const seen: string[] = [];
  let target = path;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const res = await fetch(new URL(target, base), { headers: { cookie }, redirect: "manual" });
    seen.push(target);
    if (res.status >= 300 && res.status < 400) {
      const next = new URL(res.headers.get("location") ?? "/", base);
      target = next.pathname + next.search;
      if (seen.includes(target)) return { ok: false, note: `redirect loop ${[...seen, target].join(" -> ")}` };
      continue;
    }
    if (res.status >= 500) return { ok: false, note: `HTTP ${res.status} at ${target}` };
    const body = await res.text();
    // a page that redirects after it started streaming answers 200 with a meta refresh / NEXT_REDIRECT marker instead of a 3xx
    const streamed = body.match(/http-equiv="refresh" content="\d+;url=([^"]+)"/)?.[1] ?? body.match(/NEXT_REDIRECT;(?:replace|push);([^;"\\]+)/)?.[1];
    if (streamed) {
      target = new URL(streamed, base).pathname;
      if (seen.includes(target)) return { ok: false, note: `redirect loop ${[...seen, target].join(" -> ")}` };
      continue;
    }
    if (/Application error|Internal Server Error|Unhandled Runtime Error/.test(body)) return { ok: false, note: `error page at ${target}` };
    const broken = rules(email, target, body);
    return { ok: res.status === 200 && !broken, note: broken ?? `${res.status} ${seen.length > 1 ? seen.join(" -> ") : target}` };
  }
  return { ok: false, note: `too many redirects ${seen.join(" -> ")}` };
}

let failed = 0;
for (const email of ACCOUNTS) {
  let cookie: string;
  try { cookie = await cookieFor(email); } catch (e) { console.log(`FAIL ${email}: ${(e as Error).message}`); failed++; continue; }
  for (const page of PAGES) {
    const r = await visit(email, page, cookie).catch((e) => ({ ok: false, note: `request failed: ${(e as Error).message}` }));
    if (!r.ok) failed++;
    console.log(`${r.ok ? "ok  " : "FAIL"} ${email.split("@")[0].padEnd(22)} ${page.padEnd(20)} ${r.note}`);
  }
}
console.log(failed === 0 ? "\nAll pages load for every state." : `\n${failed} problem(s).`);
process.exit(failed === 0 ? 0 : 1);
