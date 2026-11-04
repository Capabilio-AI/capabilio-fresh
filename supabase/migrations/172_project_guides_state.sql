-- Guides are written in the background; these two columns say "someone is writing it right now" (so a hundred students opening the same project start one
-- writer, not a hundred) and "the last attempt failed" (so the page can say so at once instead of waiting).
alter table public.project_guides add column if not exists generating_since timestamptz;
alter table public.project_guides add column if not exists last_error text;
