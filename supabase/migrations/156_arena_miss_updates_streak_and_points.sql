-- A ticket that closes without a pass (a wrong final answer, or time running out) now moves the same things a pass moves, in the same transaction as the rating:
-- the Domain streak and the Domain points shown on the leaderboard. Before this, apply_arena_miss changed only the two ratings, so the streak, the points on the
-- leaderboard and the stats never reflected a closed ticket.
-- tasks_completed is NOT touched: it counts passes. arena_attempt_completions is NOT written either: portfolio, proficiency levels, evidence and the org roster
-- read every row there as proof of a pass. The history lists a closed ticket from the ticket itself (arena_domain_assignments.miss_*).
-- p_streak has the same shape the pass path gives complete_workstation_attempt: {current_streak, longest_streak, last_completed_week}.
drop function if exists public.apply_arena_miss(uuid, uuid, int, int, text);

create or replace function public.apply_arena_miss(p_attempt uuid, p_career uuid, p_career_change int, p_area_change int, p_reason text default null, p_streak jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.arena_domain_assignments%rowtype;
  v_rule public.elo_rules%rowtype;
  v_start int; v_prev int; v_new int; v_career_change int; v_area_prev int; v_area_new int;
begin
  if p_career_change > 0 or p_area_change > 0 then raise exception 'a miss cannot raise a rating'; end if;
  select * into a from public.arena_domain_assignments where id = p_attempt for update;
  if not found then raise exception 'unknown attempt'; end if;
  if a.miss_career_change is not null then
    return jsonb_build_object('replayed', true, 'careerChange', a.miss_career_change, 'areaChange', a.miss_area_change);
  end if;

  select * into v_rule from public.elo_rules where source = 'ARENA';
  select start_rating into v_start from public.elo_rules where source = 'ASSESSMENT';
  insert into public.student_career_elo (student_id, career_id, rating) values (a.user_id, p_career, v_start) on conflict do nothing;
  select rating into v_prev from public.student_career_elo where student_id = a.user_id and career_id = p_career for update;
  v_new := greatest(v_rule.min_rating, v_prev + p_career_change);
  v_career_change := v_new - v_prev;
  if v_career_change <> 0 then
    insert into public.elo_events (student_id, career_id, source, source_id, previous_rating, change, new_rating, reason)
    values (a.user_id, p_career, 'ARENA', p_attempt, v_prev, v_career_change, v_new, p_reason);
    update public.student_career_elo set rating = v_new, updated_at = now() where student_id = a.user_id and career_id = p_career;
  end if;

  insert into public.arena_skill_ratings (user_id, role_key, area_key) values (a.user_id, a.role_key, a.skill_area_key) on conflict do nothing;
  select rating into v_area_prev from public.arena_skill_ratings where user_id = a.user_id and role_key = a.role_key and area_key = a.skill_area_key for update;
  v_area_new := greatest(0, v_area_prev + p_area_change);
  update public.arena_skill_ratings set rating = v_area_new, updated_at = now() where user_id = a.user_id and role_key = a.role_key and area_key = a.skill_area_key;

  -- the Domain stats row the leaderboard and the streak card read: points follow the area rating (as they do on a pass), the weekly streak advances
  if p_streak is not null then
    insert into public.arena_domain_stats (user_id, points, tasks_completed, current_streak, longest_streak, last_completed_week, updated_at)
    values (a.user_id, 0, 0, (p_streak->>'current_streak')::int, (p_streak->>'longest_streak')::int, (p_streak->>'last_completed_week')::date, now())
    on conflict (user_id) do update set
      points = greatest(0, public.arena_domain_stats.points + (v_area_new - v_area_prev)),
      current_streak = excluded.current_streak, longest_streak = excluded.longest_streak,
      last_completed_week = excluded.last_completed_week, updated_at = now();
  end if;

  update public.arena_domain_assignments set miss_career_change = v_career_change, miss_area_change = v_area_new - v_area_prev where id = p_attempt;
  return jsonb_build_object('replayed', false, 'careerChange', v_career_change, 'careerRating', v_new, 'areaChange', v_area_new - v_area_prev, 'areaRating', v_area_new);
end $$;
revoke all on function public.apply_arena_miss(uuid, uuid, int, int, text, jsonb) from public, anon, authenticated;
