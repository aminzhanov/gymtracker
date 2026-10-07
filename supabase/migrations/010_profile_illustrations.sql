-- Small optimized images, private to each profile and its assigned coach.
-- Safe to rerun; independent of training revisions and backups.
begin;
create or replace function public.valid_profile_illustrations(value jsonb) returns boolean
language plpgsql immutable set search_path=public,pg_temp as $$
declare slot text; device text; item jsonb; placement jsonb;
begin
 if jsonb_typeof(value) is distinct from 'object' or octet_length(value::text)>510000 then return false; end if;
 foreach slot in array array['dashboard','menu'] loop
  item:=value->slot;
  if jsonb_typeof(item) is distinct from 'object' then return false; end if;
  if not coalesce(jsonb_typeof(item->'image')='null' or
    (jsonb_typeof(item->'image')='string' and length(item->>'image')<=250000 and
     (item->>'image') ~ '^data:image/webp;base64,[A-Za-z0-9+/]+={0,2}$'),false) then return false; end if;
  foreach device in array array['desktop','phone'] loop
   placement:=item->device;
   if jsonb_typeof(placement) is distinct from 'object' or
      jsonb_typeof(placement->'scale') is distinct from 'number' or
      jsonb_typeof(placement->'x') is distinct from 'number' or
      jsonb_typeof(placement->'y') is distinct from 'number' then return false; end if;
   if (placement->>'scale')::numeric not between 60 and 150 or
      abs((placement->>'x')::numeric)>100 or abs((placement->>'y')::numeric)>100 then return false; end if;
  end loop;
 end loop;
 return true;
end $$;
revoke all on function public.valid_profile_illustrations(jsonb) from public,anon,authenticated;
create table if not exists public.profile_illustrations (
 owner_user_id uuid primary key references public.profiles(id) on delete cascade,
 illustrations jsonb not null check(public.valid_profile_illustrations(illustrations))
);
alter table public.profile_illustrations enable row level security;
drop policy if exists illustrations_read on public.profile_illustrations;
create policy illustrations_read on public.profile_illustrations for select to authenticated
 using(public.can_access_training(owner_user_id));
revoke all on public.profile_illustrations from anon,authenticated;
grant select on public.profile_illustrations to authenticated;
grant all on public.profile_illustrations to service_role;
create or replace function public.save_profile_illustrations(target_owner uuid,payload jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='coach' and active)
    or not public.can_access_training(target_owner) then
  raise exception 'Coach access required' using errcode='42501';
 end if;
 if not public.valid_profile_illustrations(payload) then raise exception 'Invalid illustration settings'; end if;
 insert into public.profile_illustrations(owner_user_id,illustrations) values(target_owner,payload)
 on conflict(owner_user_id) do update set illustrations=excluded.illustrations;
end $$;
revoke all on function public.save_profile_illustrations(uuid,jsonb) from public,anon;
grant execute on function public.save_profile_illustrations(uuid,jsonb) to authenticated;
commit;
