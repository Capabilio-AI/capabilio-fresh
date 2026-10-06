-- Curriculum model (Phase 2 of the curriculum -> roadmap work; docs/curriculum-roadmap-audit.md §7, v2 progress doc).
--
-- ADDITIVE. The legacy tables (curriculum_subjects, curriculum_subject_skill_map, curriculum_extractions) are NOT modified;
-- they keep serving the current admin UI and student roadmap until the Phase 4 cutover. Their rows are copied into the new model below.
--
-- Authority: every table is private to the service role (RLS on, no policies, privileges revoked), as in 033/046/047.
-- A "curriculum version" is a FROZEN IMPORT, not a row copy: publishing flips the import to PUBLISHED, writes an immutable
-- curriculum_versions row, and triggers refuse any later edit to that import's courses, outcomes, units, labs, POs or mappings.

-- 0. Safety copies of the legacy rows (drop once the Phase 4 cutover is verified).
create table public.curriculum_subjects_pre048 as table public.curriculum_subjects;
create table public.curriculum_subject_skill_map_pre048 as table public.curriculum_subject_skill_map;
alter table public.curriculum_subjects_pre048 enable row level security;
alter table public.curriculum_subject_skill_map_pre048 enable row level security;
revoke all on public.curriculum_subjects_pre048, public.curriculum_subject_skill_map_pre048 from anon, authenticated;

-- 1. Imports and versions.
create table public.curriculum_imports (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  branch text not null check (char_length(btrim(branch)) between 1 and 200),
  branch_key text generated always as (lower(btrim(branch))) stored,
  program text check (program is null or char_length(program) <= 200),
  regulation text check (regulation is null or char_length(btrim(regulation)) between 1 and 80),
  source_file_name text check (source_file_name is null or char_length(source_file_name) <= 300),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'EXTRACTED', 'UNDER_REVIEW', 'CONFIRMED', 'PUBLISHED', 'ARCHIVED')),
  extraction_summary jsonb,
  extraction_model text,
  extraction_version text,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  supersedes_import_id uuid references public.curriculum_imports(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index curriculum_imports_lookup on public.curriculum_imports (institution_id, branch_key, status) where deleted_at is null;
create trigger set_updated_at before update on public.curriculum_imports for each row execute function public.set_updated_at();

create table public.curriculum_versions (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null unique references public.curriculum_imports(id),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  branch_key text not null,
  regulation text,
  version_no integer not null check (version_no >= 1),
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index curriculum_versions_unique on public.curriculum_versions (institution_id, branch_key, coalesce(regulation, ''), version_no);

-- 2. Courses and everything under them. Fields the syllabus does not state stay NULL / empty.
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.curriculum_imports(id) on delete cascade,
  year smallint not null check (year between 1 and 6),
  semester smallint check (semester is null or semester between 1 and 2),
  course_code text check (course_code is null or char_length(course_code) <= 40),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  category text check (category is null or char_length(category) <= 120),
  kind text not null default 'course' check (kind in ('course', 'lab', 'elective_option', 'project', 'audit')),
  lecture_hours numeric(4, 1) check (lecture_hours is null or lecture_hours >= 0),
  tutorial_hours numeric(4, 1) check (tutorial_hours is null or tutorial_hours >= 0),
  practical_hours numeric(4, 1) check (practical_hours is null or practical_hours >= 0),
  credits numeric(4, 1) check (credits is null or credits >= 0),
  prerequisites text,
  prerequisite_course_ids uuid[] not null default '{}',
  objectives text[] not null default '{}',
  is_elective boolean not null default false,
  is_lab boolean not null default false,
  textbooks text[],
  reference_books text[],
  online_resources text[],
  /** raw source snippets the fields came from, so a reviewer can verify them */
  provenance jsonb,
  legacy_subject_id uuid unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index courses_unique_title on public.courses (import_id, year, lower(btrim(title)));
create index courses_by_import on public.courses (import_id, year, semester);
create trigger set_updated_at before update on public.courses for each row execute function public.set_updated_at();

create table public.course_outcomes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  code text not null check (char_length(btrim(code)) between 1 and 20),
  text text not null check (char_length(btrim(text)) >= 1),
  bloom_level text check (bloom_level is null or bloom_level in ('Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create')),
  sort_order integer not null default 0,
  provenance text,
  created_at timestamptz not null default now(),
  unique (course_id, code),
  unique (id, course_id)
);

create table public.course_units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  unit_no smallint not null check (unit_no >= 1),
  title text not null check (char_length(btrim(title)) >= 1),
  hours numeric(4, 1) check (hours is null or hours >= 0),
  created_at timestamptz not null default now(),
  unique (course_id, unit_no),
  unique (id, course_id)
);

create table public.unit_topics (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null,
  course_id uuid not null,
  text text not null check (char_length(btrim(text)) >= 1),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (unit_id, course_id) references public.course_units(id, course_id) on delete cascade
);

create table public.lab_experiments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  sort_order integer not null default 0,
  text text not null check (char_length(btrim(text)) >= 1),
  created_at timestamptz not null default now()
);

create table public.program_outcomes (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.curriculum_imports(id) on delete cascade,
  kind text not null check (kind in ('PO', 'PSO')),
  code text not null check (char_length(btrim(code)) between 1 and 20),
  text text not null check (char_length(btrim(text)) >= 1),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (import_id, code)
);

create table public.other_curriculum_items (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.curriculum_imports(id) on delete cascade,
  type text not null check (type in ('MOOC', 'HONORS', 'MINOR', 'INTERNSHIP', 'PROJECT_WORK', 'ELECTIVE_POOL')),
  title text not null check (char_length(btrim(title)) >= 1),
  details text,
  created_at timestamptz not null default now()
);

-- 3. Mappings. The CHECKs are the database's own statement of "AI suggests, a person confirms".
create table public.course_skill_mappings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  skill_id uuid not null references public.skills(id),
  mapping_source text not null check (mapping_source in ('AI_SUGGESTED', 'COLLEGE_CONFIRMED', 'MANUAL', 'SYSTEM')),
  confidence numeric(3, 2) check (confidence is null or confidence between 0 and 1),
  importance text check (importance is null or importance in ('CORE', 'SUPPORTING', 'MINOR')),
  evidence_source text,
  status text not null default 'SUGGESTED' check (status in ('SUGGESTED', 'CONFIRMED', 'REJECTED')),
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, skill_id),
  constraint course_mapping_ai_never_official check (not (mapping_source = 'AI_SUGGESTED' and status = 'CONFIRMED')),
  constraint course_mapping_confirmed_has_approval check (status <> 'CONFIRMED' or approved_at is not null)
);
create index course_skill_mappings_by_skill on public.course_skill_mappings (skill_id, status);
create trigger set_updated_at before update on public.course_skill_mappings for each row execute function public.set_updated_at();

create table public.course_outcome_skill_mappings (
  id uuid primary key default gen_random_uuid(),
  course_outcome_id uuid not null,
  course_id uuid not null,
  skill_id uuid not null references public.skills(id),
  mapping_source text not null check (mapping_source in ('AI_SUGGESTED', 'COLLEGE_CONFIRMED', 'MANUAL', 'SYSTEM')),
  confidence numeric(3, 2) check (confidence is null or confidence between 0 and 1),
  importance text check (importance is null or importance in ('CORE', 'SUPPORTING', 'MINOR')),
  evidence_source text,
  status text not null default 'SUGGESTED' check (status in ('SUGGESTED', 'CONFIRMED', 'REJECTED')),
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (course_outcome_id, course_id) references public.course_outcomes(id, course_id) on delete cascade,
  unique (course_outcome_id, skill_id),
  constraint outcome_mapping_ai_never_official check (not (mapping_source = 'AI_SUGGESTED' and status = 'CONFIRMED')),
  constraint outcome_mapping_confirmed_has_approval check (status <> 'CONFIRMED' or approved_at is not null)
);
create index course_outcome_skill_mappings_by_course on public.course_outcome_skill_mappings (course_id);
create trigger set_updated_at before update on public.course_outcome_skill_mappings for each row execute function public.set_updated_at();

-- 4. Immutability and lifecycle guards.
create function public.curriculum_import_is_frozen(p_import uuid) returns boolean
language sql stable as $$
  select exists (select 1 from public.curriculum_imports where id = p_import and status in ('PUBLISHED', 'ARCHIVED'))
$$;

create function public.guard_frozen_by_import() returns trigger language plpgsql as $$
begin
  if (tg_op <> 'INSERT' and public.curriculum_import_is_frozen(old.import_id))
     or (tg_op <> 'DELETE' and public.curriculum_import_is_frozen(new.import_id)) then
    raise exception 'This curriculum is published and cannot be edited; create a new import instead.' using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end $$;

create function public.guard_frozen_by_course() returns trigger language plpgsql as $$
declare c_old uuid; c_new uuid;
begin
  if tg_op <> 'INSERT' then
    select import_id into c_old from public.courses where id = old.course_id;
  end if;
  if tg_op <> 'DELETE' then
    select import_id into c_new from public.courses where id = new.course_id;
  end if;
  if (c_old is not null and public.curriculum_import_is_frozen(c_old)) or (c_new is not null and public.curriculum_import_is_frozen(c_new)) then
    raise exception 'This curriculum is published and cannot be edited; create a new import instead.' using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end $$;

create trigger guard_frozen before insert or update or delete on public.courses for each row execute function public.guard_frozen_by_import();
create trigger guard_frozen before insert or update or delete on public.program_outcomes for each row execute function public.guard_frozen_by_import();
create trigger guard_frozen before insert or update or delete on public.other_curriculum_items for each row execute function public.guard_frozen_by_import();
create trigger guard_frozen before insert or update or delete on public.course_outcomes for each row execute function public.guard_frozen_by_course();
create trigger guard_frozen before insert or update or delete on public.course_units for each row execute function public.guard_frozen_by_course();
create trigger guard_frozen before insert or update or delete on public.unit_topics for each row execute function public.guard_frozen_by_course();
create trigger guard_frozen before insert or update or delete on public.lab_experiments for each row execute function public.guard_frozen_by_course();
create trigger guard_frozen before insert or update or delete on public.course_skill_mappings for each row execute function public.guard_frozen_by_course();
create trigger guard_frozen before insert or update or delete on public.course_outcome_skill_mappings for each row execute function public.guard_frozen_by_course();

create function public.guard_import_lifecycle() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('PUBLISHED', 'ARCHIVED') then
      raise exception 'A published curriculum is never deleted; archive it instead.' using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if old.status = new.status then
    if old.status in ('PUBLISHED', 'ARCHIVED') and (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
      raise exception 'A % curriculum import cannot be modified.', lower(old.status) using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if not (
    (old.status = 'DRAFT' and new.status = 'EXTRACTED') or
    (old.status = 'EXTRACTED' and new.status = 'UNDER_REVIEW') or
    (old.status = 'UNDER_REVIEW' and new.status in ('CONFIRMED', 'EXTRACTED')) or
    (old.status = 'CONFIRMED' and new.status in ('PUBLISHED', 'UNDER_REVIEW')) or
    (old.status = 'PUBLISHED' and new.status = 'ARCHIVED')
  ) then
    raise exception 'Invalid curriculum status change: % -> %.', old.status, new.status using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger guard_lifecycle before update or delete on public.curriculum_imports for each row execute function public.guard_import_lifecycle();

create function public.guard_version_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'Curriculum versions are immutable.' using errcode = 'check_violation';
end $$;
create trigger guard_immutable before update or delete on public.curriculum_versions for each row execute function public.guard_version_immutable();

-- 5. Publish, atomically: version row + status flip + archive of the version this one supersedes
-- (same institution + branch + regulation; a different regulation coexists, since its students are a different cohort).
create function public.publish_curriculum_import(p_import_id uuid, p_user_id uuid) returns uuid
language plpgsql as $$
declare imp public.curriculum_imports; prev uuid; v_no integer; v_id uuid;
begin
  select * into imp from public.curriculum_imports where id = p_import_id and deleted_at is null for update;
  if not found then raise exception 'Curriculum import not found.' using errcode = 'no_data_found'; end if;
  if imp.status <> 'CONFIRMED' then raise exception 'Only a confirmed import can be published (it is %).', imp.status using errcode = 'check_violation'; end if;
  if not exists (select 1 from public.courses where import_id = p_import_id) then raise exception 'An import with no courses cannot be published.' using errcode = 'check_violation'; end if;

  select id into prev from public.curriculum_imports
   where institution_id = imp.institution_id and branch_key = imp.branch_key and coalesce(regulation, '') = coalesce(imp.regulation, '')
     and status = 'PUBLISHED' and id <> imp.id and deleted_at is null
   for update;
  if prev is not null then update public.curriculum_imports set status = 'ARCHIVED' where id = prev; end if;

  select coalesce(max(version_no), 0) + 1 into v_no from public.curriculum_versions
   where institution_id = imp.institution_id and branch_key = imp.branch_key and coalesce(regulation, '') = coalesce(imp.regulation, '');
  insert into public.curriculum_versions (import_id, institution_id, branch_key, regulation, version_no, published_by)
    values (imp.id, imp.institution_id, imp.branch_key, imp.regulation, v_no, p_user_id) returning id into v_id;
  update public.curriculum_imports
     set status = 'PUBLISHED', published_at = now(), reviewed_by = coalesce(reviewed_by, p_user_id), supersedes_import_id = prev
   where id = imp.id;
  return v_id;
end $$;
revoke execute on function public.publish_curriculum_import(uuid, uuid) from public, anon, authenticated;
grant execute on function public.publish_curriculum_import(uuid, uuid) to service_role;

-- 6. Authority.
alter table public.curriculum_imports enable row level security;
alter table public.curriculum_versions enable row level security;
alter table public.courses enable row level security;
alter table public.course_outcomes enable row level security;
alter table public.course_units enable row level security;
alter table public.unit_topics enable row level security;
alter table public.lab_experiments enable row level security;
alter table public.program_outcomes enable row level security;
alter table public.other_curriculum_items enable row level security;
alter table public.course_skill_mappings enable row level security;
alter table public.course_outcome_skill_mappings enable row level security;
revoke all on public.curriculum_imports, public.curriculum_versions, public.courses, public.course_outcomes, public.course_units,
  public.unit_topics, public.lab_experiments, public.program_outcomes, public.other_curriculum_items,
  public.course_skill_mappings, public.course_outcome_skill_mappings from anon, authenticated;

-- 7. Backfill: each (institution, branch) of legacy subjects becomes one PUBLISHED v1 import. They were already live to students,
-- so publishing keeps their status. Legacy mappings carry over as official: 'admin' -> MANUAL, 'ai_suggestion_confirmed' -> COLLEGE_CONFIRMED.
-- importance / confidence are left NULL: the legacy data never recorded them.
do $$
declare g record; imp uuid;
begin
  for g in
    select institution_id, lower(btrim(branch)) as bk, (array_agg(branch order by created_at))[1] as branch,
           (array_agg(created_by) filter (where created_by is not null))[1] as created_by
    from public.curriculum_subjects group by institution_id, lower(btrim(branch))
  loop
    insert into public.curriculum_imports (institution_id, branch, status, extraction_summary, created_by)
      values (g.institution_id, g.branch, 'CONFIRMED', jsonb_build_object('backfilled_from', 'curriculum_subjects'), g.created_by)
      returning id into imp;
    insert into public.courses (import_id, year, semester, course_code, title, kind, legacy_subject_id, sort_order)
      select imp, s.year, s.semester, s.code, s.name, 'course', s.id, row_number() over (order by s.year, s.semester nulls last, s.name)
      from public.curriculum_subjects s where s.institution_id = g.institution_id and lower(btrim(s.branch)) = g.bk;
    insert into public.course_skill_mappings (course_id, skill_id, mapping_source, evidence_source, status, created_by, approved_by, approved_at)
      select c.id, a.skill_id, case m.source when 'admin' then 'MANUAL' else 'COLLEGE_CONFIRMED' end,
             'Backfilled from the legacy subject mapping (' || m.role_key || '/' || m.area_key || ')', 'CONFIRMED', m.confirmed_by, m.confirmed_by, m.confirmed_at
      from public.curriculum_subject_skill_map m
      join public.courses c on c.legacy_subject_id = m.subject_id and c.import_id = imp
      join public.arena_skill_areas a on a.role_key = m.role_key and a.area_key = m.area_key and a.skill_id is not null;
    perform public.publish_curriculum_import(imp, null);
  end loop;
end $$;
