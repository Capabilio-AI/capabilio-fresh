-- Plans become Free / Pro / Elite. Old ids are mapped across so nobody who already picked is asked again.
alter table public.profiles drop constraint if exists profiles_plan_id_check;

update public.profiles set plan_id = case plan_id
  when 'launch' then 'free'
  when 'accelerate_monthly' then 'pro'
  when 'accelerate_quarterly' then 'pro'
  else plan_id end
where plan_id in ('launch', 'accelerate_monthly', 'accelerate_quarterly');

alter table public.profiles
  add constraint profiles_plan_id_check check (plan_id is null or plan_id in ('free', 'pro', 'elite'));
