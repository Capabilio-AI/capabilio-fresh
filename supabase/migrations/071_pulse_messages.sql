-- Pulse, phase 2: direct messages with message requests, and live delivery.
-- Server-mediated like the rest of Pulse (no client policies on the tables); the only thing a browser may do directly is
-- LISTEN on its own private channel `user:<its id>`, which the server posts to after every write.
create table public.dm_conversations (
  id uuid primary key default gen_random_uuid(),
  user_lo uuid not null references public.profiles(id) on delete cascade,
  user_hi uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  last_message_at timestamptz not null default now(),
  last_message_preview text check (char_length(last_message_preview) <= 140),
  last_sender_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (user_lo < user_hi),
  check (requested_by in (user_lo, user_hi)),
  unique (user_lo, user_hi)
);
create index dm_conversations_lo_idx on public.dm_conversations (user_lo, last_message_at desc);
create index dm_conversations_hi_idx on public.dm_conversations (user_hi, last_message_at desc);

create table public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (deleted_at is not null or char_length(btrim(body)) between 1 and 2000)
);
create index dm_messages_conversation_idx on public.dm_messages (conversation_id, created_at desc);

create table public.dm_reads (
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

do $$
declare t text;
begin
  foreach t in array array['dm_conversations', 'dm_messages', 'dm_reads'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- A message can be reported too.
alter table public.pulse_reports drop constraint pulse_reports_target_type_check;
alter table public.pulse_reports add constraint pulse_reports_target_type_check check (target_type in ('user', 'post', 'comment', 'story', 'message'));

-- Live delivery: a person may only receive on their own channel; only the server (service role) may send.
create policy "receive on own user channel" on realtime.messages for select to authenticated
  using (realtime.topic() = 'user:' || (select auth.uid())::text);

create or replace function public.pulse_notify(p_user uuid, p_event text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform realtime.send(p_payload, p_event, 'user:' || p_user::text, true);
end;
$$;
revoke all on function public.pulse_notify(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.pulse_notify(uuid, text, jsonb) to service_role;
