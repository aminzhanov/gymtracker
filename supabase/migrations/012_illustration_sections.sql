-- Run after 010_profile_illustrations.sql. Safe to rerun.
-- Adds Planner, Analytics and empty-state images without changing training data.
begin;
create or replace function public.valid_profile_illustrations(value jsonb) returns boolean
language plpgsql immutable set search_path=public,pg_temp as $$
declare slot text; device text; item jsonb; placement jsonb;
begin
 if jsonb_typeof(value) is distinct from 'object' or octet_length(value::text)>1510000 then return false; end if;
 if exists(select 1 from jsonb_object_keys(value) as keys(key)
   where key not in ('dashboard','menu','planner','analytics','inboxEmpty','todayEmpty')) then return false; end if;
 foreach slot in array array['dashboard','menu','planner','analytics','inboxEmpty','todayEmpty'] loop
  -- Old profiles and older app versions may still have only the original slots.
  if not (value ? slot) and slot not in ('dashboard','menu') then continue; end if;
  item:=value->slot;
  if jsonb_typeof(item) is distinct from 'object' then return false; end if;
  if item ? 'preset' and (jsonb_typeof(item->'preset') is distinct from 'string' or
    item->>'preset' not in ('cat-face','cat-back','sticker','sticker2','sticker3','sticker4','5',
      'sticker6','sticker7','sticker8','sticker9','sticker10','sticker11','sticker12','sticker13',
      'sticker15','sticker17','sticker18','sticker19','sticker20','sticker21') or
    jsonb_typeof(item->'image') is distinct from 'null') then return false; end if;
  if item ? 'enabled' and jsonb_typeof(item->'enabled') is distinct from 'boolean' then return false; end if;
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

create or replace function public.save_profile_illustrations(target_owner uuid,payload jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='coach' and active)
    or not public.can_access_training(target_owner) then
  raise exception 'Coach access required' using errcode='42501';
 end if;
 if not public.valid_profile_illustrations(payload) then raise exception 'Invalid illustration settings'; end if;
 insert into public.profile_illustrations(owner_user_id,illustrations) values(target_owner,payload)
 on conflict(owner_user_id) do update
  set illustrations=public.profile_illustrations.illustrations || excluded.illustrations;
 -- Merging preserves new slots when an older app saves Dashboard/Menu only.
end $$;
revoke all on function public.save_profile_illustrations(uuid,jsonb) from public,anon;
grant execute on function public.save_profile_illustrations(uuid,jsonb) to authenticated;

create or replace function public.load_profile_illustrations(target_owner uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.can_access_training(target_owner) then
  raise exception 'Access denied' using errcode='42501';
 end if;
 return jsonb_build_object('sectionsReady',true,'illustrations',
   (select illustrations from public.profile_illustrations where owner_user_id=target_owner));
end $$;
revoke all on function public.load_profile_illustrations(uuid) from public,anon;
grant execute on function public.load_profile_illustrations(uuid) to authenticated;
commit;
