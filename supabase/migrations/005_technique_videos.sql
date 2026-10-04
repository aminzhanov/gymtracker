-- Run in SQL Editor on the existing LiftLog project. Safe to run again.
-- Links are coach-managed separately from training backups and revisions.
-- No exercise foreign key: training saves replace exercise rows transactionally,
-- and a demonstration should survive ordinary saves and library removal.
begin;
create table if not exists public.exercise_technique_videos (
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id text not null check (char_length(exercise_id) between 1 and 200 and exercise_id=trim(exercise_id)),
  drive_file_id text not null check (drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  resource_key text check (resource_key is null or resource_key ~ '^[A-Za-z0-9_-]{1,200}$'),
  updated_at timestamptz not null default now(),
  primary key(owner_user_id,exercise_id)
);
alter table public.exercise_technique_videos enable row level security;
drop policy if exists technique_videos_read on public.exercise_technique_videos;
create policy technique_videos_read on public.exercise_technique_videos for select to authenticated
  using (public.can_access_training(owner_user_id));
revoke all on public.exercise_technique_videos from anon,authenticated;
grant select on public.exercise_technique_videos to authenticated;
grant all on public.exercise_technique_videos to service_role;

create or replace function public.save_technique_video(target_owner uuid,target_exercise text,drive_file text,drive_resource_key text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='coach' and active)
    or not public.can_access_training(target_owner) then
    raise exception 'Coach access required' using errcode='42501';
  end if;
  if target_exercise is null or char_length(target_exercise) not between 1 and 200 or target_exercise <> trim(target_exercise) then
    raise exception 'Invalid exercise';
  end if;
  if drive_file is null then
    delete from public.exercise_technique_videos where owner_user_id=target_owner and exercise_id=target_exercise;
    return;
  end if;
  if drive_file !~ '^[A-Za-z0-9_-]{10,200}$' or (drive_resource_key is not null and drive_resource_key !~ '^[A-Za-z0-9_-]{1,200}$') then
    raise exception 'Invalid Google Drive video';
  end if;
  insert into public.exercise_technique_videos(owner_user_id,exercise_id,drive_file_id,resource_key)
    values(target_owner,target_exercise,drive_file,drive_resource_key)
    on conflict(owner_user_id,exercise_id) do update set
      drive_file_id=excluded.drive_file_id,resource_key=excluded.resource_key,updated_at=now();
end $$;
revoke all on function public.save_technique_video(uuid,text,text,text) from public;
grant execute on function public.save_technique_video(uuid,text,text,text) to authenticated;
commit;
