-- Fix to 048: deleting an INSTITUTION must be able to remove its curriculum (org removal), even when published.
-- The "never delete a published import / immutable version" guards now stand down only when the owning institution row is already gone
-- (i.e. the delete is a cascade from the institution). A direct delete of a published import or a version is still refused.

create or replace function public.guard_import_lifecycle() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('PUBLISHED', 'ARCHIVED') and exists (select 1 from public.institutions where id = old.institution_id) then
      raise exception 'A published curriculum is never deleted; archive it instead.' using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if old.status = new.status then
    if old.status in ('PUBLISHED', 'ARCHIVED') and (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
      raise exception 'A % curriculum import cannot be modified.', lower(old.status) using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if not (
    (old.status = 'DRAFT' and new.status = 'EXTRACTED') or
    (old.status = 'EXTRACTED' and new.status = 'UNDER_REVIEW') or
    (old.status = 'UNDER_REVIEW' and new.status in ('CONFIRMED', 'EXTRACTED')) or
    (old.status = 'CONFIRMED' and new.status in ('PUBLISHED', 'UNDER_REVIEW')) or
    (old.status = 'PUBLISHED' and new.status = 'ARCHIVED')
  ) then
    raise exception 'Invalid curriculum status change: % -> %.', old.status, new.status using errcode = 'check_violation';
  end if;
  return new;
end $$;

create or replace function public.guard_version_immutable() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.institutions where id = old.institution_id) then
    return old;
  end if;
  raise exception 'Curriculum versions are immutable.' using errcode = 'check_violation';
end $$;
