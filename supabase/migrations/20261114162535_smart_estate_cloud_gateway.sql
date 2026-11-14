-- REVIEW ONLY. Verify the target database and existing schemas before applying.
-- This migration is additive: it never drops, truncates, renames, or takes ownership of existing objects.

create schema if not exists smart_estate;
revoke all on schema smart_estate from public, anon, authenticated;

create table if not exists smart_estate.profile (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);
create table if not exists smart_estate.estate (
  id text primary key,
  name text not null,
  timezone text not null
);
create table if not exists smart_estate.house (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete restrict,
  estate_id text references smart_estate.estate(id) on delete set null,
  name text not null,
  timezone text not null
);
create index if not exists smart_estate_house_owner_idx on smart_estate.house(owner_id);
create table if not exists smart_estate.house_access (
  house_id text not null references smart_estate.house(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true,
  can_view boolean not null default false,
  can_control_devices boolean not null default false,
  can_manage_security boolean not null default false,
  granted_at timestamptz not null default now(),
  primary key (house_id,user_id)
);
create table if not exists smart_estate.estate_member (
  estate_id text not null references smart_estate.estate(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true,
  can_view_shared_devices boolean not null default false,
  can_control_gate boolean not null default false,
  can_manage_perimeter_lighting boolean not null default false,
  can_read_compound_security boolean not null default false,
  can_manage_compound_security boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (estate_id,user_id)
);
create table if not exists smart_estate.room (
  id text primary key,
  house_id text not null references smart_estate.house(id) on delete cascade,
  name text not null
);
create index if not exists smart_estate_room_house_idx on smart_estate.room(house_id);
create table if not exists smart_estate.device (
  id text primary key,
  house_id text references smart_estate.house(id) on delete cascade,
  estate_id text references smart_estate.estate(id) on delete cascade,
  room_id text references smart_estate.room(id) on delete set null,
  gateway_id text not null,
  controller_id text not null,
  name text not null,
  type text not null,
  capabilities jsonb not null default '[]'::jsonb,
  execution_mode text not null check (execution_mode in ('SIMULATED','PHYSICAL')),
  constraint smart_estate_device_one_scope check ((house_id is not null) <> (estate_id is not null))
);
create index if not exists smart_estate_device_house_idx on smart_estate.device(house_id);
create index if not exists smart_estate_device_estate_idx on smart_estate.device(estate_id);
create index if not exists smart_estate_device_gateway_idx on smart_estate.device(gateway_id);
create table if not exists smart_estate.device_state (
  device_id text primary key references smart_estate.device(id) on delete cascade,
  connectivity text not null default 'OFFLINE' check (connectivity in ('ONLINE','OFFLINE')),
  desired jsonb,
  reported jsonb not null default '{}'::jsonb,
  command_status text not null default 'IDLE' check (command_status in ('IDLE','PENDING','ACCEPTED','EXECUTED','FAILED','TIMEOUT')),
  last_reported_at timestamptz not null default now(),
  last_seen_at timestamptz,
  version bigint not null default 0
);
create table if not exists smart_estate.device_command (
  id uuid primary key,
  device_id text not null references smart_estate.device(id) on delete restrict,
  gateway_id text not null,
  client_request_id text not null,
  type text not null,
  parameters jsonb,
  status text not null check (status in ('PENDING','ACCEPTED','EXECUTED','FAILED','TIMEOUT')),
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz not null,
  completed_at timestamptz,
  error text,
  unique(device_id,client_request_id)
);
create index if not exists smart_estate_command_gateway_pending_idx on smart_estate.device_command(gateway_id,status,requested_at);
create unique index if not exists smart_estate_one_active_gate_command_idx on smart_estate.device_command(device_id) where status in ('PENDING','ACCEPTED') and type in ('OPEN_GATE','CLOSE_GATE');
create table if not exists smart_estate.gateway_event (
  event_id text primary key,
  gateway_id text not null,
  device_id text not null references smart_estate.device(id) on delete restrict,
  kind text not null check (kind in ('ack','state','status','event')),
  payload jsonb not null,
  received_at timestamptz not null default now()
);
create index if not exists smart_estate_gateway_event_device_idx on smart_estate.gateway_event(device_id,received_at desc);
create table if not exists smart_estate.house_security_state (
  house_id text primary key references smart_estate.house(id) on delete cascade,
  mode text not null default 'DISARMED' check (mode in ('DISARMED','ARMED_HOME','ARMED_AWAY')),
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists smart_estate.security_sensor_policy (
  house_id text not null references smart_estate.house(id) on delete cascade,
  device_id text not null references smart_estate.device(id) on delete cascade,
  enabled boolean not null default true,
  monitor_armed_home boolean not null default false,
  monitor_armed_away boolean not null default true,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key(house_id,device_id)
);
create table if not exists smart_estate.security_event (
  id uuid primary key,
  house_id text not null references smart_estate.house(id) on delete restrict,
  device_id text references smart_estate.device(id) on delete set null,
  type text not null,
  severity text not null check (severity in ('INFO','WARNING','CRITICAL')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  acknowledged_at timestamptz
);
create index if not exists smart_estate_security_event_house_idx on smart_estate.security_event(house_id,occurred_at desc);
create table if not exists smart_estate.audit_record (
  id uuid primary key,
  actor_id uuid references auth.users(id) on delete set null,
  house_id text references smart_estate.house(id) on delete set null,
  estate_id text references smart_estate.estate(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create or replace function smart_estate.can_view_house(subject uuid, target_house text) returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from smart_estate.house h where h.id=target_house and h.owner_id=subject)
      or exists(select 1 from smart_estate.house_access a where a.house_id=target_house and a.user_id=subject and a.active and a.can_view);
$$;
create or replace function smart_estate.can_control_house(subject uuid, target_house text) returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from smart_estate.house h where h.id=target_house and h.owner_id=subject)
      or exists(select 1 from smart_estate.house_access a where a.house_id=target_house and a.user_id=subject and a.active and a.can_control_devices);
$$;
create or replace function smart_estate.can_manage_house_security(subject uuid, target_house text) returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from smart_estate.house h where h.id=target_house and h.owner_id=subject)
      or exists(select 1 from smart_estate.house_access a where a.house_id=target_house and a.user_id=subject and a.active and a.can_manage_security);
$$;
create or replace function smart_estate.can_view_estate(subject uuid, target_estate text) returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from smart_estate.estate_member m where m.estate_id=target_estate and m.user_id=subject and m.active and m.can_view_shared_devices);
$$;
create or replace function smart_estate.can_control_estate_device(subject uuid, target_estate text, device_type text) returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from smart_estate.estate_member m where m.estate_id=target_estate and m.user_id=subject and m.active and ((device_type='GATE' and m.can_control_gate) or (device_type='LIGHT' and m.can_manage_perimeter_lighting)));
$$;

revoke all on all tables in schema smart_estate from public, anon, authenticated;
revoke all on all functions in schema smart_estate from public, anon, authenticated;
alter default privileges in schema smart_estate revoke all on tables from public, anon, authenticated;
alter default privileges in schema smart_estate revoke execute on functions from public, anon, authenticated;

alter table smart_estate.profile enable row level security;
alter table smart_estate.estate enable row level security;
alter table smart_estate.house enable row level security;
alter table smart_estate.house_access enable row level security;
alter table smart_estate.estate_member enable row level security;
alter table smart_estate.room enable row level security;
alter table smart_estate.device enable row level security;
alter table smart_estate.device_state enable row level security;
alter table smart_estate.device_command enable row level security;
alter table smart_estate.gateway_event enable row level security;
alter table smart_estate.house_security_state enable row level security;
alter table smart_estate.security_sensor_policy enable row level security;
alter table smart_estate.security_event enable row level security;
alter table smart_estate.audit_record enable row level security;

-- Browser roles intentionally receive no grants. These policies provide defense in depth if read grants are added later.
drop policy if exists profile_self_select on smart_estate.profile;
drop policy if exists house_authorized_select on smart_estate.house;
drop policy if exists house_access_self_select on smart_estate.house_access;
drop policy if exists estate_member_self_select on smart_estate.estate_member;
drop policy if exists room_authorized_select on smart_estate.room;
drop policy if exists device_authorized_select on smart_estate.device;
drop policy if exists state_authorized_select on smart_estate.device_state;
drop policy if exists command_requester_select on smart_estate.device_command;
drop policy if exists house_security_authorized_select on smart_estate.house_security_state;
drop policy if exists sensor_policy_authorized_select on smart_estate.security_sensor_policy;
drop policy if exists security_event_authorized_select on smart_estate.security_event;
create policy profile_self_select on smart_estate.profile for select to authenticated using ((select auth.uid())=id);
create policy house_authorized_select on smart_estate.house for select to authenticated using (smart_estate.can_view_house((select auth.uid()),id));
create policy house_access_self_select on smart_estate.house_access for select to authenticated using ((select auth.uid())=user_id);
create policy estate_member_self_select on smart_estate.estate_member for select to authenticated using ((select auth.uid())=user_id);
create policy room_authorized_select on smart_estate.room for select to authenticated using (smart_estate.can_view_house((select auth.uid()),house_id));
create policy device_authorized_select on smart_estate.device for select to authenticated using ((house_id is not null and smart_estate.can_view_house((select auth.uid()),house_id)) or (estate_id is not null and smart_estate.can_view_estate((select auth.uid()),estate_id)));
create policy state_authorized_select on smart_estate.device_state for select to authenticated using (exists(select 1 from smart_estate.device d where d.id=device_id and ((d.house_id is not null and smart_estate.can_view_house((select auth.uid()),d.house_id)) or (d.estate_id is not null and smart_estate.can_view_estate((select auth.uid()),d.estate_id)))));
create policy command_requester_select on smart_estate.device_command for select to authenticated using ((select auth.uid())=requested_by);
create policy house_security_authorized_select on smart_estate.house_security_state for select to authenticated using (smart_estate.can_view_house((select auth.uid()),house_id));
create policy sensor_policy_authorized_select on smart_estate.security_sensor_policy for select to authenticated using (smart_estate.can_view_house((select auth.uid()),house_id));
create policy security_event_authorized_select on smart_estate.security_event for select to authenticated using (smart_estate.can_view_house((select auth.uid()),house_id));
