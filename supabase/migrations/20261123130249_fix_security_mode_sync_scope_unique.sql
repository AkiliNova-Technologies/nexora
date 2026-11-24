-- Fix the conflict target used by the security mode API.
-- The API uses ON CONFLICT (scope_type, scope_id).

CREATE UNIQUE INDEX IF NOT EXISTS
  security_mode_sync_scope_type_scope_id_uidx
ON smart_estate.security_mode_sync (scope_type, scope_id);

