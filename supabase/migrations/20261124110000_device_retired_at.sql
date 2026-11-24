-- Application code (repository.ts, bridge sync) filters on device.retired_at
-- since 2026-11-20, but no migration created the column, so environments built
-- from this directory failed every device query. Idempotent for databases
-- where the column was added out of band.
alter table smart_estate.device add column if not exists retired_at timestamptz;
