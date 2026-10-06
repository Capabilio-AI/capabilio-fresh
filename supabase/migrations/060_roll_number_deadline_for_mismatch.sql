-- A roll number that doesn't carry the college's code gets the same 7-day window as a missing one.
-- The clock starts when the student is first flagged, is not reset by entering another wrong number, and clears once the number matches.
create or replace function public.membership_roll_number_check()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  new.roll_number := nullif(upper(btrim(new.roll_number)), '');
  if new.role = 'student' and new.branch is not null then
    new.roll_number_status := coalesce(public.roll_number_status_for(new.institution_id, new.roll_number), 'unchecked');
  else
    new.roll_number_status := 'unchecked';
  end if;
  if new.roll_number_status = 'flagged' then
    new.roll_number_due_at := coalesce(case when tg_op = 'UPDATE' then old.roll_number_due_at end, now() + interval '7 days');
  else
    new.roll_number_due_at := null;
  end if;
  return new;
end;
$$;

-- start the clock for students already flagged (mismatched) before this rule
update public.institution_memberships set roll_number = roll_number where role = 'student' and roll_number_status = 'flagged' and roll_number_due_at is null;
