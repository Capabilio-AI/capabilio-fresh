-- 1. Work time. A ticket's clock runs only while the student has the workspace open, and it is kept on the ticket (their account), so closing the workspace
--    and coming back resumes where they stopped. The browser reports in every few seconds; the server adds at most the gap since the last report and
--    counts nothing across a longer gap, so a closed tab does not run the clock.
alter table public.arena_domain_assignments add column if not exists time_spent_seconds int not null default 0 check (time_spent_seconds >= 0);
alter table public.arena_domain_assignments add column if not exists last_beat_at timestamptz;

create or replace function public.beat_attempt_time(p_attempt uuid, p_user uuid) returns int language sql security definer set search_path = public as $$
  update public.arena_domain_assignments
  set time_spent_seconds = time_spent_seconds + case when last_beat_at is not null and now() - last_beat_at <= interval '45 seconds'
                                                     then least(45, extract(epoch from (now() - last_beat_at))::int) else 0 end,
      last_beat_at = now()
  where id = p_attempt and user_id = p_user and completed_at is null
  returning time_spent_seconds;
$$;
revoke all on function public.beat_attempt_time(uuid, uuid) from public, anon, authenticated;

-- 2. A final wrong answer. A submission is final, so a wrong one closes the ticket and lowers the rating exactly once. The size of the drop is worked out
--    from the answer itself by the caller (how much of it was wrong); this function only applies it, atomically and at most once per ticket, to the two
--    ratings a pass raises: the career ELO and the rating of the skill area. Neither goes below its floor.
alter table public.arena_domain_assignments add column if not exists miss_career_change int;
alter table public.arena_domain_assignments add column if not exists miss_area_change int;

create or replace function public.apply_arena_miss(p_attempt uuid, p_career uuid, p_career_change int, p_area_change int, p_reason text default null)
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

  update public.arena_domain_assignments set miss_career_change = v_career_change, miss_area_change = v_area_new - v_area_prev where id = p_attempt;
  return jsonb_build_object('replayed', false, 'careerChange', v_career_change, 'careerRating', v_new, 'areaChange', v_area_new - v_area_prev, 'areaRating', v_area_new);
end $$;
revoke all on function public.apply_arena_miss(uuid, uuid, int, int, text) from public, anon, authenticated;
