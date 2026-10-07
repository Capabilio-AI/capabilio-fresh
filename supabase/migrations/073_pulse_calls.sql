-- Pulse, phase 4: one-to-one voice and video calls. Signalling travels over each person's private Realtime channel,
-- posted by the server after it checks both people belong to the call. This table is the call's state and history.
create table public.calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  caller_id uuid not null references public.profiles(id) on delete cascade,
  callee_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('voice', 'video')),
  status text not null default 'ringing' check (status in ('ringing', 'accepted', 'declined', 'cancelled', 'missed', 'ended')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds >= 0),
  check (caller_id <> callee_id)
);
create index calls_caller_idx on public.calls (caller_id, created_at desc);
create index calls_callee_idx on public.calls (callee_id, status, created_at desc);
create index calls_conversation_idx on public.calls (conversation_id, created_at desc);

alter table public.calls enable row level security;
revoke all on public.calls from anon, authenticated;

-- A call shows up in the conversation as a line ("Voice call · 4:32", "Missed video call").
alter table public.dm_messages add column kind text not null default 'text' check (kind in ('text', 'call'));
