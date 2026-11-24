-- House arming previously updated only house_security_state, while controllers
-- receive modes exclusively from security_mode_sync (via the bridge sync API).
-- The API now mirrors every house mode change; this backfills existing houses.
insert into smart_estate.security_mode_sync(scope_id, scope_type, mode, version, updated_at)
select s.house_id, 'HOUSE', s.mode, s.version, s.updated_at
from smart_estate.house_security_state s
on conflict (scope_id) do update
  set mode = excluded.mode, version = excluded.version, updated_at = excluded.updated_at
  where smart_estate.security_mode_sync.scope_type = 'HOUSE'
    and smart_estate.security_mode_sync.version < excluded.version;
