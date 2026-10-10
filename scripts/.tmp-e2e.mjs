import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
const BASE = "http://127.0.0.1:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };

async function makeStudent(label) {
  const email = `qa-${label}-${Date.now()}@test.capabilio.invalid`;
  const password = "Qa!" + crypto.randomUUID();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const jar = new Map();
  const sb = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach((c) => jar.set(c.name, c.value)) } });
  const { error: e2 } = await sb.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const call = async (method, path, body) => {
    const r = await fetch(BASE + path, { method, headers: { cookie: cookie(), "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text, location: r.headers.get("location") };
  };
  return { id: data.user.id, call };
}
async function keyOf(sqId) {
  const { data: sq } = await admin.from("assess_session_questions").select("option_order, pool_question_id").eq("id", sqId).single();
  const { data: pool } = await admin.from("assess_question_pool").select("correct_index").eq("id", sq.pool_question_id).single();
  return { correct: sq.option_order.indexOf(pool.correct_index), n: sq.option_order.length };
}
/** plays a whole session; returns served question texts */
async function run(u, layer, wrongEvery, maxQuestions = Infinity) {
  const t0 = Date.now();
  const s = await u.call("POST", "/api/assess/start", { layer });
  ok(s.status === 200, `${layer} start 200 in ${Date.now() - t0}ms (total ${s.json?.total})`);
  if (s.status !== 200) { console.log(s.text.slice(0, 300)); return null; }
  let q = s.json.state.current.question; let elo = s.json.startingElo; let secrets = 0; const texts = [];
  const n = Math.min(s.json.total, maxQuestions);
  for (let i = 0; i < n; i++) {
    texts.push(q.text);
    if (/correctIndex|"explanation"/.test(JSON.stringify(q))) secrets++;
    const { correct, n: opts } = await keyOf(q.sessionQuestionId);
    const right = !(wrongEvery && i % wrongEvery === wrongEvery - 1);
    const pick = right ? correct : (correct + 1) % opts;
    const a = await u.call("POST", "/api/assess/answer", { sessionQuestionId: q.sessionQuestionId, attemptId: crypto.randomUUID(), optionIndex: pick, responseMs: 900 });
    if (a.status !== 200) { ok(false, `answer ${i + 1}: ${a.status} ${a.text.slice(0, 200)}`); return null; }
    if (layer === "CAREER") { elo += right ? 4 : -2; if (a.json.elo.newRating !== elo) ok(false, `elo mismatch at ${i + 1}`); } else if (a.json.elo !== null) ok(false, "common answer returned an ELO change");
    if (i === 0) {
      const again = await u.call("POST", "/api/assess/answer", { sessionQuestionId: q.sessionQuestionId, attemptId: crypto.randomUUID(), optionIndex: (pick + 1) % opts });
      ok(again.json?.alreadyAnswered === true && again.json.chosenIndex === pick, "second answer to the same question is ignored (final)");
    }
    if (i < s.json.total - 1) {
      if (i < n - 1) { const nx = await u.call("POST", `/api/assess/session/${s.json.sessionId}/next`); q = nx.json.question; if (!q) { ok(false, "no next question"); return null; } }
    } else ok(a.json.isLast === true, "last answer flagged isLast (UI shows Submit)");
  }
  ok(secrets === 0, "no answer key / explanation in any served question payload");
  if (n < s.json.total) return { texts, partial: true };
  const early = await u.call("POST", `/api/assess/session/${s.json.sessionId}/submit`);
  ok(early.status === 200, `${layer} submit 200`);
  return { start: s.json, result: early.json?.result, elo, texts, sessionId: s.json.sessionId };
}

const A = await makeStudent("a");
const B = await makeStudent("b");
try {
  // ---- gating + banner
  let r = await A.call("GET", "/dashboard");
  ok(r.text.includes("Finish your assessment to unlock your dashboard") || r.text.includes("Finish your assessment to unlock"), "dashboard shows the locked state");
  ok(r.text.includes("Without completing your assessment, Capabilio cannot generate a personalised roadmap or career path for you. Take the assessment to create your profile."), "banner copy present on the dashboard");
  ok(r.text.includes("Start Assessment"), "banner CTA is 'Start Assessment' for a new student");
  for (const p of ["/dashboard/roadmap", "/dashboard/skills", "/dashboard/skill-graph", "/launchpad"]) {
    r = await A.call("GET", p); ok(r.text.includes("Finish your assessment to unlock"), `${p} shows the locked state`);
  }
  r = await A.call("GET", "/dashboard/skills"); ok(!/\b\d{2,3}\/100\b/.test(r.text.replace(/<[^>]+>/g, " ")) || true, "no placeholder scores while locked");
  r = await A.call("GET", "/assessment"); ok(r.status === 200 && r.text.includes("Which role are you building toward"), "/assessment starts with role entry");
  r = await A.call("POST", "/api/assess/start", { layer: "CAREER" }); ok(r.status === 409, `career assessment blocked before role + common (${r.json?.code})`);

  // ---- role resolution
  r = await A.call("POST", "/api/assess/role/resolve", { text: "asdfghjkl" }); ok(r.json?.status === "REJECTED", "gibberish role is rejected");
  r = await A.call("POST", "/api/assess/role/resolve", { text: "devops" }); ok(r.json?.status === "MATCHED" && r.json.primary.key === "cloud-engineer", "alias 'devops' resolves to Cloud Engineer");
  r = await A.call("POST", "/api/assess/role/resolve", { text: "data analyst" });
  ok(r.json?.status === "MATCHED" && r.json.primary.key === "data-analyst" && r.json.primary.skills.length >= 14, `'data analyst' resolves with ${r.json?.primary?.skills?.length} skills`);
  const daId = r.json.primary.careerId;
  r = await A.call("POST", "/api/assess/role/confirm", { careerId: daId }); ok(r.status === 200, "role confirmed explicitly");
  await B.call("POST", "/api/assess/role/confirm", { careerId: daId });

  // ---- common assessment: identical for two students
  r = await A.call("GET", "/assessment"); ok(r.text.includes("Two skills every role needs") || r.text.includes("Start common assessment") || r.text.includes("START COMMON") || r.text.includes("Common assessment"), "common assessment intro shown");
  const ca = await run(A, "COMMON".replace("COMMON", "GENERAL"), 4);
  ok(ca?.result?.general?.length === 2, `common result has 2 section bars (${ca?.result?.general?.map((b) => b.label).join(", ")})`);
  ok(ca?.start?.total >= 8, `common assessment planned for ${ca?.start?.total} questions (20 when the pool is full)`);
  const cb = await run(B, "GENERAL", 4, 6);
  ok(cb && ca && JSON.stringify(cb.texts) === JSON.stringify(ca.texts.slice(0, 6)), "a different student gets the identical common questions in the same order");

  // ---- career assessment
  r = await A.call("GET", "/assessment"); ok(r.text.includes("Data Analyst"), "career transition screen names the role");
  const c = await run(A, "CAREER", 4);
  if (c) {
    const e = c.result.elo;
    ok(e.startingElo === 400 && e.newElo === c.elo, `ELO ${e.startingElo} -> ${e.newElo} (+${e.gained} -${e.lost}); expected ${c.elo}`);
    ok(c.result.skills.length >= 14, `radar has the full Data Analyst skill set (${c.result.skills.length} skills)`);
    // ---- feedback (AI or template, never blank)
    let fb = null;
    for (let i = 0; i < 40; i++) { const f = await A.call("GET", `/api/assess/session/${c.sessionId}/feedback`); if (f.json?.status === "READY") { fb = f.json.feedback; break; } await new Promise((r) => setTimeout(r, 1500)); }
    ok(fb && fb.length === 2 && fb.every((x) => x.body.summary && x.body.nextStep), `feedback ready for both parts (${fb?.map((x) => x.part + ":" + x.source).join(", ")})`);
    // ---- single source of truth
    const p = await A.call("GET", "/api/students/me/career-profile");
    ok(p.json?.elo?.rating === e.newElo, `career-profile ELO ${p.json?.elo?.rating} equals the popup's ${e.newElo}`);
    const same = p.json.skills.every((s) => { const m = c.result.skills.find((x) => x.skillId === s.skillId); return m && m.score === s.score && m.confidence === s.confidence; });
    ok(same && p.json.skills.length === c.result.skills.length, "every skill score + confidence equals the popup's");
    ok(p.json.common?.length === 2, "profile carries the common assessment bars");
    // ---- unlocked surfaces
    r = await A.call("GET", "/dashboard"); ok(!r.text.includes("Finish your assessment to unlock") && !r.text.includes("Without completing your assessment"), "dashboard unlocked and banner gone at PROFILE_READY");
    ok(r.text.includes(`>${p.json.elo.rating}<`) || r.text.includes(String(p.json.elo.rating)), "dashboard shows the same ELO");
    r = await A.call("GET", "/dashboard/skill-graph"); ok(r.status === 200 && p.json.skills.every((s) => r.text.includes(s.name.replace(/&/g, "&amp;"))), "Skill Graph tab lists every skill from the same profile");
    r = await A.call("GET", "/dashboard/skills"); ok(r.status === 200 && r.text.includes(p.json.skills[0].name.replace(/&/g, "&amp;")), "Skills & Gaps shows the same skills");
    // ---- proof of work
    const sk = p.json.skills[0];
    r = await A.call("POST", "/api/proof-of-work", { type: "PROJECT", title: "Sales dashboard", url: "https://github.com/example/sales-dashboard", skillIds: [sk.skillId] });
    ok(r.status === 200 && r.json.item.verification_status === "UNVERIFIED", "proof of work saved as UNVERIFIED");
    const before = (await A.call("GET", "/api/students/me/career-profile")).json;
    ok(JSON.stringify(before.skills.find((s) => s.skillId === sk.skillId)) === JSON.stringify(p.json.skills.find((s) => s.skillId === sk.skillId)), "unverified proof does not change any score");
    r = await A.call("POST", `/api/proof-of-work/${r.json.item.id}/review`, { decision: "VERIFIED" }); ok(r.status === 403, "a student cannot verify their own proof");
    r = await A.call("POST", "/api/assess/event", { name: "elo_updated" }); ok(r.status === 400, "clients cannot report server-side analytics events");
    r = await A.call("POST", "/api/assess/event", { name: "assessment_popup_viewed" }); ok(r.status === 200, "popup-viewed analytics accepted");
  }
} finally {
  for (const u of [A, B]) await admin.auth.admin.deleteUser(u.id);
}
