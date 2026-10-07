-- Run after 009_coach_review_inbox.sql. Safe to rerun.
-- Coaches can oversee invitees of the coaches they invited, recursively.
-- Direct assignments, libraries, account activation and training stay intact.
begin;
do $$ begin
 if to_regclass('public.workout_review_receipts') is null then
  raise exception 'Run 009_coach_review_inbox.sql first.';
 end if;
end $$;

create or replace function public.coach_manages_profile(target uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 with recursive crew(id) as (
  select id from public.profiles where id=auth.uid() and role='coach' and active
  union
  select link.athlete_id from crew
  join public.profiles manager on manager.id=crew.id and manager.role='coach'
  join public.coach_athletes link on link.coach_id=crew.id
 )
 select target<>auth.uid() and exists(select 1 from crew where id=target);
$$;
revoke all on function public.coach_manages_profile(uuid) from public,anon,authenticated;

create or replace function public.can_access_training(target uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active
  and (id=target or public.coach_manages_profile(target)));
$$;
revoke all on function public.can_access_training(uuid) from public,anon;
grant execute on function public.can_access_training(uuid) to authenticated;

create or replace function public.load_people() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',p.id,'name',p.name,'role',p.role,'active',p.active,
  'coachId',case when public.coach_manages_profile(p.id) then link.coach_id end,
  'coachName',case when public.coach_manages_profile(p.id) then coach.name end
 ) order by p.name,p.id),'[]'::jsonb)
 from public.profiles p
 left join public.coach_athletes link on link.athlete_id=p.id
 left join public.profiles coach on coach.id=link.coach_id
 where public.can_access_training(p.id);
$$;
revoke all on function public.load_people() from public,anon;
grant execute on function public.load_people() to authenticated;

-- Each coach keeps their own review receipts; opening a workout as the parent
-- coach does not mark it reviewed for the direct coach, or vice versa.
create or replace function public.load_review_inbox() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='coach' and active) then raise exception 'Coach access required' using errcode='42501'; end if;
 with eligible as (
  select e.*,p.name athlete_name,u.use_ab_split,
    coalesce(r.reviewed_version=e.version,false) reviewed,r.reviewed_at
  from public.workout_review_events e
  join public.profiles p on p.id=e.owner_user_id
  join public.user_settings u on u.owner_user_id=e.owner_user_id
  left join public.workout_review_receipts r on r.coach_id=auth.uid() and r.owner_user_id=e.owner_user_id and r.session_id=e.session_id
  where public.coach_manages_profile(e.owner_user_id) and e.notifiable and e.snapshot->>'status'='done'
 ), ranked as (
  select *,row_number() over(partition by owner_user_id,reviewed order by reviewed_at desc nulls last,updated_at desc,session_id) as pos from eligible
 )
 select coalesce(jsonb_agg(jsonb_build_object('ownerId',owner_user_id,'athleteName',athlete_name,'session',snapshot,'version',version,'completedAt',completed_at,'updatedAt',updated_at,'reviewed',reviewed,'reviewedAt',reviewed_at,'useABSplit',use_ab_split) order by updated_at desc,session_id),'[]'::jsonb)
 into result from ranked where not reviewed or pos<=3;
 return jsonb_build_object('items',result);
end $$;
revoke all on function public.load_review_inbox() from public,anon;
grant execute on function public.load_review_inbox() to authenticated;

create or replace function public.set_workout_review(target_owner uuid,target_session text,expected_version bigint,is_reviewed boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare event public.workout_review_events%rowtype;
begin
 if not public.coach_manages_profile(target_owner) then raise exception 'Coach access required' using errcode='42501'; end if;
 if is_reviewed is null or expected_version is null then raise exception 'Invalid review request'; end if;
 select * into event from public.workout_review_events where owner_user_id=target_owner and session_id=target_session for update;
 if not found or not event.notifiable or event.snapshot->>'status'<>'done' then raise exception 'This workout is no longer in the inbox'; end if;
 if event.version<>expected_version then raise exception 'Workout changed. Refresh the inbox before reviewing.' using errcode='40001'; end if;
 if is_reviewed then
   insert into public.workout_review_receipts(coach_id,owner_user_id,session_id,reviewed_version,reviewed_at)
   values(auth.uid(),target_owner,target_session,event.version,statement_timestamp())
   on conflict(coach_id,owner_user_id,session_id) do update set reviewed_version=excluded.reviewed_version,reviewed_at=excluded.reviewed_at;
 else
   delete from public.workout_review_receipts where coach_id=auth.uid() and owner_user_id=target_owner and session_id=target_session;
 end if;
end $$;
revoke all on function public.set_workout_review(uuid,text,bigint,boolean) from public,anon;
grant execute on function public.set_workout_review(uuid,text,bigint,boolean) to authenticated;
commit;
