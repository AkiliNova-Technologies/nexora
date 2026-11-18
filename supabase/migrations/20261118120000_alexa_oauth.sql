-- Additive OAuth 2.0 storage for the Alexa confidential client. Raw codes and
-- tokens are never stored. Apply only after reviewing the target database.
create table if not exists smart_estate.oauth_grant (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  scopes text[] not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint oauth_grant_client_id_present check (length(btrim(client_id)) > 0),
  constraint oauth_grant_scopes_present check (cardinality(scopes) > 0),
  constraint oauth_grant_revocation_order check (revoked_at is null or revoked_at >= created_at)
);
create index if not exists oauth_grant_user_idx on smart_estate.oauth_grant(user_id,client_id) where revoked_at is null;

create table if not exists smart_estate.oauth_authorization_code (
  code_hash text primary key, grant_id uuid not null references smart_estate.oauth_grant(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, client_id text not null,
  redirect_uri text not null, scopes text[] not null, expires_at timestamptz not null,
  consumed_at timestamptz, created_at timestamptz not null default now(),
  constraint oauth_code_client_id_present check (length(btrim(client_id)) > 0),
  constraint oauth_code_redirect_uri_present check (length(btrim(redirect_uri)) > 0),
  constraint oauth_code_scopes_present check (cardinality(scopes) > 0),
  constraint oauth_code_expiry_order check (expires_at > created_at),
  constraint oauth_code_consumption_order check (consumed_at is null or consumed_at >= created_at)
);
create index if not exists oauth_authorization_code_expiry_idx on smart_estate.oauth_authorization_code(expires_at);
create table if not exists smart_estate.oauth_access_token (
  token_hash text primary key, grant_id uuid not null references smart_estate.oauth_grant(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, client_id text not null,
  scopes text[] not null, expires_at timestamptz not null, revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint oauth_access_client_id_present check (length(btrim(client_id)) > 0),
  constraint oauth_access_scopes_present check (cardinality(scopes) > 0),
  constraint oauth_access_expiry_order check (expires_at > created_at),
  constraint oauth_access_revocation_order check (revoked_at is null or revoked_at >= created_at)
);
create index if not exists oauth_access_token_expiry_idx on smart_estate.oauth_access_token(expires_at);
create index if not exists oauth_access_token_grant_idx on smart_estate.oauth_access_token(grant_id) where revoked_at is null;
create table if not exists smart_estate.oauth_refresh_token (
  token_hash text primary key, grant_id uuid not null references smart_estate.oauth_grant(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, client_id text not null,
  scopes text[] not null, expires_at timestamptz not null, revoked_at timestamptz,
  replaced_by_hash text, created_at timestamptz not null default now(),
  constraint oauth_refresh_client_id_present check (length(btrim(client_id)) > 0),
  constraint oauth_refresh_scopes_present check (cardinality(scopes) > 0),
  constraint oauth_refresh_expiry_order check (expires_at > created_at),
  constraint oauth_refresh_revocation_order check (revoked_at is null or revoked_at >= created_at),
  constraint oauth_refresh_replacement_is_hash check (replaced_by_hash is null or length(replaced_by_hash) = 64)
);
create index if not exists oauth_refresh_token_expiry_idx on smart_estate.oauth_refresh_token(expires_at);
create index if not exists oauth_refresh_token_grant_idx on smart_estate.oauth_refresh_token(grant_id) where revoked_at is null;
create table if not exists smart_estate.alexa_directive (
  message_id text primary key, expires_at timestamptz not null, created_at timestamptz not null default now(),
  constraint alexa_directive_message_id_present check (length(btrim(message_id)) > 0),
  constraint alexa_directive_expiry_order check (expires_at > created_at)
);
create index if not exists alexa_directive_expiry_idx on smart_estate.alexa_directive(expires_at);

revoke all on smart_estate.oauth_grant,smart_estate.oauth_authorization_code,smart_estate.oauth_access_token,smart_estate.oauth_refresh_token,smart_estate.alexa_directive from public,anon,authenticated;
alter table smart_estate.oauth_grant enable row level security;
alter table smart_estate.oauth_authorization_code enable row level security;
alter table smart_estate.oauth_access_token enable row level security;
alter table smart_estate.oauth_refresh_token enable row level security;
alter table smart_estate.alexa_directive enable row level security;

-- No browser-facing policies are created. These objects are reachable only by
-- the server's direct PostgreSQL role, matching the rest of smart_estate.
