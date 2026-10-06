import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = (name: string) => readFileSync(join(process.cwd(), "supabase/migrations", name), "utf8");

describe("migration 031 keeps client writes to memberships and profile roles closed", () => {
  const sql = migration("031_lock_membership_and_profile_writes.sql");
  it("drops the client insert policy and revokes insert/update on memberships", () => {
    expect(sql).toMatch(/drop policy if exists institution_memberships_insert_own/i);
    expect(sql).toMatch(/revoke insert, update on public\.institution_memberships from anon, authenticated/i);
  });
  it("column-restricts profile updates and never grants primary_role", () => {
    expect(sql).toMatch(/revoke update on public\.profiles from anon, authenticated/i);
    const grant = sql.match(/grant update \(([^)]*)\)\s+on public\.profiles/i)?.[1] ?? "";
    expect(grant).not.toMatch(/primary_role|email|\bid\b/);
    expect(grant).toMatch(/full_name/);
  });
});

describe("migration 033: every roadmap table is private to the service role", () => {
  const sql = migration("033_curriculum_roadmap.sql");
  const tables = ["curriculum_subjects", "curriculum_subject_skill_map", "role_target_profiles", "skill_area_resources"];
  it.each(tables)("%s has RLS enabled, no policies, and no client privileges", (t) => {
    expect(sql).toMatch(new RegExp(`alter table public\\.${t} enable row level security`, "i"));
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).toMatch(new RegExp(`revoke all on[^;]*public\\.${t}[^;]*from anon, authenticated`, "is"));
  });
  it("mappings and targets can only name real skill areas (composite FK)", () => {
    expect((sql.match(/references public\.arena_skill_areas\(role_key, area_key\)/g) ?? []).length).toBe(3);
  });
});

describe("migration 034: membership-based read policies require an active membership", () => {
  const sql = migration("034_membership_policies_require_active.sql");
  it.each(["programs", "departments", "cohorts"])("%s policy checks status = 'active'", (t) => {
    const block = sql.split(/drop policy/i).find((b) => b.includes(`on public.${t} for select`)) ?? "";
    expect(block).toMatch(/status = 'active'/);
  });
});

describe("migration 047: canonical skills", () => {
  const sql = migration("047_canonical_skills.sql");
  it("is additive: no drops, no deletes", () => {
    expect(sql).not.toMatch(/\bdrop (table|column)\b/i);
    expect(sql).not.toMatch(/\bdelete from\b/i);
  });
  it("demotes nothing silently: existing rows default to candidate", () => {
    expect(sql).toMatch(/status text not null default 'candidate'/i);
  });
  it("an active skill must carry a key and category", () => {
    expect(sql).toMatch(/skills_active_has_key/i);
  });
  it("taxonomy tables are read-only to clients; suggestions are private", () => {
    expect(sql).toMatch(/revoke insert, update, delete, truncate on public\.skills, public\.skill_aliases from anon, authenticated/i);
    expect(sql).toMatch(/revoke all on public\.skill_suggestions from anon, authenticated/i);
    expect(sql).toMatch(/alter table public\.skill_suggestions enable row level security/i);
    expect(sql).not.toMatch(/create policy[^;]*skill_suggestions/i);
  });
});
