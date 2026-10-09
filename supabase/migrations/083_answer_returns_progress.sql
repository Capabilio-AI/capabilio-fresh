-- The answer call now returns the session id and progress counters itself, so answering costs one database round trip instead of four.
create or replace function public.record_assessment_answer(
  p_student uuid, p_session_question uuid, p_attempt uuid, p_displayed_index int, p_response_ms int
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  sq public.assess_session_questions%rowtype;
  s public.assess_sessions%rowtype;
  q public.assess_question_pool%rowtype;
  v_resp public.assess_responses%rowtype;
  v_original int; v_correct boolean; v_elo jsonb; v_correct_displayed int; v_answered int; v_result jsonb;
begin
  select * into sq from public.assess_session_questions where id = p_session_question for update;
  if not found then raise exception 'question_not_found'; end if;
  select * into s from public.assess_sessions where id = sq.session_id;
  if s.student_id <> p_student then raise exception 'question_not_found'; end if;
  select * into q from public.assess_question_pool where id = sq.pool_question_id;
  v_correct_displayed := array_position(sq.option_order, q.correct_index::smallint) - 1;

  select * into v_resp from public.assess_responses where session_question_id = sq.id;
  if found then
    select jsonb_build_object('eventId', e.id, 'previous', e.previous_rating, 'change', e.change, 'newRating', e.new_rating)
      into v_elo from public.elo_events e where e.id = v_resp.elo_event_id;
    select count(*) into v_answered from public.assess_responses where session_id = s.id;
    return jsonb_build_object(
      'alreadyAnswered', true, 'isCorrect', v_resp.is_correct,
      'chosenIndex', array_position(sq.option_order, v_resp.chosen_index::smallint) - 1,
      'correctIndex', v_correct_displayed, 'explanation', q.explanation, 'elo', v_elo,
      'sessionId', s.id, 'layer', s.layer, 'total', s.total_questions, 'answeredCount', v_answered);
  end if;

  if s.status <> 'IN_PROGRESS' then raise exception 'session_closed'; end if;
  if sq.state <> 'SERVED' then raise exception 'question_not_served'; end if;
  if p_displayed_index is null or p_displayed_index < 0 or p_displayed_index >= array_length(sq.option_order, 1) then
    raise exception 'invalid_option';
  end if;

  v_original := sq.option_order[p_displayed_index + 1];
  v_correct := (v_original = q.correct_index);

  insert into public.assess_responses (session_id, session_question_id, attempt_id, chosen_index, is_correct, response_ms)
  values (s.id, sq.id, p_attempt, v_original, v_correct, p_response_ms) returning * into v_resp;

  insert into public.student_skill_evidence (student_id, career_id, skill_id, skill_label, source, source_id, correct, difficulty, response_ms)
  values (p_student, s.career_id, q.skill_id, q.skill_name,
          case when s.layer = 'CAREER' then 'ASSESSMENT_CAREER' else 'ASSESSMENT_GENERAL' end, v_resp.id, v_correct, q.difficulty, p_response_ms);

  if s.layer = 'CAREER' then
    v_elo := public.apply_elo_event(p_student, s.career_id, 'ASSESSMENT', v_resp.id, v_correct, 'career assessment answer');
    update public.assess_responses set elo_event_id = (v_elo->>'eventId')::uuid where id = v_resp.id;
  end if;

  select count(*) into v_answered from public.assess_responses where session_id = s.id;
  return jsonb_build_object('alreadyAnswered', false, 'isCorrect', v_correct, 'chosenIndex', p_displayed_index,
                            'correctIndex', v_correct_displayed, 'explanation', q.explanation, 'elo', v_elo,
                            'sessionId', s.id, 'layer', s.layer, 'total', s.total_questions, 'answeredCount', v_answered);
end $$;
