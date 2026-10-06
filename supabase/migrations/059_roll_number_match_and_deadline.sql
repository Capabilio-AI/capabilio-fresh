-- Roll numbers carry the college code after the intake year (13AJ5A0405 -> "AJ"), not as a prefix.
-- A student with a college that has a code but NO roll number gets 7 days to add it; after that the cleanup job removes the account.

alter table public.institution_memberships add column if not exists roll_number_due_at timestamptz;

create or replace function public.roll_number_status_for(p_institution uuid, p_roll text)
returns text language sql stable security definer set search_path to '' as $$
  select case
    when i.college_code is null then 'unchecked'
    when p_roll is null then 'flagged'
    when upper(p_roll) ~ ('^[0-9]{0,4}' || i.college_code) then 'verified'
    else 'flagged'
  end
  from public.institutions i where i.id = p_institution;
$$;

create or replace function public.membership_roll_number_check()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  new.roll_number := nullif(upper(btrim(new.roll_number)), '');
  if new.role = 'student' and new.branch is not null then
    new.roll_number_status := coalesce(public.roll_number_status_for(new.institution_id, new.roll_number), 'unchecked');
  else
    new.roll_number_status := 'unchecked';
  end if;
  -- the clock starts the first time a roll number is found missing, never resets while it stays missing, and clears once one is given
  if new.roll_number_status = 'flagged' and new.roll_number is null then
    new.roll_number_due_at := coalesce(case when tg_op = 'UPDATE' then old.roll_number_due_at end, now() + interval '7 days');
  else
    new.roll_number_due_at := null;
  end if;
  return new;
end;
$$;

-- re-check everyone against the corrected rule (starts the 7-day clock only where a college already has a code and a student has no roll number)
update public.institution_memberships set roll_number = roll_number where role = 'student';
