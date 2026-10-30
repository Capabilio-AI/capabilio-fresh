-- Atomic Stream challenge submission. The route falls back to the old read-modify-write path if this function is missing.
-- One transaction, serialised per (student, challenge): records the completion without ever downgrading is_correct, reports whether THIS call
-- flipped it to correct (the only call that awards), and bumps arena_stream_stats with SQL arithmetic so concurrent awards cannot lose updates.
-- Streak maths mirrors lib/arena-challenges/streak.ts (advance at most once per Monday week, consecutive week = +1, else reset to 1).
create or replace function public.record_stream_completion(
  p_user_id uuid, p_challenge_id uuid, p_scope_key text, p_submission text,
  p_is_correct boolean, p_points integer, p_week date, p_once boolean default false
) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare
  v_prev boolean;
  v_exists boolean;
  v_award boolean;
  v_points integer := greatest(0, coalesce(p_points, 0));
  v_id uuid;
  v_now timestamptz := now();
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_challenge_id::text, 0));

  select is_correct, true into v_prev, v_exists from public.arena_challenge_completions where user_id = p_user_id and challenge_id = p_challenge_id;
  if coalesce(v_exists, false) and p_once then
    return jsonb_build_object('conflict', true, 'awarded', false);
  end if;

  v_award := p_is_correct and not coalesce(v_prev, false);

  insert into public.arena_challenge_completions (user_id, challenge_id, track, scope_key, code_submitted, is_correct, elo_delta, completed_at)
  values (p_user_id, p_challenge_id, 'stream', p_scope_key, p_submission, p_is_correct, case when v_award then v_points else 0 end, v_now)
  on conflict (user_id, challenge_id) do update set
    code_submitted = excluded.code_submitted,
    is_correct = public.arena_challenge_completions.is_correct or excluded.is_correct,
    elo_delta = case when v_award then v_points else public.arena_challenge_completions.elo_delta end,
    completed_at = excluded.completed_at
  returning id into v_id;

  if v_award then
    insert into public.arena_stream_stats (user_id, points, tasks_completed, current_streak, longest_streak, last_completed_week, updated_at)
    values (p_user_id, v_points, 1, 1, 1, p_week, v_now)
    on conflict (user_id) do update set
      points = public.arena_stream_stats.points + v_points,
      tasks_completed = public.arena_stream_stats.tasks_completed + 1,
      current_streak = case
        when public.arena_stream_stats.last_completed_week = p_week then public.arena_stream_stats.current_streak
        when public.arena_stream_stats.last_completed_week = p_week - 7 then public.arena_stream_stats.current_streak + 1
        else 1 end,
      longest_streak = greatest(public.arena_stream_stats.longest_streak, case
        when public.arena_stream_stats.last_completed_week = p_week then public.arena_stream_stats.current_streak
        when public.arena_stream_stats.last_completed_week = p_week - 7 then public.arena_stream_stats.current_streak + 1
        else 1 end),
      last_completed_week = p_week,
      updated_at = v_now;
  end if;

  return jsonb_build_object('conflict', false, 'awarded', v_award, 'completion_id', v_id);
end;
$$;
revoke execute on function public.record_stream_completion(uuid, uuid, text, text, boolean, integer, date, boolean) from public, anon, authenticated;
grant execute on function public.record_stream_completion(uuid, uuid, text, text, boolean, integer, date, boolean) to service_role;
