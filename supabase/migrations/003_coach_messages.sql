-- Add personal messages without changing accounts, workouts or training revisions.
-- Only an active coach can edit messages for themselves or an assigned athlete.
-- Safe to run again.
begin;
create table if not exists public.coach_messages (
  owner_user_id uuid primary key references public.profiles(id) on delete cascade,
  dashboard_message text not null check (char_length(dashboard_message) between 1 and 180),
  sidebar_message text not null check (char_length(sidebar_message) between 1 and 120)
);
alter table public.coach_messages enable row level security;
drop policy if exists messages_read on public.coach_messages;
create policy messages_read on public.coach_messages for select to authenticated
  using (public.can_access_training(owner_user_id));
revoke all on public.coach_messages from anon, authenticated;
grant select on public.coach_messages to authenticated;
grant all on public.coach_messages to service_role;

create or replace function public.save_coach_messages(target_owner uuid, dashboard_message text, sidebar_message text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists (select 1 from public.profiles where id=auth.uid() and role='coach' and active)
    or not public.can_access_training(target_owner) then
    raise exception 'Coach access required' using errcode='42501';
  end if;
  if dashboard_message is null or sidebar_message is null
    or char_length(trim(dashboard_message)) not between 1 and 180
    or char_length(trim(sidebar_message)) not between 1 and 120 then
    raise exception 'Enter both messages within their character limits.';
  end if;
  insert into public.coach_messages (owner_user_id, dashboard_message, sidebar_message)
    values (target_owner, trim(dashboard_message), trim(sidebar_message))
    on conflict (owner_user_id) do update set
      dashboard_message=excluded.dashboard_message, sidebar_message=excluded.sidebar_message;
end $$;
revoke all on function public.save_coach_messages(uuid,text,text) from public;
grant execute on function public.save_coach_messages(uuid,text,text) to authenticated;
-- Preserve recorded recovery completion when finishing lifting.
create or replace function public.save_training_data(target_owner uuid,payload jsonb,expected_revision bigint) returns bigint
language plpgsql security definer set search_path=public,pg_temp as $$
declare rev bigint; s jsonb; e jsonb; z jsonb; i integer; j integer; creator uuid; creators jsonb;
begin
 if not public.can_access_training(target_owner) then raise exception 'Access denied' using errcode='42501'; end if;
 if coalesce((payload->>'version')::integer,0)<>1 or jsonb_typeof(payload->'sessions') is distinct from 'array' or jsonb_typeof(payload->'templates') is distinct from 'array' or jsonb_typeof(payload->'exercises') is distinct from 'array' or jsonb_typeof(payload->'bodyweight') is distinct from 'array' or jsonb_typeof(payload->'settings') is distinct from 'object' then raise exception 'Invalid backup'; end if;
 if payload->'settings' ? 'useABSplit' and jsonb_typeof(payload->'settings'->'useABSplit') is distinct from 'boolean' then raise exception 'Invalid A/B preference'; end if;
 if octet_length(payload::text)>10000000 then raise exception 'Backup is too large'; end if;
 select revision into rev from public.user_settings where owner_user_id=target_owner for update;
 if rev is null or expected_revision is null or rev<>expected_revision then raise exception 'Training changed on another device. Export local edits, then reload before editing again.' using errcode='40001'; end if;
 select coalesce(jsonb_object_agg(id,created_by_user_id),'{}'::jsonb) into creators from public.sessions where owner_user_id=target_owner;
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
 insert into public.sessions values(target_owner,s->>'id',(s->>'date')::date,s->>'name',s->>'icon',s->>'week',s->>'status',s->>'difficulty',s->>'notes',creator);
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
 update public.user_settings set revision=rev+1,display_name=payload->'settings'->>'name',spike_threshold=(payload->'settings'->>'spikeThreshold')::numeric,anchor_date=(payload->'settings'->>'anchorDate')::date,anchor_week=payload->'settings'->>'anchorWeek',use_ab_split=coalesce((payload->'settings'->>'useABSplit')::boolean,use_ab_split) where owner_user_id=target_owner;
 return rev+1;
end $$;
revoke all on function public.save_training_data(uuid,jsonb,bigint) from public;
grant execute on function public.save_training_data(uuid,jsonb,bigint) to authenticated;

commit;
