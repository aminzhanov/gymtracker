-- Coach inbox: run once in Supabase SQL Editor after 007 or 008.
-- Existing completed sessions become a silent baseline. New completions and
-- later changes to notified workouts are tracked atomically with training saves.
-- Safe to run again; reviews and training revisions are preserved.
begin;
alter table public.user_settings add column if not exists language text not null default 'en' check(language in ('en','ru'));
create table if not exists public.workout_review_events (
 owner_user_id uuid not null references public.profiles(id) on delete cascade,
 session_id text not null,
 version bigint not null default 0 check(version>=0),
 notifiable boolean not null default false,
 snapshot jsonb not null,
 completed_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(owner_user_id,session_id)
);
create table if not exists public.workout_review_receipts (
 coach_id uuid not null references public.profiles(id) on delete cascade,
 owner_user_id uuid not null,
 session_id text not null,
 reviewed_version bigint not null,
 reviewed_at timestamptz not null default now(),
 primary key(coach_id,owner_user_id,session_id),
 foreign key(owner_user_id,session_id) references public.workout_review_events(owner_user_id,session_id) on delete cascade
);
alter table public.workout_review_events enable row level security;
alter table public.workout_review_receipts enable row level security;
revoke all on public.workout_review_events,public.workout_review_receipts from public,anon,authenticated;
grant all on public.workout_review_events,public.workout_review_receipts to service_role;

-- Internal snapshots omit creator metadata, so unrelated backup saves do not
-- generate a new review. No session FK: the atomic training RPC replaces rows.
create or replace function public._workout_review_snapshot(target_owner uuid,target_session text) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',s.id,'date',s.date,'name',s.name,'icon',s.icon,'week',s.week_type,'trainingWeek',s.training_week,'status',s.status,'difficulty',s.difficulty,'notes',s.notes,
 'exercises',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'exerciseId',e.exercise_id,'name',e.name,'kind',e.kind,'duration',e.duration,'notes',e.notes,'done',e.done,
 'sets',coalesce((select jsonb_agg(jsonb_build_object('id',z.id,'weight',z.weight_kg,'reps',z.reps,'done',z.done) order by z.position) from public.session_sets z where z.owner_user_id=e.owner_user_id and z.session_exercise_id=e.id),'[]'::jsonb)) order by e.position)
 from public.session_exercises e where e.owner_user_id=s.owner_user_id and e.session_id=s.id),'[]'::jsonb))
 from public.sessions s where s.owner_user_id=target_owner and s.id=target_session
$$;
revoke all on function public._workout_review_snapshot(uuid,text) from public,anon,authenticated;

create or replace function public._sync_workout_reviews(target_owner uuid,seed_baseline boolean default false) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare sid text; next_snapshot jsonb; previous public.workout_review_events%rowtype; done_now boolean; event_time timestamptz:=statement_timestamp();
begin
 for sid in select id from public.sessions where owner_user_id=target_owner loop
   next_snapshot:=public._workout_review_snapshot(target_owner,sid);
   done_now:=next_snapshot->>'status'='done';
   select * into previous from public.workout_review_events where owner_user_id=target_owner and session_id=sid for update;
   if not found then
     insert into public.workout_review_events(owner_user_id,session_id,version,notifiable,snapshot,completed_at,updated_at)
       values(target_owner,sid,case when done_now and not seed_baseline then 1 else 0 end,done_now and not seed_baseline,next_snapshot,case when done_now and not seed_baseline then event_time else null end,event_time);
   elsif not seed_baseline then
     if done_now and (previous.snapshot->>'status'<>'done' or (previous.notifiable and previous.snapshot is distinct from next_snapshot)) then
       update public.workout_review_events set version=previous.version+1,notifiable=true,snapshot=next_snapshot,
         completed_at=case when previous.snapshot->>'status'='done' and previous.notifiable then previous.completed_at else event_time end,
         updated_at=event_time where owner_user_id=target_owner and session_id=sid;
     elsif previous.snapshot is distinct from next_snapshot then
       update public.workout_review_events set snapshot=next_snapshot,updated_at=event_time where owner_user_id=target_owner and session_id=sid;
     end if;
   end if;
 end loop;
 delete from public.workout_review_events r where r.owner_user_id=target_owner and not exists(select 1 from public.sessions s where s.owner_user_id=target_owner and s.id=r.session_id);
end $$;
revoke all on function public._sync_workout_reviews(uuid,boolean) from public,anon,authenticated;

create or replace function public.load_review_inbox() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='coach' and active) then raise exception 'Coach access required' using errcode='42501'; end if;
 with eligible as (
  select e.*,p.name athlete_name,u.use_ab_split,
    coalesce(r.reviewed_version=e.version,false) reviewed,r.reviewed_at
  from public.workout_review_events e
  join public.coach_athletes a on a.athlete_id=e.owner_user_id and a.coach_id=auth.uid()
  join public.profiles p on p.id=e.owner_user_id
  join public.user_settings u on u.owner_user_id=e.owner_user_id
  left join public.workout_review_receipts r on r.coach_id=auth.uid() and r.owner_user_id=e.owner_user_id and r.session_id=e.session_id
  where e.notifiable and e.snapshot->>'status'='done'
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
 if not exists(select 1 from public.profiles p join public.coach_athletes a on a.coach_id=p.id where p.id=auth.uid() and p.role='coach' and p.active and a.athlete_id=target_owner) then raise exception 'Coach access required' using errcode='42501'; end if;
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
create or replace function public.load_training_data(target_owner uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; rev bigint;
begin
 if not public.can_access_training(target_owner) then raise exception 'Access denied' using errcode='42501'; end if;
 select revision into rev from public.user_settings where owner_user_id=target_owner;
 if rev is null then raise exception 'Profile is missing training settings'; end if;
 select jsonb_build_object('version',1,
 'settings',(select jsonb_build_object('name',display_name,'spikeThreshold',spike_threshold,'anchorDate',anchor_date,'anchorWeek',anchor_week,'useABSplit',use_ab_split,'language',language) from public.user_settings where owner_user_id=target_owner),
 'exercises',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'custom',custom) order by name) from public.exercises where owner_user_id=target_owner),'[]'::jsonb),
 'bodyweight',coalesce((select jsonb_agg(jsonb_build_object('date',date,'weight',weight_kg) order by date) from public.bodyweight_entries where owner_user_id=target_owner),'[]'::jsonb),
 'sessions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'date',s.date,'name',s.name,'icon',s.icon,'week',s.week_type,'trainingWeek',s.training_week,'status',s.status,'difficulty',s.difficulty,'notes',s.notes,'createdBy',s.created_by_user_id,
 'exercises',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'exerciseId',e.exercise_id,'name',e.name,'kind',e.kind,'duration',e.duration,'notes',e.notes,'done',e.done,
 'sets',coalesce((select jsonb_agg(jsonb_build_object('id',z.id,'weight',z.weight_kg,'reps',z.reps,'done',z.done) order by z.position) from public.session_sets z where z.owner_user_id=e.owner_user_id and z.session_exercise_id=e.id),'[]'::jsonb)) order by e.position)
 from public.session_exercises e where e.owner_user_id=s.owner_user_id and e.session_id=s.id),'[]'::jsonb)) order by s.date) from public.sessions s where s.owner_user_id=target_owner),'[]'::jsonb),
 'templates',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'icon',t.icon,'week',t.week_type,'notes',t.notes,
 'exercises',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'exerciseId',e.exercise_id,'name',e.name,'kind',e.kind,'duration',e.duration,'notes',e.notes,'done',false,
 'sets',coalesce((select jsonb_agg(jsonb_build_object('id',z.id,'weight',z.weight_kg,'reps',z.reps,'done',false) order by z.position) from public.template_sets z where z.owner_user_id=e.owner_user_id and z.template_exercise_id=e.id),'[]'::jsonb)) order by e.position)
 from public.template_exercises e where e.owner_user_id=t.owner_user_id and e.template_id=t.id),'[]'::jsonb))) from public.templates t where t.owner_user_id=target_owner),'[]'::jsonb)) into result;
 return jsonb_build_object('data',result,'revision',rev,'trainingWeeksReady',true,'languageReady',true);
end $$;
revoke all on function public.load_training_data(uuid) from public;
grant execute on function public.load_training_data(uuid) to authenticated;
create or replace function public.save_training_data(target_owner uuid,payload jsonb,expected_revision bigint) returns bigint
language plpgsql security definer set search_path=public,pg_temp as $$
declare rev bigint; s jsonb; e jsonb; z jsonb; i integer; j integer; creator uuid; creators jsonb; existing_weeks jsonb;
begin
 if not public.can_access_training(target_owner) then raise exception 'Access denied' using errcode='42501'; end if;
 if coalesce((payload->>'version')::integer,0)<>1 or jsonb_typeof(payload->'sessions') is distinct from 'array' or jsonb_typeof(payload->'templates') is distinct from 'array' or jsonb_typeof(payload->'exercises') is distinct from 'array' or jsonb_typeof(payload->'bodyweight') is distinct from 'array' or jsonb_typeof(payload->'settings') is distinct from 'object' then raise exception 'Invalid backup'; end if;
 if payload->'settings' ? 'useABSplit' and jsonb_typeof(payload->'settings'->'useABSplit') is distinct from 'boolean' then raise exception 'Invalid A/B preference'; end if;
 if payload->'settings' ? 'language' and (jsonb_typeof(payload->'settings'->'language') is distinct from 'string' or payload->'settings'->>'language' not in ('en','ru')) then raise exception 'Invalid language preference'; end if;
 if octet_length(payload::text)>10000000 then raise exception 'Backup is too large'; end if;
 select revision into rev from public.user_settings where owner_user_id=target_owner for update;
 if rev is null or expected_revision is null or rev<>expected_revision then raise exception 'Training changed on another device. Export local edits, then reload before editing again.' using errcode='40001'; end if;
 select coalesce(jsonb_object_agg(id,created_by_user_id),'{}'::jsonb) into creators from public.sessions where owner_user_id=target_owner;
 select coalesce(jsonb_object_agg(id,training_week),'{}'::jsonb) into existing_weeks from public.sessions where owner_user_id=target_owner;
 delete from public.sessions where owner_user_id=target_owner;
 delete from public.templates where owner_user_id=target_owner;
 delete from public.exercises where owner_user_id=target_owner;
 delete from public.bodyweight_entries where owner_user_id=target_owner;
 for s in select value from jsonb_array_elements(payload->'exercises') loop
 insert into public.exercises values(target_owner,s->>'id',s->>'name',(s->>'custom')::boolean);
 end loop;
 for s in select value from jsonb_array_elements(payload->'bodyweight') loop
 insert into public.bodyweight_entries values(target_owner,(s->>'date')::date,(s->>'weight')::numeric);
 end loop;
 for s in select value from jsonb_array_elements(payload->'sessions') loop
 creator:=coalesce((creators->>(s->>'id'))::uuid,auth.uid());
 if s ? 'trainingWeek' and s->'trainingWeek' <> 'null'::jsonb and
    (jsonb_typeof(s->'trainingWeek') <> 'string' or char_length(trim(s->>'trainingWeek')) not between 1 and 600) then
   raise exception 'Invalid training week';
 end if;
 insert into public.sessions(owner_user_id,id,date,name,icon,week_type,status,difficulty,notes,created_by_user_id,training_week)
 values(target_owner,s->>'id',(s->>'date')::date,s->>'name',s->>'icon',s->>'week',s->>'status',s->>'difficulty',s->>'notes',creator,
   coalesce(s->>'trainingWeek',existing_weeks->>(s->>'id')));
 if jsonb_typeof(s->'exercises') is distinct from 'array' then raise exception 'Missing exercises'; end if;
 i:=0;
 for e in select value from jsonb_array_elements(s->'exercises') loop
 insert into public.session_exercises values(target_owner,s->>'id',e->>'id',e->>'exerciseId',e->>'name',e->>'kind',i,(e->>'duration')::numeric,e->>'notes',case when s->>'status'='done' and e->>'kind'='strength' then true else (e->>'done')::boolean end);
 if jsonb_typeof(e->'sets') is distinct from 'array' then raise exception 'Missing sets'; end if;
 j:=0;
 for z in select value from jsonb_array_elements(e->'sets') loop
 insert into public.session_sets values(target_owner,e->>'id',z->>'id',j,(z->>'weight')::numeric,(z->>'reps')::integer,case when s->>'status'='done' and e->>'kind'='strength' then true else (z->>'done')::boolean end);j:=j+1;
 end loop;i:=i+1;
 end loop;
 end loop;
 for s in select value from jsonb_array_elements(payload->'templates') loop
 insert into public.templates values(target_owner,s->>'id',s->>'name',s->>'icon',s->>'week',s->>'notes');if jsonb_typeof(s->'exercises') is distinct from 'array' then raise exception 'Missing exercises'; end if;
 i:=0;
 for e in select value from jsonb_array_elements(s->'exercises') loop
 insert into public.template_exercises values(target_owner,s->>'id',e->>'id',e->>'exerciseId',e->>'name',e->>'kind',i,(e->>'duration')::numeric,e->>'notes');if jsonb_typeof(e->'sets') is distinct from 'array' then raise exception 'Missing sets'; end if;
 j:=0;
 for z in select value from jsonb_array_elements(e->'sets') loop
 insert into public.template_sets values(target_owner,e->>'id',z->>'id',j,(z->>'weight')::numeric,(z->>'reps')::integer);j:=j+1;
 end loop;i:=i+1;
 end loop;
 end loop;
 update public.user_settings set revision=rev+1,display_name=payload->'settings'->>'name',spike_threshold=(payload->'settings'->>'spikeThreshold')::numeric,anchor_date=(payload->'settings'->>'anchorDate')::date,anchor_week=payload->'settings'->>'anchorWeek',use_ab_split=coalesce((payload->'settings'->>'useABSplit')::boolean,use_ab_split),language=coalesce(payload->'settings'->>'language',language) where owner_user_id=target_owner;
 perform public._sync_workout_reviews(target_owner);
 return rev+1;
end $$;
revoke all on function public.save_training_data(uuid,jsonb,bigint) from public;
grant execute on function public.save_training_data(uuid,jsonb,bigint) to authenticated;


-- Serialize with training writes while capturing the initial silent baseline.
lock table public.user_settings in exclusive mode;
do $$ declare owner_id uuid; begin
 for owner_id in select distinct owner_user_id from public.sessions loop
  perform public._sync_workout_reviews(owner_id,true);
 end loop;
end $$;
commit;
