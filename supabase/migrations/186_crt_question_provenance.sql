-- Every CRT question now records where it came from, so the source and its licence travel with it and a question can be traced or removed.
-- Existing questions are Capabilio's own (written by the bank generators). Imported ones carry the dataset, its licence and a link, and a
-- fingerprint so the same question is never stored twice.
alter table public.crt_questions
  add column if not exists source text not null default 'capabilio',
  add column if not exists source_license text,
  add column if not exists source_ref text,
  add column if not exists content_hash text;
create unique index if not exists crt_questions_content_hash_idx on public.crt_questions (content_hash) where content_hash is not null;
create index if not exists crt_questions_source_idx on public.crt_questions (source);
