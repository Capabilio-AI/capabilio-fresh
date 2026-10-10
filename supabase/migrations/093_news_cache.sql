-- Pulse news is fetched from its source API at most once per day per topic and shared by every student who needs it.
create table public.pulse_news_cache (
  cache_key text not null,
  day date not null,
  items jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now(),
  primary key (cache_key, day)
);
alter table public.pulse_news_cache enable row level security;
revoke all on public.pulse_news_cache from anon, authenticated;
