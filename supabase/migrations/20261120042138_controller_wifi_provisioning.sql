create table smart_estate.controller_provisioning_request (
  id uuid primary key,
  sequence bigint generated always as identity,
  controller_id text not null,
  estate_id text not null,
  gateway_id text not null,
  requested_by uuid not null,
  operation text not null check (operation in ('OPEN_PROVISIONING_WINDOW','CLOSE_PROVISIONING_WINDOW')),
  duration_seconds integer not null default 300 check (duration_seconds between 60 and 600),
  status text not null default 'PENDING' check (status in ('PENDING','CLAIMED','PUBLISHED','SUCCEEDED','FAILED','CANCELLED','EXPIRED')),
  lease_id uuid,
  lease_expires_at timestamptz,
  expires_at timestamptz not null,
  published_at timestamptz,
  acknowledged_at timestamptz,
  acknowledgement jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint controller_provisioning_controller_fk foreign key(controller_id,estate_id)
    references smart_estate.controller(id,estate_id) on delete cascade
);

create index controller_provisioning_claim_idx
  on smart_estate.controller_provisioning_request(gateway_id,status,expires_at,sequence);
create index controller_provisioning_history_idx
  on smart_estate.controller_provisioning_request(controller_id,sequence desc);
create unique index controller_provisioning_active_idx
  on smart_estate.controller_provisioning_request(controller_id)
  where status in ('PENDING','CLAIMED','PUBLISHED');

alter table smart_estate.controller_provisioning_request enable row level security;
revoke all on smart_estate.controller_provisioning_request from public,anon,authenticated;
alter default privileges in schema smart_estate revoke all on tables from public,anon,authenticated;
