-- SkillStudio lessons (written lesson or explainer script) for a roadmap topic, written once by AI and kept, so the next student who opens the
-- same topic of the same role gets it from the database with no AI call. prompt_hash is the hash of the prompt that produced it: when the
-- topic's facts change (a rewritten roadmap), the hash no longer matches and the lesson is written again. Server only (service role).
create table public.skillstudio_lessons (
  career_id uuid not null references public.careers(id) on delete cascade,
  node_key text not null,
  kind text not null check (kind in ('theory', 'video')),
  prompt_hash text not null,
  content jsonb not null,
  generated_at timestamptz not null default now(),
  primary key (career_id, node_key, kind)
);
alter table public.skillstudio_lessons enable row level security;
revoke all on public.skillstudio_lessons from anon, authenticated;
