-- Remote Wi-Fi management from the admin Controllers page.
-- SCAN_WIFI asks the controller for nearby networks (returned in `acknowledgement`).
-- SET_WIFI asks it to test and switch to a network. The password is stored only
-- as AES-256-GCM ciphertext and is wiped once delivered, acknowledged, cancelled
-- or expired. `parameters` never holds the password.

alter table smart_estate.controller_provisioning_request
  drop constraint if exists controller_provisioning_request_operation_check;
alter table smart_estate.controller_provisioning_request
  add constraint controller_provisioning_request_operation_check
  check (operation in ('OPEN_PROVISIONING_WINDOW', 'CLOSE_PROVISIONING_WINDOW', 'SCAN_WIFI', 'SET_WIFI'));

alter table smart_estate.controller_provisioning_request
  add column if not exists parameters jsonb not null default '{}'::jsonb,
  add column if not exists secret_ciphertext text,
  add column if not exists secret_nonce text,
  add column if not exists secret_tag text;

alter table smart_estate.controller_provisioning_request
  drop constraint if exists controller_provisioning_secret_scope;
alter table smart_estate.controller_provisioning_request
  add constraint controller_provisioning_secret_scope
  check (secret_ciphertext is null or operation = 'SET_WIFI');
