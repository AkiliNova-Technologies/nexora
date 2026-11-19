-- Phase 2B controller-management foundation. Additive only; no production seed data.
create table if not exists smart_estate.estate_admin (
  estate_id text not null references smart_estate.estate(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (estate_id,user_id)
);
create index if not exists estate_admin_user_idx on smart_estate.estate_admin(user_id) where active;

create table if not exists smart_estate.controller (
  id text primary key,
  estate_id text not null references smart_estate.estate(id) on delete restrict,
  gateway_id text not null,
  name text not null,
  hardware_identity text not null unique,
  proof_of_possession_hash text not null check (proof_of_possession_hash ~ '^[a-f0-9]{64}$'),
  registration_state text not null default 'PENDING' check (registration_state in ('PENDING','PAIRED','REVOKED')),
  pairing_state text not null default 'UNPAIRED' check (pairing_state in ('UNPAIRED','CHALLENGE_ISSUED','PAIRED','REVOKED')),
  firmware_version text,
  credential_reference text,
  credential_version integer not null default 0 check (credential_version>=0),
  revoked_at timestamptz,
  wifi_ssid text,
  wifi_rssi integer check (wifi_rssi between -127 and 0),
  network_state text not null default 'UNKNOWN' check (network_state in ('ONLINE','OFFLINE','UNAVAILABLE','DEGRADED','UNKNOWN')),
  mqtt_state text not null default 'UNKNOWN' check (mqtt_state in ('ONLINE','OFFLINE','UNAVAILABLE','DEGRADED','UNKNOWN')),
  boot_id uuid,
  heartbeat_sequence bigint check (heartbeat_sequence>=0),
  last_heartbeat_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,estate_id),
  unique (id,gateway_id)
);
create index if not exists controller_estate_idx on smart_estate.controller(estate_id);
create index if not exists controller_last_seen_idx on smart_estate.controller(last_seen_at desc);

create table if not exists smart_estate.controller_house (
  controller_id text not null,
  controller_estate_id text not null,
  house_id text not null references smart_estate.house(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(controller_id,house_id),
  foreign key(controller_id,controller_estate_id) references smart_estate.controller(id,estate_id) on delete cascade
);
create index if not exists controller_house_house_idx on smart_estate.controller_house(house_id);

create table if not exists smart_estate.controller_pairing (
  id uuid primary key,
  controller_id text not null references smart_estate.controller(id) on delete cascade,
  estate_id text not null references smart_estate.estate(id) on delete cascade,
  initiated_by uuid not null references auth.users(id) on delete restrict,
  challenge_hash text not null unique,
  proof_hash text,
  attempts integer not null default 0 check (attempts>=0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at>created_at)
);
create index if not exists controller_pairing_active_idx on smart_estate.controller_pairing(controller_id,expires_at) where consumed_at is null;

create table if not exists smart_estate.controller_event (
  id text primary key,
  controller_id text not null references smart_estate.controller(id) on delete restrict,
  estate_id text not null references smart_estate.estate(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null,
  severity text not null default 'INFO' check (severity in ('INFO','WARNING','CRITICAL')),
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);
create index if not exists controller_event_controller_idx on smart_estate.controller_event(controller_id,received_at desc);

create table if not exists smart_estate.estate_security_event (
  id uuid primary key,
  estate_id text not null references smart_estate.estate(id) on delete restrict,
  device_id text references smart_estate.device(id) on delete set null,
  type text not null,
  severity text not null check (severity in ('INFO','WARNING','CRITICAL')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  acknowledged_at timestamptz
);
create index if not exists estate_security_event_idx on smart_estate.estate_security_event(estate_id,occurred_at desc);

create table if not exists smart_estate.security_mode_sync (
  scope_id text primary key,
  scope_type text not null check (scope_type in ('HOUSE','ESTATE')),
  mode text not null check (mode in ('UNKNOWN','DISARMED','ARMED_HOME','ARMED_AWAY','ARMED')),
  version bigint not null default 0 check (version>=0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table smart_estate.device_state drop constraint if exists device_state_connectivity_check;
alter table smart_estate.device_state add constraint device_state_connectivity_check
  check (connectivity in ('ONLINE','OFFLINE','UNAVAILABLE','DEGRADED','UNKNOWN'));

create or replace function smart_estate.is_estate_admin(subject uuid,target_estate text)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from smart_estate.estate_admin a where a.user_id=subject and a.estate_id=target_estate and a.active);
$$;

create or replace function smart_estate.can_control_estate_device(subject uuid,target_estate text,device_type text)
returns boolean language sql stable security invoker set search_path='' as $$
  select case when device_type='SIREN' then smart_estate.is_estate_admin(subject,target_estate)
    else exists(select 1 from smart_estate.estate_member m where m.estate_id=target_estate and m.user_id=subject and m.active and ((device_type='GATE' and m.can_control_gate) or (device_type in ('LIGHT','RGB_LIGHT') and m.can_manage_perimeter_lighting))) end;
$$;

create or replace function smart_estate.enforce_controller_house_estate()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from smart_estate.house h where h.id=new.house_id and h.estate_id=new.controller_estate_id) then
    raise exception 'controller and house must belong to the same estate' using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists controller_house_estate_guard on smart_estate.controller_house;
create trigger controller_house_estate_guard before insert or update on smart_estate.controller_house
for each row execute function smart_estate.enforce_controller_house_estate();

create or replace function smart_estate.enforce_device_controller_scope()
returns trigger language plpgsql security invoker set search_path='' as $$
declare c smart_estate.controller%rowtype;
begin
  select * into c from smart_estate.controller where id=new.controller_id;
  if not found or c.gateway_id<>new.gateway_id then raise exception 'invalid controller/gateway association' using errcode='23514'; end if;
  if new.estate_id is not null and new.estate_id<>c.estate_id then raise exception 'device estate differs from controller estate' using errcode='23514'; end if;
  if new.house_id is not null and not exists(select 1 from smart_estate.controller_house ch where ch.controller_id=c.id and ch.house_id=new.house_id) then
    raise exception 'controller is not associated with device house' using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists device_controller_scope_guard on smart_estate.device;
create trigger device_controller_scope_guard before insert or update of controller_id,gateway_id,house_id,estate_id on smart_estate.device
for each row execute function smart_estate.enforce_device_controller_scope();

alter table smart_estate.estate_admin enable row level security;
alter table smart_estate.controller enable row level security;
alter table smart_estate.controller_house enable row level security;
alter table smart_estate.controller_pairing enable row level security;
alter table smart_estate.controller_event enable row level security;
alter table smart_estate.estate_security_event enable row level security;
alter table smart_estate.security_mode_sync enable row level security;

revoke all on smart_estate.estate_admin,smart_estate.controller,smart_estate.controller_house,smart_estate.controller_pairing,smart_estate.controller_event,smart_estate.estate_security_event,smart_estate.security_mode_sync from public,anon,authenticated;
revoke all on function smart_estate.is_estate_admin(uuid,text),smart_estate.can_control_estate_device(uuid,text,text),smart_estate.enforce_controller_house_estate(),smart_estate.enforce_device_controller_scope() from public,anon,authenticated;

-- Browser roles intentionally receive no grants. Server routes use the protected
-- PostgreSQL connection and revalidate estate administration on every operation.
create policy estate_admin_self_read on smart_estate.estate_admin for select to authenticated using ((select auth.uid())=user_id);
create policy controller_admin_read on smart_estate.controller for select to authenticated using (smart_estate.is_estate_admin((select auth.uid()),estate_id));
create policy controller_house_admin_read on smart_estate.controller_house for select to authenticated using (smart_estate.is_estate_admin((select auth.uid()),controller_estate_id));
create policy controller_event_admin_read on smart_estate.controller_event for select to authenticated using (smart_estate.is_estate_admin((select auth.uid()),estate_id));
create policy estate_security_admin_read on smart_estate.estate_security_event for select to authenticated using (smart_estate.is_estate_admin((select auth.uid()),estate_id));

-- Explicit bootstrap (do not run automatically): insert one reviewed
-- (estate_id,user_id,granted_by) row into smart_estate.estate_admin.
