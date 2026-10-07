-- Speeds up the global search's ilike '%q%' on college names (16k rows).
create index if not exists institutions_name_trgm on public.institutions using gin (name gin_trgm_ops);
