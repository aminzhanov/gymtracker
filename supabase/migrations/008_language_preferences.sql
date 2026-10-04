-- Run once in Supabase SQL Editor after 007. Safe to run again.
-- Stores each athlete’s interface language with their training settings.
begin;
alter table public.user_settings add column if not exists language text not null default 'en' check(language in ('en','ru'));
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
 return rev+1;
end $$;
revoke all on function public.save_training_data(uuid,jsonb,bigint) from public;
grant execute on function public.save_training_data(uuid,jsonb,bigint) to authenticated;

commit;
