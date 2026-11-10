-- A CRT cycle opens and closes at an exact time the placement cell sets, not on whole days. Students receive the assessment only from opens_at.
alter table public.crt_cycles add column if not exists opens_at timestamptz;
alter table public.crt_cycles add column if not exists closes_at timestamptz;
-- existing cycles: from the start of the first day to the end of the last day, India time
update public.crt_cycles set opens_at = (opens_on::timestamp at time zone 'Asia/Kolkata') where opens_at is null;
update public.crt_cycles set closes_at = (((closes_on + 1)::timestamp at time zone 'Asia/Kolkata') - interval '1 second') where closes_at is null;
alter table public.crt_cycles alter column opens_at set not null;
alter table public.crt_cycles alter column closes_at set not null;
-- the whole-day columns stay as the India dates of those instants; a same-day window is now allowed
alter table public.crt_cycles drop constraint if exists crt_cycles_check;
alter table public.crt_cycles add constraint crt_cycles_window_check check (closes_at > opens_at);
alter table public.crt_cycles alter column duration_minutes drop default;
alter table public.crt_cycles drop constraint if exists crt_cycles_duration_minutes_check;
create index if not exists crt_cycles_opens_at_idx on public.crt_cycles (college_id, opens_at desc);
