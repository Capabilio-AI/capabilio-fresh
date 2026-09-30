-- Syllabus-PDF extraction: staged candidate results, held until the admin confirms (docs/curriculum-pdf-extraction-audit.md).
--
-- Authority: identical to 033 — private to the service role. RLS enabled with NO policies and all privileges revoked from
-- anon/authenticated. Nothing here is a curriculum record; confirmed rows are written to curriculum_subjects /
-- curriculum_subject_skill_map through the existing admin API only. The uploaded PDF itself is never stored.

create table public.curriculum_extractions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  branch text not null check (char_length(btrim(branch)) between 1 and 200),
  role_key text not null,
  file_name text not null check (char_length(file_name) between 1 and 300),
  file_bytes integer not null check (file_bytes > 0),
  page_count integer,
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  chunks_done integer not null default 0,
  chunks_total integer not null default 0,
  error_code text check (error_code is null or error_code in ('no_text_layer', 'unrecognised_format', 'unreadable', 'ai_unavailable', 'internal')),
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index curriculum_extractions_lookup on public.curriculum_extractions (institution_id, created_by, created_at desc);

alter table public.curriculum_extractions enable row level security;
revoke all on public.curriculum_extractions from anon, authenticated;
