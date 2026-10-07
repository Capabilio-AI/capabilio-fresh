-- Visual roadmap: curriculum overlay data. ADDITIVE.
-- * course_outcomes.source: where an outcome came from. EXTRACTED = printed in the syllabus; INFERRED = derived by Capabilio from objectives/units/topics/labs
--   when the syllabus prints none (never presented as official college text); COLLEGE_CONFIRMED = a college edited or confirmed it.
-- * courses.source_page_start/end: the PDF pages a course section was read from. skills_analysed_at: the course has been run through skill analysis
--   (even if nothing mapped), so "no mapping" can be told apart from "never analysed" (UNKNOWN coverage). derived_outcomes_at: outcome derivation was attempted.
-- * curriculum_imports.enrichment: progress of the automatic analysis that follows extraction.
-- * unit_skill_mappings: skills taught by a specific unit (same rules as course/outcome mappings: an AI suggestion can never be CONFIRMED; frozen with a published import).
alter table public.course_outcomes add column source text not null default 'EXTRACTED' check (source in ('EXTRACTED', 'INFERRED', 'COLLEGE_CONFIRMED'));
alter table public.courses
  add column source_page_start smallint check (source_page_start is null or source_page_start >= 1),
  add column source_page_end smallint check (source_page_end is null or source_page_end >= 1),
  add column derived_outcomes_at timestamptz,
  add column skills_analysed_at timestamptz;
alter table public.curriculum_imports add column enrichment jsonb not null default '{}';

create table public.unit_skill_mappings (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null,
  course_id uuid not null,
  skill_id uuid not null references public.skills(id),
  mapping_source text not null check (mapping_source in ('AI_SUGGESTED', 'COLLEGE_CONFIRMED', 'MANUAL', 'SYSTEM')),
  confidence numeric(3, 2) check (confidence is null or confidence between 0 and 1),
  evidence_source text,
  status text not null default 'SUGGESTED' check (status in ('SUGGESTED', 'CONFIRMED', 'REJECTED')),
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (unit_id, course_id) references public.course_units(id, course_id) on delete cascade,
  unique (unit_id, skill_id),
  constraint unit_mapping_ai_never_official check (not (mapping_source = 'AI_SUGGESTED' and status = 'CONFIRMED')),
  constraint unit_mapping_confirmed_has_approval check (status <> 'CONFIRMED' or approved_at is not null)
);
create index unit_skill_mappings_by_course on public.unit_skill_mappings (course_id);
create index unit_skill_mappings_by_skill on public.unit_skill_mappings (skill_id, status);
create trigger set_updated_at before update on public.unit_skill_mappings for each row execute function public.set_updated_at();
create trigger guard_frozen before insert or update or delete on public.unit_skill_mappings for each row execute function public.guard_frozen_by_course();
alter table public.unit_skill_mappings enable row level security;
revoke all on public.unit_skill_mappings from anon, authenticated;
