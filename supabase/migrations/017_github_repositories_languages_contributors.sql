-- Adds per-repo language breakdown and top-contributor evidence to
-- github_repositories, requested after the candidate view: repo owner is
-- already derivable from full_name (no column needed), but "what languages
-- / what percentage" and "who contributed what" were not previously
-- captured or stored at all.

alter table public.github_repositories
  add column languages jsonb not null default '[]',
  add column top_contributors jsonb not null default '[]';

comment on column public.github_repositories.languages is 'Array of {name, percentage} from the GitHub languages API, real bytes-based percentages.';
comment on column public.github_repositories.top_contributors is 'Array of {login, contributions} from the GitHub contributors API, sorted by contribution count.';
