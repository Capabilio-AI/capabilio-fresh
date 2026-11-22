-- A Capabilio Proven Skill: a credential a student earns by proving every module of a track. It is signed (Ed25519) over the exact evidence it shows, so a changed
-- row no longer verifies, and anyone can check it with the published public key. Revocation and expiry are NOT signed: they change later, and the public
-- page reads them from this row. Service-role only like the other proof tables; the public page is a server route that reads by the unguessable code.
create table public.skill_credentials (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^CAP-[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('track')),
  subject text not null check (char_length(subject) between 1 and 40),
  subject_title text not null check (char_length(subject_title) between 1 and 120),
  level text not null check (char_length(level) between 1 and 40),
  -- the exact text that was signed (canonical JSON); the public page shows what is in it, nothing else
  payload text not null check (char_length(payload) between 2 and 20000),
  signature text not null check (char_length(signature) between 40 and 200),
  key_id text not null check (char_length(key_id) between 4 and 40),
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text check (revoked_reason is null or char_length(revoked_reason) between 3 and 300),
  revoked_by uuid references public.profiles(id) on delete set null,
  -- one credential per student per track: asking again returns the same one, and a revoked one is not quietly replaced
  unique (user_id, kind, subject),
  check ((revoked_at is null) = (revoked_reason is null))
);
create index skill_credentials_user_idx on public.skill_credentials (user_id);

alter table public.skill_credentials enable row level security;
revoke all on public.skill_credentials from anon, authenticated;
