-- Team chat for an institution's staff (anyone holding the 'chat' permission). Channels are open to all staff
-- or private to listed members. Server-mediated only: no client policies.
create table public.org_chat_channels (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  description text check (char_length(description) <= 200),
  is_private boolean not null default false,
  created_by_membership_id uuid references public.institution_memberships(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index org_chat_channels_name_idx on public.org_chat_channels (institution_id, lower(btrim(name)));

create table public.org_chat_channel_members (
  channel_id uuid not null references public.org_chat_channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create table public.org_chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.org_chat_channels(id) on delete cascade,
  author_user_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index org_chat_messages_channel_idx on public.org_chat_messages (channel_id, created_at desc);

create table public.org_chat_reads (
  channel_id uuid not null references public.org_chat_channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

do $$
declare t text;
begin
  foreach t in array array['org_chat_channels', 'org_chat_channel_members', 'org_chat_messages', 'org_chat_reads'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
