#!/bin/sh
set -eu

if [ "${NEXORA_ALLOW_ISOLATED_DB_VALIDATION:-}" != "yes" ] || [ -z "${ISOLATED_DATABASE_URL:-}" ]; then
  echo "Refusing to run: set NEXORA_ALLOW_ISOLATED_DB_VALIDATION=yes and ISOLATED_DATABASE_URL for a disposable database." >&2
  exit 2
fi

case "$ISOLATED_DATABASE_URL" in
  *supabase.co*|*nexora*prod*) echo "Refusing a URL that appears to be hosted production." >&2; exit 2 ;;
esac

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
psql "$ISOLATED_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$root_dir/supabase/migrations/20261119150000_controller_management.sql"
psql "$ISOLATED_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$root_dir/supabase/migrations/20261120033213_estate_admin_big_fan_authorization.sql"
psql "$ISOLATED_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$root_dir/tests/sql/controller-management-validation.sql"
