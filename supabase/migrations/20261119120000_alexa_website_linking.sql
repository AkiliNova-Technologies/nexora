-- Additive, server-only storage for website-initiated Alexa linking.
create table if not exists smart_estate.alexa_link_transaction (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  state_hash text not null unique,
  pkce_ciphertext text not null,
  pkce_nonce text not null,
  pkce_tag text not null,
  encryption_version integer not null default 1,
  return_path text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint alexa_link_state_hash check (length(state_hash) = 64),
  constraint alexa_link_return_path check (return_path = '/settings' or return_path like '/settings?%'),
  constraint alexa_link_expiry check (expires_at > created_at),
  constraint alexa_link_consumption check (consumed_at is null or consumed_at >= created_at)
);
create unique index if not exists alexa_link_transaction_active_user_idx on smart_estate.alexa_link_transaction(user_id) where consumed_at is null;
create index if not exists alexa_link_transaction_expiry_idx on smart_estate.alexa_link_transaction(expires_at);

create table if not exists smart_estate.alexa_connection (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  oauth_grant_id uuid references smart_estate.oauth_grant(id) on delete set null,
  skill_id text not null,
  skill_stage text not null,
  api_endpoint text not null,
  refresh_ciphertext text,
  refresh_nonce text,
  refresh_tag text,
  encryption_version integer not null default 1,
  state text not null,
  amazon_status text,
  account_link_status text,
  last_verified_at timestamptz,
  unlink_pending_since timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alexa_connection_unique unique(user_id,skill_id,skill_stage),
  constraint alexa_connection_stage check (skill_stage in ('development','live')),
  constraint alexa_connection_endpoint check (api_endpoint in ('https://api.amazonalexa.com','https://api.eu.amazonalexa.com','https://api.fe.amazon.com')),
  constraint alexa_connection_state check (state in ('verification_pending','connected','relink_required','unlink_pending','locally_revoked')),
  constraint alexa_connection_refresh_complete check ((refresh_ciphertext is null and refresh_nonce is null and refresh_tag is null) or (refresh_ciphertext is not null and refresh_nonce is not null and refresh_tag is not null))
);
create index if not exists alexa_connection_user_idx on smart_estate.alexa_connection(user_id,skill_id,skill_stage);

revoke all on smart_estate.alexa_link_transaction,smart_estate.alexa_connection from public,anon,authenticated;
alter table smart_estate.alexa_link_transaction enable row level security;
alter table smart_estate.alexa_connection enable row level security;

-- No browser-facing policies. The application server's direct database role is
-- the sole caller, consistent with the existing OAuth credential tables.
