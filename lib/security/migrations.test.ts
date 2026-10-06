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

describe("migration 052: curriculum editing", () => {
  const sql = migration("052_curriculum_editing.sql");
  it("is additive: soft delete column, no data deleted", () => {
    expect(sql).toMatch(/alter table public\.courses add column deleted_at timestamptz/i);
    expect(sql).not.toMatch(/\bdrop (table|column)\b|\bdelete from public\.(courses|curriculum_|skills)/i);
  });
  it("keeps title uniqueness among live courses only", () => {
    expect(sql).toMatch(/create unique index courses_unique_title on public\.courses \(import_id, year, lower\(btrim\(title\)\)\) where deleted_at is null/i);
  });
  it("the new functions are service-role only and pin their search_path", () => {
    expect(sql).toMatch(/revoke execute on function public\.replace_course_tree\(uuid, jsonb\), public\.merge_courses\(uuid, uuid\), public\.array_dedupe\(text\[\]\) from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.replace_course_tree\(uuid, jsonb\), public\.merge_courses\(uuid, uuid\), public\.array_dedupe\(text\[\]\) to service_role/i);
    expect((sql.match(/set search_path = public, pg_temp/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
  it("publish ignores removed courses and creates no policies", () => {
    expect(sql).toMatch(/exists \(select 1 from public\.courses where import_id = p_import_id and deleted_at is null\)/i);
    expect(sql).not.toMatch(/create policy/i);
  });
});

describe("migration 053: clone a published curriculum", () => {
  const sql = migration("053_clone_curriculum.sql");
  it("is service-role only, additive, and refuses anything but a published source", () => {
    expect(sql).toMatch(/revoke execute on function public\.clone_curriculum_import\(uuid, uuid\) from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.clone_curriculum_import\(uuid, uuid\) to service_role/i);
    expect(sql).toMatch(/src\.status <> 'PUBLISHED'/);
    expect(sql).toMatch(/set search_path = public, pg_temp/);
    expect(sql).not.toMatch(/\bdrop table\b|\bdelete from\b|\bupdate public\./i);
    expect(sql).not.toMatch(/create policy/i);
  });
  it("copies mappings with their statuses and approvals, never re-marking them", () => {
    expect(sql).toMatch(/m\.mapping_source, m\.confidence, m\.importance, m\.evidence_source, m\.status, m\.created_by, m\.approved_by, m\.approved_at/);
  });
});

describe("migration 054: careers, intent, suggestions", () => {
  const sql = migration("054_careers_and_intent.sql");
  it("is additive: the legacy career_requirements table is only read", () => {
    expect(sql).not.toMatch(/\bdrop (table|column)\b|\bdelete from\b|\btruncate table\b/i);
    expect(sql).not.toMatch(/(alter table|update|insert into) public\.career_requirements\b/i);
  });
  it("nothing here is client-writable; the catalog is world-readable, a student's own rows are read-own only", () => {
    expect(sql).toMatch(/revoke insert, update, delete, truncate on public\.careers, public\.career_skill_requirements, public\.student_career_intent, public\.career_suggestions from anon, authenticated/i);
    expect(sql).toMatch(/create policy careers_read_all on public\.careers for select using \(true\)/i);
    expect(sql).toMatch(/create policy student_intent_read_own on public\.student_career_intent for select using \(student_id = auth\.uid\(\)\)/i);
    expect(sql).toMatch(/create policy career_suggestions_read_own on public\.career_suggestions for select using \(student_id = auth\.uid\(\)\)/i);
    expect(sql).not.toMatch(/for (insert|update|delete|all)/i);
  });
  it("a requirement can only name an active skill, and a Plan B can never equal the main career", () => {
    expect(sql).toMatch(/guard_requirement_skill_active/);
    expect(sql).toMatch(/primary_career_id is distinct from secondary_career_id/);
  });
  it("legacy skill names resolve by exact match only; the rest are queued for review, never guessed", () => {
    expect(sql).toMatch(/on conflict \(normalized_text\) do nothing/);
    expect(sql).toMatch(/'career_requirement'/);
    expect(sql).not.toMatch(/similarity|levenshtein|ilike/i);
  });
});

describe("migration 055: catalogs and Arena skill tags", () => {
  const sql = migration("055_catalogs_and_arena_skills.sql");
  const tables = ["certification_catalog", "certification_skills", "certification_careers", "learning_catalog", "learning_item_skills", "project_catalog", "project_skills", "arena_challenge_skills"];
  it("is additive: skill_area_resources is only read, nothing is dropped or deleted", () => {
    expect(sql).not.toMatch(/\bdrop (table|column)\b|\bdelete from public\.(skill_area_resources|arena_challenges|careers)\b|\btruncate table\b/i);
    expect(sql).not.toMatch(/(alter table|update|insert into) public\.skill_area_resources\b/i);
  });
  it.each(tables)("%s: RLS on and no client write privileges", (t) => {
    expect(sql).toMatch(new RegExp(`alter table public\\.${t} enable row level security`, "i"));
    expect(sql).toMatch(new RegExp(`revoke insert, update, delete, truncate on[^;]*public\\.${t}\\b[^;]*from anon, authenticated`, "is"));
  });
  it("only ever creates read policies", () => {
    expect(sql).not.toMatch(/for (insert|update|delete|all)/i);
    expect((sql.match(/create policy/g) ?? []).length).toBeGreaterThanOrEqual(8);
  });
  it("an AI-generated project can only be a recommendation for one student; a college project needs a college", () => {
    expect(sql).toMatch(/ai_projects_are_recommendations/);
    expect(sql).toMatch(/ai_projects_belong_to_a_student check \(\(source = 'AI_GENERATED'\) = \(for_student_id is not null\)\)/);
    expect(sql).toMatch(/college_projects_belong_to_a_college check \(\(source = 'COLLEGE'\) = \(institution_id is not null\)\)/);
  });
  it("only public, live, general projects are readable by anyone", () => {
    expect(sql).toMatch(/project_catalog_read on public\.project_catalog for select using \(status = 'ACTIVE' and source in \('CAPABILIO', 'MENTOR'\)\)/);
  });
  it("Arena tagging is exact-match only, runs in the database, and its functions are locked down and pin search_path", () => {
    expect(sql).not.toMatch(/similarity|levenshtein/i);
    expect(sql).toMatch(/revoke execute on function public\.tag_arena_challenge_skills\(uuid\) from public, anon, authenticated/i);
    expect(sql).toMatch(/revoke execute on function public\.arena_challenge_tag_trigger\(\) from public, anon, authenticated/i);
    expect((sql.match(/set search_path = public, pg_temp/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
  it("carried-over certifications keep unstated fields NULL and get the weakest relevance", () => {
    expect(sql).toMatch(/insert into public\.certification_catalog \(name, provider, url\)/);
    expect(sql).toMatch(/'OPTIONAL'/);
  });
});

describe("migration 056: roadmaps are private, immutable and written through one function", () => {
  const sql = migration("056_roadmaps.sql");
  const tables = ["roadmaps", "roadmap_versions", "roadmap_goals", "roadmap_skill_gaps", "roadmap_courses", "roadmap_learning_items", "roadmap_certifications", "roadmap_projects", "roadmap_arena_challenges", "roadmap_milestones"];
  it("every roadmap table has RLS on and no client write grant", () => {
    for (const t of tables) {
      expect(sql, t).toMatch(new RegExp(`alter table public\\.${t} enable row level security`, "i"));
      expect(sql, t).toMatch(new RegExp(`revoke insert, update, delete, truncate on[^;]*public\\.${t}\\b[^;]*from anon, authenticated`, "is"));
    }
  });
  it("only ever creates read policies, each scoped to the student's own roadmap", () => {
    const policies = sql.split("\n").filter((l) => /^create policy/i.test(l));
    expect(policies.length).toBe(tables.length);
    for (const l of policies) {
      expect(l).toMatch(/ for select using /i);
      expect(l).toMatch(/student_id = auth\.uid\(\)/);
    }
  });
  it("one roadmap per student per career, and at most one current roadmap per student", () => {
    expect(sql).toMatch(/unique \(student_id, career_id\)/);
    expect(sql).toMatch(/create unique index roadmaps_one_current_per_student on public\.roadmaps \(student_id\) where is_current/);
    expect(sql).toMatch(/unique \(roadmap_id, version_no\)/);
  });
  it("stored versions are immutable (but a deleted catalog item or student still works)", () => {
    expect(sql).toMatch(/only_dangling_refs_nulled/);
    expect(sql).toMatch(/immutable/i);
  });
  it("saving is one function: service role only, serialised per student, and pinned to a search_path", () => {
    expect(sql).toMatch(/pg_advisory_xact_lock/);
    expect(sql).toMatch(/revoke execute on function public\.save_roadmap_version\(jsonb\) from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.save_roadmap_version\(jsonb\) to service_role/i);
    expect((sql.match(/set search_path = public, pg_temp/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
  it("the migration is additive: it creates tables and functions only", () => {
    expect(sql).not.toMatch(/drop (table|column)|alter table public\.(?!roadmap)\w+ (drop|alter column)/i);
  });
});
