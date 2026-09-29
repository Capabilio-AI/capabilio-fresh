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
