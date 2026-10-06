-- Phase 4a: editing support for curriculum imports (docs/curriculum-roadmap-v2-progress.md).
-- ADDITIVE: soft delete for courses, atomic "save the whole course" and "merge courses" functions, and publish ignoring deleted courses.
-- Authority is unchanged: service role only. Functions are SECURITY INVOKER; the frozen-import triggers from 048 still apply to every write.

alter table public.courses add column deleted_at timestamptz;

-- A removed course must not block re-adding one with the same title; uniqueness now covers live courses only.
drop index public.courses_unique_title;
create unique index courses_unique_title on public.courses (import_id, year, lower(btrim(title))) where deleted_at is null;

-- Saves one course and its whole tree in ONE transaction. Outcomes and units are matched by code / number so the mappings on them survive an edit;
-- an outcome or unit missing from the payload is removed (its mappings go with it).
create function public.replace_course_tree(p_course_id uuid, p_tree jsonb) returns void
language plpgsql set search_path = public, pg_temp as $$
declare u jsonb; v_unit uuid;
begin
  update public.courses set
    year = coalesce((p_tree->>'year')::smallint, year),
    semester = case when p_tree ? 'semester' then (p_tree->>'semester')::smallint else semester end,
    title = coalesce(nullif(btrim(p_tree->>'title'), ''), title),
    course_code = case when p_tree ? 'course_code' then nullif(btrim(p_tree->>'course_code'), '') else course_code end,
    category = case when p_tree ? 'category' then nullif(btrim(p_tree->>'category'), '') else category end,
    kind = coalesce(p_tree->>'kind', kind),
    lecture_hours = case when p_tree ? 'lecture_hours' then (p_tree->>'lecture_hours')::numeric else lecture_hours end,
    tutorial_hours = case when p_tree ? 'tutorial_hours' then (p_tree->>'tutorial_hours')::numeric else tutorial_hours end,
    practical_hours = case when p_tree ? 'practical_hours' then (p_tree->>'practical_hours')::numeric else practical_hours end,
    credits = case when p_tree ? 'credits' then (p_tree->>'credits')::numeric else credits end,
    prerequisites = case when p_tree ? 'prerequisites' then nullif(btrim(p_tree->>'prerequisites'), '') else prerequisites end,
    objectives = case when p_tree ? 'objectives' then coalesce(array(select jsonb_array_elements_text(p_tree->'objectives')), '{}') else objectives end,
    textbooks = case when p_tree ? 'textbooks' then array(select jsonb_array_elements_text(p_tree->'textbooks')) else textbooks end,
    reference_books = case when p_tree ? 'reference_books' then array(select jsonb_array_elements_text(p_tree->'reference_books')) else reference_books end,
    online_resources = case when p_tree ? 'online_resources' then array(select jsonb_array_elements_text(p_tree->'online_resources')) else online_resources end,
    is_elective = coalesce((p_tree->>'is_elective')::boolean, is_elective),
    is_lab = coalesce((p_tree->>'is_lab')::boolean, is_lab)
  where id = p_course_id and deleted_at is null;
  if not found then raise exception 'Course not found.' using errcode = 'no_data_found'; end if;

  if p_tree ? 'outcomes' then
    delete from public.course_outcomes where course_id = p_course_id
      and code not in (select e->>'code' from jsonb_array_elements(p_tree->'outcomes') e);
    insert into public.course_outcomes (course_id, code, text, bloom_level, sort_order)
      select p_course_id, e->>'code', e->>'text', nullif(e->>'bloom_level', ''), (o.ord - 1)::int
      from jsonb_array_elements(p_tree->'outcomes') with ordinality as o(e, ord)
    on conflict (course_id, code) do update set text = excluded.text, bloom_level = excluded.bloom_level, sort_order = excluded.sort_order;
  end if;

  if p_tree ? 'units' then
    delete from public.course_units where course_id = p_course_id
      and unit_no not in (select (e->>'unit_no')::smallint from jsonb_array_elements(p_tree->'units') e);
    delete from public.unit_topics where course_id = p_course_id;
    for u in select e from jsonb_array_elements(p_tree->'units') e loop
      insert into public.course_units (course_id, unit_no, title, hours)
        values (p_course_id, (u->>'unit_no')::smallint, u->>'title', nullif(u->>'hours', '')::numeric)
        on conflict (course_id, unit_no) do update set title = excluded.title, hours = excluded.hours
        returning id into v_unit;
      insert into public.unit_topics (unit_id, course_id, text, sort_order)
        select v_unit, p_course_id, t.val, (t.ord - 1)::int from jsonb_array_elements_text(coalesce(u->'topics', '[]'::jsonb)) with ordinality as t(val, ord);
    end loop;
  end if;

  if p_tree ? 'experiments' then
    delete from public.lab_experiments where course_id = p_course_id;
    insert into public.lab_experiments (course_id, text, sort_order)
      select p_course_id, t.val, (t.ord - 1)::int from jsonb_array_elements_text(p_tree->'experiments') with ordinality as t(val, ord);
  end if;
end $$;

-- Order-preserving de-duplication of a text array (first occurrence wins).
create function public.array_dedupe(p_arr text[]) returns text[]
language sql immutable set search_path = public, pg_temp as $$
  select coalesce(array(select x from (select x, min(ord) as ord from unnest(p_arr) with ordinality as a(x, ord) group by x) q order by ord), '{}')
$$;

-- Merges the source course INTO the target (same import): appends outcomes, units (with topics), experiments, objectives and books,
-- then soft-deletes the source. Skill mappings are NOT carried over — suggest/confirm again on the merged course.
create function public.merge_courses(p_source uuid, p_target uuid) returns void
language plpgsql set search_path = public, pg_temp as $$
declare s public.courses; t public.courses; co_off int; unit_off int; lab_off int; u record; v_unit uuid;
begin
  select * into s from public.courses where id = p_source and deleted_at is null for update;
  select * into t from public.courses where id = p_target and deleted_at is null for update;
  if s.id is null or t.id is null then raise exception 'Course not found.' using errcode = 'no_data_found'; end if;
  if s.id = t.id or s.import_id <> t.import_id then raise exception 'Courses must be different and in the same curriculum.' using errcode = 'check_violation'; end if;

  select coalesce(max((regexp_match(code, '(\d+)$'))[1]::int), 0) into co_off from public.course_outcomes where course_id = t.id;
  insert into public.course_outcomes (course_id, code, text, bloom_level, sort_order)
    select t.id, 'CO' || (co_off + row_number() over (order by sort_order, code)), text, bloom_level, co_off + (row_number() over (order by sort_order, code))::int
    from public.course_outcomes where course_id = s.id;

  select coalesce(max(unit_no), 0) into unit_off from public.course_units where course_id = t.id;
  for u in select * from public.course_units where course_id = s.id order by unit_no loop
    insert into public.course_units (course_id, unit_no, title, hours) values (t.id, unit_off + u.unit_no, u.title, u.hours) returning id into v_unit;
    insert into public.unit_topics (unit_id, course_id, text, sort_order) select v_unit, t.id, text, sort_order from public.unit_topics where unit_id = u.id;
  end loop;

  select coalesce(max(sort_order), -1) + 1 into lab_off from public.lab_experiments where course_id = t.id;
  insert into public.lab_experiments (course_id, text, sort_order) select t.id, text, lab_off + sort_order from public.lab_experiments where course_id = s.id;

  update public.courses set
    objectives = public.array_dedupe(coalesce(t.objectives, '{}') || coalesce(s.objectives, '{}')),
    textbooks = nullif(public.array_dedupe(coalesce(t.textbooks, '{}') || coalesce(s.textbooks, '{}')), '{}'),
    reference_books = nullif(public.array_dedupe(coalesce(t.reference_books, '{}') || coalesce(s.reference_books, '{}')), '{}'),
    online_resources = nullif(public.array_dedupe(coalesce(t.online_resources, '{}') || coalesce(s.online_resources, '{}')), '{}')
  where id = t.id;
  update public.courses set deleted_at = now() where id = s.id;
end $$;

revoke execute on function public.replace_course_tree(uuid, jsonb), public.merge_courses(uuid, uuid), public.array_dedupe(text[]) from public, anon, authenticated;
grant execute on function public.replace_course_tree(uuid, jsonb), public.merge_courses(uuid, uuid), public.array_dedupe(text[]) to service_role;

-- publish: a curriculum whose courses are all removed cannot be published.
create or replace function public.publish_curriculum_import(p_import_id uuid, p_user_id uuid) returns uuid
language plpgsql set search_path = public, pg_temp as $$
declare imp public.curriculum_imports; prev uuid; v_no integer; v_id uuid;
begin
  select * into imp from public.curriculum_imports where id = p_import_id and deleted_at is null for update;
  if not found then raise exception 'Curriculum import not found.' using errcode = 'no_data_found'; end if;
  if imp.status <> 'CONFIRMED' then raise exception 'Only a confirmed import can be published (it is %).', imp.status using errcode = 'check_violation'; end if;
  if not exists (select 1 from public.courses where import_id = p_import_id and deleted_at is null) then raise exception 'An import with no courses cannot be published.' using errcode = 'check_violation'; end if;

  select id into prev from public.curriculum_imports
   where institution_id = imp.institution_id and branch_key = imp.branch_key and coalesce(regulation, '') = coalesce(imp.regulation, '')
     and status = 'PUBLISHED' and id <> imp.id and deleted_at is null
   for update;
  if prev is not null then update public.curriculum_imports set status = 'ARCHIVED' where id = prev; end if;

  select coalesce(max(version_no), 0) + 1 into v_no from public.curriculum_versions
   where institution_id = imp.institution_id and branch_key = imp.branch_key and coalesce(regulation, '') = coalesce(imp.regulation, '');
  insert into public.curriculum_versions (import_id, institution_id, branch_key, regulation, version_no, published_by)
    values (imp.id, imp.institution_id, imp.branch_key, imp.regulation, v_no, p_user_id) returning id into v_id;
  update public.curriculum_imports
     set status = 'PUBLISHED', published_at = now(), reviewed_by = coalesce(reviewed_by, p_user_id), supersedes_import_id = prev
   where id = imp.id;
  return v_id;
end $$;
