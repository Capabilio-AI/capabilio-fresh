-- 088: the hot path of "Next" in ONE database call. If a question is already open it is returned as is; otherwise, when the prefetch buffer
-- was built after the student's latest answer (so it is already correct), its first row is promoted to SERVED and returned. In every other
-- case it answers NEEDS_PLAN and the application re-plans. Never exposes the answer key: only what a QuestionPayload may contain.
create or replace function public.serve_next_question(p_student uuid, p_session uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.assess_sessions%rowtype;
  v_answered int; v_last_answer timestamptz; v_row public.assess_session_questions%rowtype; v_status text := 'SERVED';
  v_pool public.assess_question_pool%rowtype; v_career text; v_secs int;
begin
  select * into s from public.assess_sessions where id = p_session and student_id = p_student;
  if not found then raise exception 'session_not_found'; end if;
  if s.status <> 'IN_PROGRESS' then raise exception 'session_closed'; end if;

  -- an open (served, unanswered) question wins: asking again returns the same one
  select sq.* into v_row from public.assess_session_questions sq
   where sq.session_id = p_session and sq.state = 'SERVED' and not exists (select 1 from public.assess_responses r where r.session_question_id = sq.id)
   order by sq.position desc limit 1;
  if found then
    v_status := 'OPEN';
  else
    select count(*), max(answered_at) into v_answered, v_last_answer from public.assess_responses where session_id = p_session;
    if v_answered >= s.total_questions then return jsonb_build_object('status', 'ENDED'); end if;
    select sq.* into v_row from public.assess_session_questions sq
     where sq.session_id = p_session and sq.state = 'QUEUED' order by sq.position limit 1;
    -- the career buffer is only trusted when every queued row postdates the last answer (adaptation may have moved on); the common assessment
    -- does not adapt, so its buffer is always valid
    if not found or (s.layer = 'CAREER' and exists (select 1 from public.assess_session_questions q2 where q2.session_id = p_session and q2.state = 'QUEUED' and v_last_answer is not null and q2.created_at <= v_last_answer)) then
      return jsonb_build_object('status', 'NEEDS_PLAN');
    end if;
    update public.assess_session_questions set state = 'SERVED', served_at = now() where id = v_row.id and state = 'QUEUED' returning * into v_row;
    if not found then return jsonb_build_object('status', 'NEEDS_PLAN'); end if;
  end if;

  select * into v_pool from public.assess_question_pool where id = v_row.pool_question_id;
  select c.name into v_career from public.careers c where c.id = s.career_id;
  v_secs := greatest(0, ceil(45 - extract(epoch from (now() - v_row.served_at))))::int;
  return jsonb_build_object(
    'status', v_status, 'layer', s.layer, 'total', s.total_questions, 'careerName', v_career,
    'row', jsonb_build_object('id', v_row.id, 'position', v_row.position, 'optionOrder', v_row.option_order, 'secondsLeft', least(45, v_secs)),
    'question', jsonb_build_object('skillName', v_pool.skill_name, 'category', v_pool.category, 'difficulty', v_pool.difficulty, 'type', v_pool.question_type,
                                   'text', v_pool.question_text, 'options', v_pool.options, 'estimatedSeconds', v_pool.estimated_seconds));
end $$;
revoke all on function public.serve_next_question(uuid, uuid) from public, anon, authenticated;
