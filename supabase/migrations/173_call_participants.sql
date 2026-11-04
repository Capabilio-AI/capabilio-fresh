-- Group calls: everyone in (or being rung for) a call has a row here. The first two rows are the caller (joined) and the person they rang;
-- anyone added during the call gets their own row. The call's own status still tells whether it is ringing, in progress or over.
create table public.call_participants (
  call_id uuid not null references public.calls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid references public.profiles(id) on delete set null,
  status text not null default 'ringing' check (status in ('ringing', 'joined', 'declined', 'left', 'missed')),
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  left_at timestamptz,
  primary key (call_id, user_id)
);
create index call_participants_user_idx on public.call_participants (user_id, status);
alter table public.call_participants enable row level security;
revoke all on public.call_participants from anon, authenticated;

-- people already in calls that exist today
insert into public.call_participants (call_id, user_id, invited_by, status, joined_at)
select id, caller_id, null, case when status = 'accepted' then 'joined' else 'left' end, answered_at from public.calls
on conflict do nothing;
insert into public.call_participants (call_id, user_id, invited_by, status, joined_at)
select id, callee_id, caller_id, case status when 'accepted' then 'joined' when 'ringing' then 'ringing' when 'declined' then 'declined' when 'ended' then 'left' else 'missed' end, answered_at from public.calls
on conflict do nothing;
