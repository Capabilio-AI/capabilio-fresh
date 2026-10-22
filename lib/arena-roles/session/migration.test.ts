import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Runs the real migration SQL on real PostgreSQL (PGlite) with minimal stand-ins for the tables it references.
const MIGRATION = readFileSync(path.join(process.cwd(), "supabase/migrations/120_proof_sessions.sql"), "utf8");
const STUBS = `
  create role anon; create role authenticated; create role service_role;
  create table public.profiles (id uuid primary key default gen_random_uuid());
  create table public.arena_domain_assignments (
    id uuid primary key default gen_random_uuid(), user_id uuid not null, role_key text not null, status text not null default 'presented', completed_at timestamptz
  );
  create unique index arena_domain_assignments_one_open on public.arena_domain_assignments (user_id, role_key) where completed_at is null;
`;
const USER = "00000000-0000-0000-0000-000000000001";

let db: PGlite;
const fails = async (sql: string, pattern: RegExp) => {
  await expect(db.exec(sql)).rejects.toThrow(pattern);
};
const newSession = async (status = "open") => {
  const r = await db.query<{ id: string }>(`insert into arena_proof_sessions (user_id, role_key, spec_key, spec_version, status, finished_at) values ('${USER}', 'data-analyst', 'k', 1, '${status}', ${status === "open" ? "null" : "now()"}) returning id`);
  return r.rows[0].id;
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(`insert into public.profiles (id) values ('${USER}')`);
  await db.exec(MIGRATION);
});
afterAll(async () => db.close());

describe("migration 120", () => {
  it("allows one open session per student and role, but any number of finished ones", async () => {
    await db.exec("delete from arena_proof_sessions");
    await newSession("open");
    await fails(`insert into arena_proof_sessions (user_id, role_key, spec_key, spec_version) values ('${USER}', 'data-analyst', 'k', 1)`, /arena_proof_sessions_one_open_idx/);
    await newSession("finished");
    await newSession("finished");
    await db.exec(`insert into arena_proof_sessions (user_id, role_key, spec_key, spec_version) values ('${USER}', 'backend-developer', 'k', 1)`);
  });

  it("keeps status and finish time consistent", async () => {
    await fails(`insert into arena_proof_sessions (user_id, role_key, spec_key, spec_version, status) values ('${USER}', 'r', 'k', 1, 'finished')`, /check/);
  });

  it("only ever appends events: no edits, no duplicate sequence numbers, no unknown kinds", async () => {
    const id = await newSession("finished");
    await db.exec(`insert into arena_session_events (session_id, seq, stage_key, kind, source) values ('${id}', 1, 's', 'brief_viewed', 'client')`);
    await fails(`update arena_session_events set kind = 'check_run' where session_id = '${id}'`, /append-only/);
    await fails(`insert into arena_session_events (session_id, seq, stage_key, kind, source) values ('${id}', 1, 's', 'brief_viewed', 'client')`, /duplicate key/);
    await fails(`insert into arena_session_events (session_id, seq, stage_key, kind, source) values ('${id}', 2, 's', 'made_up', 'client')`, /check/);
    await fails(`insert into arena_session_events (session_id, seq, stage_key, kind, source) values ('${id}', 3, 's', 'brief_viewed', 'admin')`, /check/);
  });

  it("limits event payload size", async () => {
    const id = await newSession("finished");
    await fails(`insert into arena_session_events (session_id, seq, stage_key, kind, source, payload) values ('${id}', 1, 's', 'plan_note', 'server', jsonb_build_object('x', repeat('a', 5000)))`, /check/);
  });

  it("writes a report once per session and rubric version, and never edits it", async () => {
    const id = await newSession("finished");
    await db.exec(`insert into arena_session_reports (session_id, rubric_version, report) values ('${id}', 'v1', '{}')`);
    await fails(`insert into arena_session_reports (session_id, rubric_version, report) values ('${id}', 'v1', '{}')`, /duplicate key/);
    await fails(`update arena_session_reports set report = '{"a":1}' where session_id = '${id}'`, /append-only/);
    await db.exec(`insert into arena_session_reports (session_id, rubric_version, report) values ('${id}', 'v2', '{}')`);
  });

  it("rejects impossible stage results and keeps a stage once per session", async () => {
    const id = await newSession("finished");
    await fails(`insert into arena_proof_session_stages (session_id, stage_key, stage_index, area_key, checks_passed, checks_total) values ('${id}', 'a', 0, 'sql', 5, 3)`, /check/);
    await db.exec(`insert into arena_proof_session_stages (session_id, stage_key, stage_index, area_key) values ('${id}', 'a', 0, 'sql')`);
    await fails(`insert into arena_proof_session_stages (session_id, stage_key, stage_index, area_key) values ('${id}', 'a', 1, 'sql')`, /duplicate key/);
    await fails(`insert into arena_proof_session_stages (session_id, stage_key, stage_index, area_key) values ('${id}', 'b', 0, 'sql')`, /duplicate key/);
  });

  it("keeps one open DAILY ticket per student and role, while letting a session run beside it", async () => {
    await db.exec("delete from arena_domain_assignments");
    await db.exec("delete from arena_proof_sessions");
    const session = await newSession("open");
    await db.exec(`insert into arena_domain_assignments (user_id, role_key) values ('${USER}', 'data-analyst')`);
    await fails(`insert into arena_domain_assignments (user_id, role_key) values ('${USER}', 'data-analyst')`, /arena_domain_assignments_one_open/);
    await db.exec(`insert into arena_domain_assignments (user_id, role_key, proof_session_id) values ('${USER}', 'data-analyst', '${session}')`);
  });

  it("allows one in-progress stage per session, and any number of finished ones", async () => {
    await db.exec("delete from arena_domain_assignments");
    const session = await newSession("finished");
    const stage = (status: string, done: boolean) => `insert into arena_domain_assignments (user_id, role_key, proof_session_id, status, completed_at) values ('${USER}', 'data-analyst', '${session}', '${status}', ${done ? "now()" : "null"})`;
    await db.exec(stage("explaining", false));
    await db.exec(stage("explaining", false));
    await db.exec(stage("presented", false));
    await fails(stage("presented", false), /arena_domain_assignments_one_active_stage/);
    await fails(stage("grading", false), /arena_domain_assignments_one_active_stage/);
  });

  it("keeps a stage's attempt if the session row is removed", async () => {
    await db.exec("delete from arena_domain_assignments");
    const session = await newSession("finished");
    await db.exec(`insert into arena_domain_assignments (user_id, role_key, proof_session_id, status, completed_at) values ('${USER}', 'data-analyst', '${session}', 'explaining', null)`);
    await db.exec(`delete from arena_proof_sessions where id = '${session}'`);
    const left = await db.query<{ n: number; sid: string | null }>("select count(*)::int as n, max(proof_session_id::text) as sid from arena_domain_assignments");
    expect(left.rows[0]).toEqual({ n: 1, sid: null });
  });

  it("removes a session's stages, events and reports with the session", async () => {
    const id = await newSession("finished");
    await db.exec(`insert into arena_session_events (session_id, seq, stage_key, kind, source) values ('${id}', 1, 's', 'brief_viewed', 'client')`);
    await db.exec(`insert into arena_session_reports (session_id, rubric_version, report) values ('${id}', 'v1', '{}')`);
    await db.exec(`delete from arena_proof_sessions where id = '${id}'`);
    const left = await db.query<{ n: number }>(`select (select count(*) from arena_session_events where session_id = '${id}')::int + (select count(*) from arena_session_reports where session_id = '${id}')::int as n`);
    expect(left.rows[0].n).toBe(0);
  });

  it("gives clients no access and the server only what it needs", async () => {
    const priv = (role: string, table: string, p: string) => db.query<{ ok: boolean }>(`select has_table_privilege('${role}', 'public.${table}', '${p}') as ok`).then((r) => r.rows[0].ok);
    for (const t of ["arena_proof_sessions", "arena_proof_session_stages", "arena_session_events", "arena_session_reports"]) {
      expect(await priv("authenticated", t, "select"), `authenticated ${t}`).toBe(false);
      expect(await priv("anon", t, "select"), `anon ${t}`).toBe(false);
      expect(await priv("service_role", t, "select")).toBe(true);
    }
    expect(await priv("service_role", "arena_session_events", "update")).toBe(false);
    expect(await priv("service_role", "arena_session_events", "delete")).toBe(false);
    expect(await priv("service_role", "arena_session_reports", "update")).toBe(false);
    const rls = await db.query<{ relrowsecurity: boolean }>(`select relrowsecurity from pg_class where relname in ('arena_proof_sessions','arena_proof_session_stages','arena_session_events','arena_session_reports')`);
    expect(rls.rows).toHaveLength(4);
    expect(rls.rows.every((r) => r.relrowsecurity)).toBe(true);
  });
});
