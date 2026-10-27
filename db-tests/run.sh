#!/usr/bin/env bash
# Applies all migrations to a fresh database and runs the access rule checks.
# Needs a plain Postgres 15+ and psql. DATABASE_URL must point at a server
# where the user may create databases, e.g. postgres://postgres@localhost:5432/postgres
set -euo pipefail
cd "$(dirname "$0")/.."

: "${DATABASE_URL:?Set DATABASE_URL to a Postgres server you can create databases on}"
DB=assistenz_db_test
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" "$DATABASE_URL" -c "set client_min_messages = warning" -c "drop database if exists $DB" -c "create database $DB" >/dev/null
TEST_URL=$("${PSQL[@]}" "$DATABASE_URL" -At -c "select regexp_replace('$DATABASE_URL', '/[^/?]*(\?|$)', '/$DB\1')")

"${PSQL[@]}" "$TEST_URL" -f db-tests/supabase_stub.sql
for migration in supabase/migrations/*.sql; do
  "${PSQL[@]}" "$TEST_URL" -f "$migration"
done
"${PSQL[@]}" "$TEST_URL" -o /dev/null -f db-tests/access_rules_test.sql

"${PSQL[@]}" "$DATABASE_URL" -c "drop database $DB" >/dev/null
