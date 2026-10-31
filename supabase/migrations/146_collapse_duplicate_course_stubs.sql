-- A syllabus table row and the syllabus page of the same course were stored as two courses when the titles differed only by punctuation
-- ("Generative A.I" and "GENERATIVE AI"). Remove the content-less stub, but only when a twin with the same normalised title in the same
-- curriculum and year has content, and the stub carries no confirmed skill. Soft delete: the row stays recoverable.
update public.courses s
set deleted_at = now()
where s.deleted_at is null
  and not exists (select 1 from public.course_outcomes o where o.course_id = s.id)
  and not exists (select 1 from public.course_units u where u.course_id = s.id)
  and not exists (select 1 from public.lab_experiments l where l.course_id = s.id)
  and not exists (select 1 from public.course_skill_mappings m where m.course_id = s.id and m.status = 'CONFIRMED')
  and exists (
    select 1 from public.courses t
    where t.import_id = s.import_id and t.year = s.year and t.id <> s.id and t.deleted_at is null
      and lower(regexp_replace(t.title, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(s.title, '[^a-zA-Z0-9]', '', 'g'))
      and (exists (select 1 from public.course_outcomes o where o.course_id = t.id) or exists (select 1 from public.course_units u where u.course_id = t.id))
  );
