#!/usr/bin/env bash
set -euo pipefail

# Restore an archive written by scripts/backup.sh — and, by default, prove it
# is restorable without touching anything that matters.
#
#   scripts/restore.sh /var/backups/vyoh/vyoh-20260815T030000Z.dump
#     Restores into a scratch database, compares its row counts table by table
#     against the live one, then drops the scratch copy. This is the drill.
#
#   scripts/restore.sh --into vyoh /var/backups/vyoh/vyoh-….dump
#     The real thing. Drops and recreates the named database, and makes you
#     type its name first.
#
# The safe path is the default one on purpose. A backup nobody has restored is
# a hypothesis, and the only way that stays true is if checking costs more than
# one command.
#
# Configuration, all overridable:
#   VYOH_COMPOSE_FILE  stack to restore into    (default compose.prod.yaml)
#   VYOH_SCRATCH_DB    scratch database name    (default vyoh_restore_check)
#   POSTGRES_USER      role to restore as       (default: asks the container)
#   POSTGRES_DB        database compared against (default: asks the container)
#
# Flags:
#   --into <db>      restore into a real database instead of the scratch one
#   --keep-scratch   leave the scratch database behind to poke at
#   -y, --yes        skip the typed confirmation (for --into)

cd "$(dirname "$0")/.."

cyan() { printf '\033[0;36m%s\033[0m\n' "$1"; }
green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$1"; }
red() { printf '\033[0;31m%s\033[0m\n' "$1"; }

compose_file="${VYOH_COMPOSE_FILE:-compose.prod.yaml}"
scratch_db="${VYOH_SCRATCH_DB:-vyoh_restore_check}"

into=""
keep_scratch=false
skip_prompt=false
archive=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --into)
      into="${2:-}"
      shift 2
      ;;
    --keep-scratch)
      keep_scratch=true
      shift
      ;;
    -y | --yes)
      skip_prompt=true
      shift
      ;;
    -*)
      red "Unknown flag: $1"
      exit 1
      ;;
    *)
      archive="$1"
      shift
      ;;
  esac
done

if [[ -z $archive ]]; then
  red "No archive given."
  echo "  scripts/restore.sh /var/backups/vyoh/vyoh-….dump"
  exit 1
fi
if [[ ! -f $archive ]]; then
  red "No such archive: ${archive}"
  exit 1
fi

compose() { docker compose -f "$compose_file" "$@"; }
# Every psql call is one-shot and must stop at the first error; a restore that
# reports success after a failed statement is worse than no restore.
psql_on() { compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$db_user" -d "$1" "${@:2}"; }

if ! compose exec -T postgres pg_isready -q >/dev/null 2>&1; then
  red "Postgres is not accepting connections in ${compose_file}."
  exit 1
fi

db_user="${POSTGRES_USER:-$(compose exec -T postgres printenv POSTGRES_USER)}"
source_db="${POSTGRES_DB:-$(compose exec -T postgres printenv POSTGRES_DB)}"
db_user="${db_user%$'\r'}"
source_db="${source_db%$'\r'}"

drill=true
target="$scratch_db"
if [[ -n $into ]]; then
  drill=false
  target="$into"
fi

if [[ $drill == false ]]; then
  yellow "This will DROP the '${target}' database and rebuild it from ${archive}."
  yellow "Everything currently in it is lost."
  if [[ $skip_prompt == false ]]; then
    read -r -p "Type the database name to continue: " reply
    if [[ $reply != "$target" ]]; then
      echo "Aborted."
      exit 0
    fi
  fi

  # Refuse rather than force. DROP DATABASE needs exclusive access, and the api
  # reconnects on its own — killing its sessions here would just race the
  # restore against a container that is trying to come back.
  clients="$(psql_on postgres -At -c "select count(*) from pg_stat_activity where datname = '${target}'")"
  if [[ ${clients//[!0-9]/} -gt 0 ]]; then
    red "${clients//[!0-9]/} client(s) still connected to '${target}'."
    echo "  docker compose -f ${compose_file} stop api"
    exit 1
  fi
fi

cyan "→ recreate ${target}"
psql_on postgres -q -c "drop database if exists \"${target}\"" >/dev/null
psql_on postgres -q -c "create database \"${target}\"" >/dev/null

cyan "→ restore $(du -h "$archive" | cut -f1) archive"
# --single-transaction so a failure halfway leaves an empty database rather
# than a convincing partial one. Ownership and grants come from the role that
# runs the restore; the dump's are meaningless in a scratch database and
# identical in the real one.
if ! compose exec -T postgres pg_restore \
  -U "$db_user" -d "$target" \
  --no-owner --no-privileges --single-transaction \
  <"$archive"; then
  red ""
  red "Restore failed. '${target}' is empty."
  exit 1
fi

if [[ $drill == false ]]; then
  green ""
  green "Restored ${archive} into ${target}."
  yellow "Start the api again: docker compose -f ${compose_file} start api"
  exit 0
fi

cyan "→ compare ${target} against ${source_db}"
tmp="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp"
  if [[ $keep_scratch == false ]]; then
    psql_on postgres -q -c "drop database if exists \"${scratch_db}\"" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# Exact counts, not pg_stat_user_tables' n_live_tup — that is an estimate the
# autovacuum daemon maintains, and a freshly restored database has not been
# analysed yet, so it reads zero everywhere and the comparison would be a lie.
count_sql="
select table_name,
       (xpath('/row/c/text()',
              query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name),
                           false, true, '')))[1]::text::bigint
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name;"

psql_on "$source_db" -At -F'|' -c "$count_sql" >"${tmp}/source"
psql_on "$target" -At -F'|' -c "$count_sql" >"${tmp}/restored"

set +e
awk -F'|' '
  function note(t) { if (!(t in seen)) { seen[t] = 1; order[++n] = t } }
  NR == FNR { src[$1] = $2; note($1); next }
  { got[$1] = $2; note($1) }
  END {
    for (i = 1; i <= n; i++) {
      t = order[i]
      if (!(t in got))                            { printf "  GONE   %-30s source %s\n", t, src[t]; bad++ }
      else if (!(t in src))                       { printf "  extra  %-30s restored %s\n", t, got[t] }
      else if (src[t] + 0 == got[t] + 0)          { printf "  ok     %-30s %s\n", t, got[t] }
      else if (got[t] + 0 == 0 && src[t] + 0 > 0) { printf "  EMPTY  %-30s source %s, restored 0\n", t, src[t]; bad++ }
      else                                        { printf "  drift  %-30s source %s, restored %s\n", t, src[t], got[t]; drift++ }
    }
    printf "\n%d tables, %d missing or empty, %d drifted\n", n, bad + 0, drift + 0
    exit (bad > 0)
  }
' "${tmp}/source" "${tmp}/restored"
verdict=$?
set -e

if [[ $verdict -ne 0 ]]; then
  red ""
  red "The archive does not reproduce the database. Do not rely on it."
  exit 1
fi

green ""
green "${archive} restores clean."
# Drift is expected on a live box and only on a live box: the dump is a
# snapshot, and the poller has been writing since. A table that drifts *down*,
# or one that drifts on an idle database, is worth a second look.
yellow "Any 'drift' rows above are writes that landed after the dump was taken."
