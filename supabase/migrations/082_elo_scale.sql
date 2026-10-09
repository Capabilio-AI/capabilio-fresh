-- Arena rewards harder challenges more. The rule table stays the single source of the base delta; a caller may pass a scale
-- (1 for assessment answers) that multiplies it. The floor and the ledger invariants are unchanged.
drop function if exists public.apply_elo_event(uuid, uuid, text, uuid, boolean, text);

create function public.apply_elo_event(
  p_student uuid, p_career uuid, p_source text, p_source_id uuid, p_correct boolean, p_reason text default null, p_scale numeric default 1.0
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_rule public.elo_rules%rowtype;
  v_prev int; v_new int; v_change int; v_event public.elo_events%rowtype;
begin
  if p_scale is null or p_scale <= 0 then raise exception 'invalid_scale'; end if;
  select * into v_rule from public.elo_rules where source = p_source;
  if not found then raise exception 'no elo rule for source %', p_source; end if;

  insert into public.student_career_elo (student_id, career_id) values (p_student, p_career) on conflict do nothing;
  select rating into v_prev from public.student_career_elo where student_id = p_student and career_id = p_career for update;

  select * into v_event from public.elo_events where source = p_source and source_id = p_source_id;
  if found then
    return jsonb_build_object('eventId', v_event.id, 'previous', v_event.previous_rating, 'change', v_event.change,
                              'newRating', v_event.new_rating, 'replayed', true);
  end if;

  v_change := round((case when p_correct then v_rule.correct_delta else v_rule.incorrect_delta end)
                    * v_rule.difficulty_multiplier * v_rule.performance_multiplier * p_scale);
  v_new := greatest(v_rule.min_rating, v_prev + v_change);
  v_change := v_new - v_prev;

  insert into public.elo_events (student_id, career_id, source, source_id, previous_rating, change, new_rating, reason)
  values (p_student, p_career, p_source, p_source_id, v_prev, v_change, v_new, p_reason) returning * into v_event;
  update public.student_career_elo set rating = v_new, updated_at = now() where student_id = p_student and career_id = p_career;

  return jsonb_build_object('eventId', v_event.id, 'previous', v_prev, 'change', v_change, 'newRating', v_new, 'replayed', false);
end $$;
revoke all on function public.apply_elo_event(uuid, uuid, text, uuid, boolean, text, numeric) from public, anon, authenticated;
