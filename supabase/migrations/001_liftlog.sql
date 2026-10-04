-- Run once in the Supabase SQL editor (or apply with supabase db push).
-- Roles and coach relationships are server-administered; clients cannot promote themselves.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null check (length(name) between 1 and 100),
 role text not null default 'athlete' check (role in ('coach','athlete')),
 active boolean not null default true
);
create table public.coach_athletes (
 athlete_id uuid primary key references public.profiles(id) on delete cascade,
 coach_id uuid not null references public.profiles(id) on delete cascade,
 check (athlete_id <> coach_id)
);
create index coach_athletes_coach on public.coach_athletes(coach_id);
create table public.user_settings (
 owner_user_id uuid primary key references public.profiles(id) on delete cascade,
 revision bigint not null default 0,
 display_name text not null default 'Athlete',
 spike_threshold numeric not null default 30 check (spike_threshold between 0 and 1000),
 anchor_date date not null default current_date,
 anchor_week text not null default 'A' check (anchor_week in ('A','B'))
);
create table public.exercises (
 owner_user_id uuid not null references public.profiles(id) on delete cascade,
 id text not null, name text not null, custom boolean not null default false,
 primary key(owner_user_id,id)
);
create table public.sessions (
 owner_user_id uuid not null references public.profiles(id) on delete cascade,
 id text not null, date date not null, name text not null check (length(trim(name)) between 1 and 100),
 icon text not null, week_type text not null check(week_type in ('A','B')),
 status text not null check(status in ('planned','done')),
 difficulty text not null default '' check(difficulty in ('','easy','solid','hard','brutal')),
 notes text not null default '', created_by_user_id uuid not null references public.profiles(id),
 primary key(owner_user_id,id)
);
create index sessions_owner_date on public.sessions(owner_user_id,date);
create table public.session_exercises (
 owner_user_id uuid not null, session_id text not null, id text not null,
 exercise_id text not null, name text not null, kind text not null check(kind in ('strength','warmup','cooldown')),
 position integer not null, duration numeric not null default 0 check(duration between 0 and 1440),
 notes text not null default '', done boolean not null default false,
 primary key(owner_user_id,id),
 foreign key(owner_user_id,session_id) references public.sessions(owner_user_id,id) on delete cascade
);
create table public.session_sets (
 owner_user_id uuid not null, session_exercise_id text not null, id text not null,
 position integer not null,
 weight_kg numeric not null check(weight_kg between 0 and 2000),
 reps integer not null check(reps between 0 and 1000), done boolean not null default false,
 primary key(owner_user_id,id),
 foreign key(owner_user_id,session_exercise_id) references public.session_exercises(owner_user_id,id) on delete cascade
);
create table public.templates (
 owner_user_id uuid not null references public.profiles(id) on delete cascade,
 id text not null, name text not null check(length(trim(name)) between 1 and 100), icon text not null,
 week_type text not null check(week_type in ('A','B')), notes text not null default '',
 primary key(owner_user_id,id)
);
create table public.template_exercises (
 owner_user_id uuid not null, template_id text not null, id text not null,
 exercise_id text not null, name text not null, kind text not null check(kind in ('strength','warmup','cooldown')),
 position integer not null, duration numeric not null default 0 check(duration between 0 and 1440), notes text not null default '',
 primary key(owner_user_id,id),
 foreign key(owner_user_id,template_id) references public.templates(owner_user_id,id) on delete cascade
);
create table public.template_sets (
 owner_user_id uuid not null, template_exercise_id text not null, id text not null,
 position integer not null, weight_kg numeric not null check(weight_kg between 0 and 2000), reps integer not null check(reps between 0 and 1000),
 primary key(owner_user_id,id),
 foreign key(owner_user_id,template_exercise_id) references public.template_exercises(owner_user_id,id) on delete cascade
);
create table public.bodyweight_entries (
 owner_user_id uuid not null references public.profiles(id) on delete cascade,
 date date not null, weight_kg numeric not null check(weight_kg > 0 and weight_kg <= 600),
 primary key(owner_user_id,date)
);
-- Reservations are private and bind invitations to the requesting coach atomically.
create table public.athlete_invitations (
 email text primary key, nonce uuid not null unique,
 coach_id uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
alter table public.athlete_invitations enable row level security;
revoke all on public.athlete_invitations from anon,authenticated;
grant all on public.athlete_invitations to service_role;
create function public.reserve_athlete_invite(invite_email text,invite_coach uuid,invite_nonce uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.profiles where id=invite_coach and role='coach' and active) then raise exception 'Coach access required'; end if;
 if exists(select 1 from auth.users where lower(email)=lower(trim(invite_email))) then raise exception 'This email already has an account. The administrator must manage existing accounts.'; end if;
 insert into public.athlete_invitations(email,coach_id,nonce) values(lower(trim(invite_email)),invite_coach,invite_nonce);
end $$;
revoke all on function public.reserve_athlete_invite(text,uuid,uuid) from public;
grant execute on function public.reserve_athlete_invite(text,uuid,uuid) to service_role;

-- Security-definer helper avoids recursive profile policies. Fixed search path.
create function public.can_access_training(target uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and
 (p.id=target or (p.role='coach' and exists(select 1 from public.coach_athletes c where c.coach_id=p.id and c.athlete_id=target))));
$$;
revoke all on function public.can_access_training(uuid) from public;
grant execute on function public.can_access_training(uuid) to authenticated;
alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(public.can_access_training(id));
alter table public.coach_athletes enable row level security;
create policy relationship_read on public.coach_athletes for select to authenticated using(coach_id=auth.uid() or athlete_id=auth.uid());
do $$ declare tab text; begin
 foreach tab in array array['user_settings','exercises','sessions','session_exercises','session_sets','templates','template_exercises','template_sets','bodyweight_entries'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('create policy owner_read on public.%I for select to authenticated using(public.can_access_training(owner_user_id))',tab);
 end loop;
end $$;
-- Only RPCs may mutate training rows, so direct requests cannot bypass revision checks.
revoke all on public.profiles,public.coach_athletes,public.user_settings,public.exercises,public.sessions,public.session_exercises,public.session_sets,public.templates,public.template_exercises,public.template_sets,public.bodyweight_entries from anon,authenticated;
grant select on public.profiles,public.coach_athletes,public.user_settings,public.exercises,public.sessions,public.session_exercises,public.session_sets,public.templates,public.template_exercises,public.template_sets,public.bodyweight_entries to authenticated;
grant all on public.profiles,public.coach_athletes,public.user_settings,public.exercises,public.sessions,public.session_exercises,public.session_sets,public.templates,public.template_exercises,public.template_sets,public.bodyweight_entries to service_role;
create function public.create_training_profile() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare default_names text[] := array['Bench Press','Incline Dumbbell Press','Overhead Press','Barbell Row','Pull-Up','Lat Pulldown','Seated Cable Row','Deadlift','Romanian Deadlift','Barbell Back Squat','Leg Press','Leg Curl','Calf Raise','Biceps Curl','Triceps Pushdown','Lateral Raise']; i integer; display text; invited_coach uuid;
begin
 display:=left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),split_part(new.email,'@',1),'Athlete'),100);
 insert into public.profiles(id,name,role) values(new.id,display,'athlete');
 insert into public.user_settings(owner_user_id,display_name) values(new.id,display);
 for i in 1..array_length(default_names,1) loop
 insert into public.exercises(owner_user_id,id,name,custom) values(new.id,'default-'||(i-1),default_names[i],false);
 end loop;
 select r.coach_id into invited_coach from public.athlete_invitations r join public.profiles c on c.id=r.coach_id and c.role='coach' and c.active
 where r.email=lower(new.email) and r.nonce::text=new.raw_user_meta_data->>'invite_nonce';
 if invited_coach is not null then
 insert into public.coach_athletes(athlete_id,coach_id) values(new.id,invited_coach);
 delete from public.athlete_invitations where email=lower(new.email);
 end if;
 return new;
end $$;
revoke all on function public.create_training_profile() from public;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_training_profile();
-- Install before creating accounts. Existing auth users need profiles/settings seeded manually.
create function public.load_training_data(target_owner uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; rev bigint;
begin
 if not public.can_access_training(target_owner) then raise exception 'Access denied' using errcode='42501'; end if;
 select revision into rev from public.user_settings where owner_user_id=target_owner;
 if rev is null then raise exception 'Profile is missing training settings'; end if;
 select jsonb_build_object('version',1,
 'settings',(select jsonb_build_object('name',display_name,'spikeThreshold',spike_threshold,'anchorDate',anchor_date,'anchorWeek',anchor_week) from public.user_settings where owner_user_id=target_owner),
 'exercises',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'custom',custom) order by name) from public.exercises where owner_user_id=target_owner),'[]'::jsonb),
 'bodyweight',coalesce((select jsonb_agg(jsonb_build_object('date',date,'weight',weight_kg) order by date) from public.bodyweight_entries where owner_user_id=target_owner),'[]'::jsonb),
 'sessions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'date',s.date,'name',s.name,'icon',s.icon,'week',s.week_type,'status',s.status,'difficulty',s.difficulty,'notes',s.notes,'createdBy',s.created_by_user_id,
 'exercises',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'exerciseId',e.exercise_id,'name',e.name,'kind',e.kind,'duration',e.duration,'notes',e.notes,'done',e.done,
 'sets',coalesce((select jsonb_agg(jsonb_build_object('id',z.id,'weight',z.weight_kg,'reps',z.reps,'done',z.done) order by z.position) from public.session_sets z where z.owner_user_id=e.owner_user_id and z.session_exercise_id=e.id),'[]'::jsonb)) order by e.position)
 from public.session_exercises e where e.owner_user_id=s.owner_user_id and e.session_id=s.id),'[]'::jsonb)) order by s.date) from public.sessions s where s.owner_user_id=target_owner),'[]'::jsonb),
 'templates',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'icon',t.icon,'week',t.week_type,'notes',t.notes,
 'exercises',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'exerciseId',e.exercise_id,'name',e.name,'kind',e.kind,'duration',e.duration,'notes',e.notes,'done',false,
 'sets',coalesce((select jsonb_agg(jsonb_build_object('id',z.id,'weight',z.weight_kg,'reps',z.reps,'done',false) order by z.position) from public.template_sets z where z.owner_user_id=e.owner_user_id and z.template_exercise_id=e.id),'[]'::jsonb)) order by e.position)
 from public.template_exercises e where e.owner_user_id=t.owner_user_id and e.template_id=t.id),'[]'::jsonb))) from public.templates t where t.owner_user_id=target_owner),'[]'::jsonb)) into result;
 return jsonb_build_object('data',result,'revision',rev);
end $$;
revoke all on function public.load_training_data(uuid) from public;
grant execute on function public.load_training_data(uuid) to authenticated;
create function public.save_training_data(target_owner uuid,payload jsonb,expected_revision bigint) returns bigint
language plpgsql security definer set search_path=public,pg_temp as $$
declare rev bigint; s jsonb; e jsonb; z jsonb; i integer; j integer; creator uuid; creators jsonb;
begin
 if not public.can_access_training(target_owner) then raise exception 'Access denied' using errcode='42501'; end if;
 if coalesce((payload->>'version')::integer,0)<>1 or jsonb_typeof(payload->'sessions') is distinct from 'array' or jsonb_typeof(payload->'templates') is distinct from 'array' or jsonb_typeof(payload->'exercises') is distinct from 'array' or jsonb_typeof(payload->'bodyweight') is distinct from 'array' or jsonb_typeof(payload->'settings') is distinct from 'object' then raise exception 'Invalid backup'; end if;
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
 insert into public.session_exercises values(target_owner,s->>'id',e->>'id',e->>'exerciseId',e->>'name',e->>'kind',i,(e->>'duration')::numeric,e->>'notes',case when s->>'status'='done' then true else (e->>'done')::boolean end);
 if jsonb_typeof(e->'sets') is distinct from 'array' then raise exception 'Missing sets'; end if;
 j:=0;
 for z in select value from jsonb_array_elements(e->'sets') loop
 insert into public.session_sets values(target_owner,e->>'id',z->>'id',j,(z->>'weight')::numeric,(z->>'reps')::integer,case when s->>'status'='done' then true else (z->>'done')::boolean end);j:=j+1;
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
 update public.user_settings set revision=rev+1,display_name=payload->'settings'->>'name',spike_threshold=(payload->'settings'->>'spikeThreshold')::numeric,anchor_date=(payload->'settings'->>'anchorDate')::date,anchor_week=payload->'settings'->>'anchorWeek' where owner_user_id=target_owner;
 return rev+1;
end $$;
revoke all on function public.save_training_data(uuid,jsonb,bigint) from public;
grant execute on function public.save_training_data(uuid,jsonb,bigint) to authenticated;
create function public.set_athlete_active(athlete_id uuid,is_active boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.profiles p join public.coach_athletes c on c.coach_id=p.id where p.id=auth.uid() and p.active and p.role='coach' and c.athlete_id=set_athlete_active.athlete_id) then raise exception 'Access denied' using errcode='42501';end if;
 update public.profiles set active=is_active where id=athlete_id and role='athlete';
end $$;
revoke all on function public.set_athlete_active(uuid,boolean) from public;
grant execute on function public.set_athlete_active(uuid,boolean) to authenticated;
