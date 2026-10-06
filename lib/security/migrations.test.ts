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

describe("migration 048/049: curriculum model", () => {
  const sql = migration("048_curriculum_model.sql");
  const fix = migration("049_curriculum_cascade_delete.sql");
  const tables = ["curriculum_imports", "curriculum_versions", "courses", "course_outcomes", "course_units", "unit_topics", "lab_experiments", "program_outcomes", "other_curriculum_items", "course_skill_mappings", "course_outcome_skill_mappings", "curriculum_subjects_pre048", "curriculum_subject_skill_map_pre048"];
  it.each(tables)("%s: RLS on, no policies, no client privileges", (t) => {
    expect(sql).toMatch(new RegExp(`alter table public\\.${t} enable row level security`, "i"));
    expect(sql).toMatch(new RegExp(`revoke all on[^;]*public\\.${t}\\b[^;]*from anon, authenticated`, "is"));
  });
  it("creates no policies", () => expect(sql).not.toMatch(/create policy/i));
  it("is additive: legacy tables are never altered, dropped or deleted from", () => {
    expect(sql).not.toMatch(/\bdrop (table|column)\b/i);
    expect(sql).not.toMatch(/\bdelete from\b/i);
    expect(sql).not.toMatch(/\b(alter table|update|truncate)\s+(only\s+)?public\.curriculum_(subjects|subject_skill_map|extractions)\b/i);
  });
  it("encodes 'AI never becomes official' and 'confirmed has an approval time' for both mapping tables", () => {
    expect((sql.match(/ai_never_official check \(not \(mapping_source = 'AI_SUGGESTED' and status = 'CONFIRMED'\)\)/g) ?? []).length).toBe(2);
    expect((sql.match(/confirmed_has_approval check \(status <> 'CONFIRMED' or approved_at is not null\)/g) ?? []).length).toBe(2);
  });
  it("freezes every table under an import with a guard trigger", () => {
    for (const t of ["courses", "program_outcomes", "other_curriculum_items", "course_outcomes", "course_units", "unit_topics", "lab_experiments", "course_skill_mappings", "course_outcome_skill_mappings"]) {
      expect(sql).toMatch(new RegExp(`create trigger guard_frozen before insert or update or delete on public\\.${t} `, "i"));
    }
  });
  it("publish is service-role only", () => {
    expect(sql).toMatch(/revoke execute on function public\.publish_curriculum_import\(uuid, uuid\) from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.publish_curriculum_import\(uuid, uuid\) to service_role/i);
  });
  it("049 only relaxes the delete guards for a cascade from the institution", () => {
    expect(fix).toMatch(/exists \(select 1 from public\.institutions where id = old\.institution_id\)/i);
    expect(fix).toMatch(/not exists \(select 1 from public\.institutions where id = old\.institution_id\)/i);
    expect(fix).not.toMatch(/create policy|grant /i);
  });
});

describe("migration 050: curriculum functions pin their search_path", () => {
  const sql = migration("050_curriculum_function_search_path.sql");
  it.each(["curriculum_import_is_frozen", "guard_frozen_by_import", "guard_frozen_by_course", "guard_import_lifecycle", "guard_version_immutable", "publish_curriculum_import"])("%s", (fn) => {
    expect(sql).toMatch(new RegExp(`alter function public\\.${fn}\\([^)]*\\) set search_path = public, pg_temp`));
  });
});

describe("migration 051: extraction -> import link", () => {
  const sql = migration("051_extraction_import_link.sql");
  it("only adds a nullable FK, nulled if the import goes", () => {
    expect(sql).toMatch(/add column import_id uuid references public\.curriculum_imports\(id\) on delete set null/i);
    expect(sql).not.toMatch(/\bdrop\b|\bdelete from\b|create policy|grant /i);
  });
});
