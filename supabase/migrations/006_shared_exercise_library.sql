-- Run after migrations 001 and 005. Safe to rerun; preserves workouts and revisions.
begin;
do $$ begin
  if to_regclass('public.exercise_technique_videos') is null then
    raise exception 'Run 005_technique_videos.sql first, then this update.';
  end if;
end $$;

create or replace function public.exercise_library_owner(target uuid)
returns uuid language sql stable security definer set search_path=public,pg_temp as $$
  select case when p.role='coach' then p.id else coalesce(c.coach_id,p.id) end
  from public.profiles p left join public.coach_athletes c on c.athlete_id=p.id where p.id=target;
$$;
revoke all on function public.exercise_library_owner(uuid) from public;

create or replace function public.can_access_exercise_library(target uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.profiles where id=auth.uid() and active)
    and target=public.exercise_library_owner(auth.uid());
$$;
revoke all on function public.can_access_exercise_library(uuid) from public;
grant execute on function public.can_access_exercise_library(uuid) to authenticated;

create or replace function public.exercise_name_key(value text)
returns text language sql immutable set search_path=public,pg_temp as $$
  select lower(regexp_replace(trim(value),'[[:space:]]+',' ','g'));
$$;
revoke all on function public.exercise_name_key(text) from public;

create table if not exists public.shared_exercises (
  library_owner_id uuid not null references public.profiles(id) on delete cascade,
  id text not null default ('shared-'||gen_random_uuid()::text),
  name text not null check(char_length(trim(name)) between 1 and 100),
  name_key text not null,
  custom boolean not null default true,
  archived boolean not null default false,
  drive_file_id text check(drive_file_id is null or drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  resource_key text check(resource_key is null or resource_key ~ '^[A-Za-z0-9_-]{1,200}$'),
  video_initialized boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(library_owner_id,id),
  unique(library_owner_id,name_key)
);
create table if not exists public.shared_exercise_aliases (
  library_owner_id uuid not null,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id text not null check(char_length(exercise_id) between 1 and 200),
  shared_id text not null,
  preference bigint generated always as identity,
  primary key(library_owner_id,owner_user_id,exercise_id),
  foreign key(library_owner_id,shared_id) references public.shared_exercises(library_owner_id,id) on delete cascade
);
create index if not exists shared_alias_lookup on public.shared_exercise_aliases(library_owner_id,owner_user_id,shared_id,preference);
alter table public.shared_exercises enable row level security;
alter table public.shared_exercise_aliases enable row level security;
drop policy if exists shared_library_read on public.shared_exercises;
create policy shared_library_read on public.shared_exercises for select to authenticated using(public.can_access_exercise_library(library_owner_id));
drop policy if exists shared_alias_read on public.shared_exercise_aliases;
create policy shared_alias_read on public.shared_exercise_aliases for select to authenticated
  using(public.can_access_exercise_library(library_owner_id) and public.can_access_training(owner_user_id));
revoke all on public.shared_exercises,public.shared_exercise_aliases from anon,authenticated;
grant select on public.shared_exercises,public.shared_exercise_aliases to authenticated;
grant all on public.shared_exercises,public.shared_exercise_aliases to service_role;

-- Additions merge by name. The first alias remains the owner's preferred ID.
-- Missing rows in a training save cannot delete or restore the shared library.
create or replace function public.register_shared_exercise(target_owner uuid,exercise_id text,exercise_name text,is_custom boolean)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare library_owner uuid; shared text; existing text; normalized text;
begin
  library_owner:=public.exercise_library_owner(target_owner);
  normalized:=public.exercise_name_key(exercise_name);
  if normalized is null or char_length(normalized) not between 1 and 100 or exercise_id is null or char_length(exercise_id) not between 1 and 200 then
    raise exception 'Invalid shared exercise';
  end if;
  insert into public.shared_exercises(library_owner_id,name,name_key,custom)
    values(library_owner,regexp_replace(trim(exercise_name),'[[:space:]]+',' ','g'),normalized,is_custom)
    on conflict(library_owner_id,name_key) do nothing;
  select id into shared from public.shared_exercises where library_owner_id=library_owner and name_key=normalized;
  if exists(select 1 from public.shared_exercises where library_owner_id=library_owner and id=exercise_id and id<>shared) then
    raise exception 'Exercise ID already belongs to another exercise';
  end if;
  select shared_id into existing from public.shared_exercise_aliases
    where library_owner_id=library_owner and owner_user_id=target_owner and shared_exercise_aliases.exercise_id=register_shared_exercise.exercise_id;
  if existing is not null and existing<>shared then raise exception 'Exercise ID already belongs to another exercise'; end if;
  insert into public.shared_exercise_aliases(library_owner_id,owner_user_id,exercise_id,shared_id)
    values(library_owner,target_owner,exercise_id,shared) on conflict do nothing;
  return shared;
end $$;
revoke all on function public.register_shared_exercise(uuid,text,text,boolean) from public;

create or replace function public.sync_exercise_library_insert()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.register_shared_exercise(new.owner_user_id,new.id,new.name,new.custom);
  return new;
end $$;
revoke all on function public.sync_exercise_library_insert() from public;
drop trigger if exists sync_exercise_library on public.exercises;
create trigger sync_exercise_library after insert on public.exercises for each row execute function public.sync_exercise_library_insert();

-- Import existing libraries and videos, including when an athlete joins a new coach.
-- Existing shared edits (even a removed video) always win over legacy copies.
create or replace function public.import_exercise_library(target_owner uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare exercise record; library_owner uuid;
begin
  library_owner:=public.exercise_library_owner(target_owner);
  for exercise in select * from public.exercises where owner_user_id=target_owner order by id loop
    perform public.register_shared_exercise(target_owner,exercise.id,exercise.name,exercise.custom);
  end loop;
  update public.shared_exercises s set drive_file_id=v.drive_file_id,resource_key=v.resource_key,video_initialized=true
  from (select distinct on(a.shared_id) a.shared_id,v.drive_file_id,v.resource_key
    from public.shared_exercise_aliases a join public.exercise_technique_videos v
      on v.owner_user_id=a.owner_user_id and v.exercise_id=a.exercise_id
    where a.library_owner_id=library_owner
    order by a.shared_id,(a.owner_user_id=library_owner) desc,v.updated_at desc,a.owner_user_id,a.exercise_id) v
  where s.library_owner_id=library_owner and s.id=v.shared_id and not s.video_initialized;
end $$;
revoke all on function public.import_exercise_library(uuid) from public;

do $$ declare profile record; exercise record; begin
  -- Register every alias before resolving legacy video conflicts.
  for exercise in select e.* from public.exercises e join public.profiles p on p.id=e.owner_user_id order by (p.role='coach') desc,e.owner_user_id,e.id loop
    perform public.register_shared_exercise(exercise.owner_user_id,exercise.id,exercise.name,exercise.custom);
  end loop;
  for profile in select id from public.profiles order by (role='coach') desc,id loop
    perform public.import_exercise_library(profile.id);
  end loop;
end $$;
create or replace function public.sync_linked_exercise_library()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.import_exercise_library(new.coach_id);
  perform public.import_exercise_library(new.athlete_id);
  return new;
end $$;
revoke all on function public.sync_linked_exercise_library() from public;
drop trigger if exists sync_linked_library on public.coach_athletes;
create trigger sync_linked_library after insert or update on public.coach_athletes for each row execute function public.sync_linked_exercise_library();

create or replace function public.load_exercise_library(target_owner uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare library_owner uuid; result jsonb;
begin
  if not public.can_access_training(target_owner) then raise exception 'Access denied' using errcode='42501'; end if;
  library_owner:=public.exercise_library_owner(target_owner);
  select jsonb_build_object(
    'exercises',coalesce((select jsonb_agg(jsonb_build_object('id',coalesce(
      (select a.exercise_id from public.shared_exercise_aliases a where a.library_owner_id=library_owner and a.owner_user_id=target_owner and a.shared_id=s.id order by a.preference limit 1),s.id),
      'name',s.name,'custom',s.custom) order by s.name)
      from public.shared_exercises s where s.library_owner_id=library_owner and not s.archived),'[]'::jsonb),
    'videos',coalesce((select jsonb_agg(jsonb_build_object('exercise_id',ids.exercise_id,'drive_file_id',s.drive_file_id,'resource_key',s.resource_key))
      from public.shared_exercises s cross join lateral (
        select s.id as exercise_id union select a.exercise_id from public.shared_exercise_aliases a
        where a.library_owner_id=library_owner and a.owner_user_id=target_owner and a.shared_id=s.id
      ) ids where s.library_owner_id=library_owner and s.drive_file_id is not null),'[]'::jsonb)
      || coalesce((select jsonb_agg(jsonb_build_object('exercise_id',v.exercise_id,'drive_file_id',v.drive_file_id,'resource_key',v.resource_key))
      from public.exercise_technique_videos v where v.owner_user_id=target_owner and not exists(
        select 1 from public.shared_exercise_aliases a where a.library_owner_id=library_owner and a.owner_user_id=target_owner and a.exercise_id=v.exercise_id)),'[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.load_exercise_library(uuid) from public;
grant execute on function public.load_exercise_library(uuid) to authenticated;

create or replace function public.add_shared_exercise(target_owner uuid,exercise_name text,client_id text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare library_owner uuid; shared text;
begin
  if not public.can_access_training(target_owner) then raise exception 'Access denied' using errcode='42501'; end if;
  library_owner:=public.exercise_library_owner(target_owner);
  shared:=public.register_shared_exercise(target_owner,client_id,exercise_name,true);
  if exists(select 1 from public.shared_exercises where library_owner_id=library_owner and id=shared and archived) then
    if not exists(select 1 from public.profiles where id=auth.uid() and role='coach' and active) then
      raise exception 'This exercise was removed from the shared library. Ask your coach to restore it.';
    end if;
    update public.shared_exercises set archived=false,updated_at=now() where library_owner_id=library_owner and id=shared;
  end if;
  return (select exercise_id from public.shared_exercise_aliases where library_owner_id=library_owner and owner_user_id=target_owner and shared_id=shared order by preference limit 1);
end $$;
revoke all on function public.add_shared_exercise(uuid,text,text) from public;
grant execute on function public.add_shared_exercise(uuid,text,text) to authenticated;

-- Explicit archive only; historical aliases and videos remain available.
create or replace function public.archive_shared_exercise(target_owner uuid,target_exercise text,is_archived boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare library_owner uuid; shared text;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='coach' and active)
    or not public.can_access_training(target_owner) then raise exception 'Coach access required' using errcode='42501'; end if;
  library_owner:=public.exercise_library_owner(target_owner);
  select s.id into shared from public.shared_exercises s where s.library_owner_id=library_owner
    and (s.id=target_exercise or exists(select 1 from public.shared_exercise_aliases a where a.library_owner_id=library_owner and a.owner_user_id=target_owner and a.exercise_id=target_exercise and a.shared_id=s.id));
  if shared is null then raise exception 'Exercise not found'; end if;
  update public.shared_exercises set archived=is_archived,updated_at=now() where library_owner_id=library_owner and id=shared and custom;
end $$;
revoke all on function public.archive_shared_exercise(uuid,text,boolean) from public;
grant execute on function public.archive_shared_exercise(uuid,text,boolean) to authenticated;

create or replace function public.save_technique_video(target_owner uuid,target_exercise text,drive_file text,drive_resource_key text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare library_owner uuid; shared text;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='coach' and active)
    or not public.can_access_training(target_owner) then raise exception 'Coach access required' using errcode='42501'; end if;
  if target_exercise is null or char_length(target_exercise) not between 1 and 200 or target_exercise<>trim(target_exercise) then raise exception 'Invalid exercise'; end if;
  if drive_file is not null and (drive_file !~ '^[A-Za-z0-9_-]{10,200}$' or (drive_resource_key is not null and drive_resource_key !~ '^[A-Za-z0-9_-]{1,200}$')) then raise exception 'Invalid Google Drive video'; end if;
  library_owner:=public.exercise_library_owner(target_owner);
  select s.id into shared from public.shared_exercises s where s.library_owner_id=library_owner
    and (s.id=target_exercise or exists(select 1 from public.shared_exercise_aliases a where a.library_owner_id=library_owner and a.owner_user_id=target_owner and a.exercise_id=target_exercise and a.shared_id=s.id));
  if shared is not null then
    update public.shared_exercises set drive_file_id=drive_file,resource_key=case when drive_file is null then null else drive_resource_key end,video_initialized=true,updated_at=now()
      where library_owner_id=library_owner and id=shared;
  elsif drive_file is null then
    delete from public.exercise_technique_videos where owner_user_id=target_owner and exercise_id=target_exercise;
  else
    insert into public.exercise_technique_videos(owner_user_id,exercise_id,drive_file_id,resource_key)
      values(target_owner,target_exercise,drive_file,drive_resource_key)
      on conflict(owner_user_id,exercise_id) do update set drive_file_id=excluded.drive_file_id,resource_key=excluded.resource_key,updated_at=now();
  end if;
end $$;
revoke all on function public.save_technique_video(uuid,text,text,text) from public;
grant execute on function public.save_technique_video(uuid,text,text,text) to authenticated;
commit;
