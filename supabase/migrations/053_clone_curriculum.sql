-- Phase 4d: "create a new version". A published curriculum is frozen, so corrections happen on a COPY: an editable import (UNDER_REVIEW)
-- holding the same courses, outcomes, units, topics, labs, programme outcomes and skill mappings (statuses, sources and approvals kept).
-- Publishing the copy later archives the version it was made from (same institution + branch + regulation). ADDITIVE; service role only.

create function public.clone_curriculum_import(p_import_id uuid, p_user_id uuid) returns uuid
language plpgsql set search_path = public, pg_temp as $$
declare src public.curriculum_imports; v_new uuid;
begin
  select * into src from public.curriculum_imports where id = p_import_id and deleted_at is null;
  if not found then raise exception 'Curriculum not found.' using errcode = 'no_data_found'; end if;
  if src.status <> 'PUBLISHED' then raise exception 'Only a published curriculum can be copied into a new version.' using errcode = 'check_violation'; end if;
  if exists (
    select 1 from public.curriculum_imports
    where institution_id = src.institution_id and branch_key = src.branch_key and coalesce(regulation, '') = coalesce(src.regulation, '')
      and deleted_at is null and status not in ('PUBLISHED', 'ARCHIVED')
  ) then raise exception 'A new version of this curriculum is already in progress. Finish or delete it first.' using errcode = 'check_violation'; end if;

  insert into public.curriculum_imports (institution_id, branch, program, regulation, source_file_name, extraction_summary, extraction_model, extraction_version, status, created_by)
    values (src.institution_id, src.branch, src.program, src.regulation, src.source_file_name, src.extraction_summary, src.extraction_model, src.extraction_version, 'UNDER_REVIEW', p_user_id)
    returning id into v_new;

  create temporary table _cmap on commit drop as select id as old_id, gen_random_uuid() as new_id from public.courses where import_id = src.id and deleted_at is null;
  create temporary table _omap on commit drop as select o.id as old_id, gen_random_uuid() as new_id from public.course_outcomes o join _cmap c on c.old_id = o.course_id;
  create temporary table _umap on commit drop as select u.id as old_id, gen_random_uuid() as new_id from public.course_units u join _cmap c on c.old_id = u.course_id;

  insert into public.courses (id, import_id, year, semester, course_code, title, category, kind, lecture_hours, tutorial_hours, practical_hours, credits, prerequisites,
      prerequisite_course_ids, objectives, is_elective, is_lab, textbooks, reference_books, online_resources, provenance, sort_order)
    select m.new_id, v_new, c.year, c.semester, c.course_code, c.title, c.category, c.kind, c.lecture_hours, c.tutorial_hours, c.practical_hours, c.credits, c.prerequisites,
      coalesce(array(select pm.new_id from unnest(c.prerequisite_course_ids) p(old_id) join _cmap pm on pm.old_id = p.old_id), '{}'),
      c.objectives, c.is_elective, c.is_lab, c.textbooks, c.reference_books, c.online_resources, c.provenance, c.sort_order
    from public.courses c join _cmap m on m.old_id = c.id;

  insert into public.course_outcomes (id, course_id, code, text, bloom_level, sort_order, provenance)
    select om.new_id, cm.new_id, o.code, o.text, o.bloom_level, o.sort_order, o.provenance from public.course_outcomes o join _omap om on om.old_id = o.id join _cmap cm on cm.old_id = o.course_id;
  insert into public.course_units (id, course_id, unit_no, title, hours)
    select um.new_id, cm.new_id, u.unit_no, u.title, u.hours from public.course_units u join _umap um on um.old_id = u.id join _cmap cm on cm.old_id = u.course_id;
  insert into public.unit_topics (unit_id, course_id, text, sort_order)
    select um.new_id, cm.new_id, t.text, t.sort_order from public.unit_topics t join _umap um on um.old_id = t.unit_id join _cmap cm on cm.old_id = t.course_id;
  insert into public.lab_experiments (course_id, text, sort_order)
    select cm.new_id, l.text, l.sort_order from public.lab_experiments l join _cmap cm on cm.old_id = l.course_id;
  insert into public.program_outcomes (import_id, kind, code, text, sort_order) select v_new, kind, code, text, sort_order from public.program_outcomes where import_id = src.id;
  insert into public.other_curriculum_items (import_id, type, title, details) select v_new, type, title, details from public.other_curriculum_items where import_id = src.id;

  insert into public.course_skill_mappings (course_id, skill_id, mapping_source, confidence, importance, evidence_source, status, created_by, approved_by, approved_at)
    select cm.new_id, m.skill_id, m.mapping_source, m.confidence, m.importance, m.evidence_source, m.status, m.created_by, m.approved_by, m.approved_at
    from public.course_skill_mappings m join _cmap cm on cm.old_id = m.course_id;
  insert into public.course_outcome_skill_mappings (course_outcome_id, course_id, skill_id, mapping_source, confidence, importance, evidence_source, status, created_by, approved_by, approved_at)
    select om.new_id, cm.new_id, m.skill_id, m.mapping_source, m.confidence, m.importance, m.evidence_source, m.status, m.created_by, m.approved_by, m.approved_at
    from public.course_outcome_skill_mappings m join _omap om on om.old_id = m.course_outcome_id join _cmap cm on cm.old_id = m.course_id;

  return v_new;
end $$;
revoke execute on function public.clone_curriculum_import(uuid, uuid) from public, anon, authenticated;
grant execute on function public.clone_curriculum_import(uuid, uuid) to service_role;
