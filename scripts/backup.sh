#!/usr/bin/env bash
set -euo pipefail

# Dump the database to a timestamped archive and prune old ones. Runs on the
# VPS from a systemd timer; runs the same from a dev checkout with
# VYOH_COMPOSE_FILE=compose.yaml.
#
#   scripts/backup.sh
#
# The dump goes through `docker compose exec` rather than a pg_dump on the host
# so the client version always matches the server — neither box has a postgres
# client installed, and a mismatched pg_dump refuses to run against a newer
# server anyway.
#
# Configuration, all overridable:
#   VYOH_COMPOSE_FILE  stack to dump from       (default compose.prod.yaml)
#   VYOH_BACKUP_DIR    where archives land      (default /var/backups/vyoh)
#   VYOH_BACKUP_KEEP   archives kept, newest    (default 14)
#   POSTGRES_USER      role to dump as          (default: asks the container)
#   POSTGRES_DB        database to dump         (default: asks the container)
#
# The default backup directory sits outside the checkout deliberately.
# `deploy.sh` rsyncs the tree with `--delete`, so anything kept under /srv/vyoh
# that has no local counterpart is removed on the next deploy — which would
# quietly mean the backups.

cd "$(dirname "$0")/.."

cyan() { printf '\033[0;36m%s\033[0m\n' "$1"; }
green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$1"; }
red() { printf '\033[0;31m%s\033[0m\n' "$1"; }

compose_file="${VYOH_COMPOSE_FILE:-compose.prod.yaml}"
backup_dir="${VYOH_BACKUP_DIR:-/var/backups/vyoh}"
keep="${VYOH_BACKUP_KEEP:-14}"

compose() { docker compose -f "$compose_file" "$@"; }

if ! compose exec -T postgres pg_isready -q >/dev/null 2>&1; then
  red "Postgres is not accepting connections in ${compose_file}."
  echo "  docker compose -f ${compose_file} up -d postgres"
  exit 1
fi

# Asking the running container beats parsing .env: these are the values the
# database actually came up with, whatever the compose defaults say.
db_user="${POSTGRES_USER:-$(compose exec -T postgres printenv POSTGRES_USER)}"
db_name="${POSTGRES_DB:-$(compose exec -T postgres printenv POSTGRES_DB)}"
db_user="${db_user%$'\r'}"
db_name="${db_name%$'\r'}"

mkdir -p "$backup_dir"
# UTC, and ordered so lexicographic sort is chronological sort — the retention
# pass below relies on that rather than on filesystem timestamps, which rsync
# and cp are free to rewrite.
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="${backup_dir}/vyoh-${stamp}.dump"

# A dump killed outright — OOM, power cut — leaves its .partial behind, and the
# retention pass below deliberately cannot see those. Left alone they fill the
# disk, which is exactly the condition that makes the next dump fail too.
# Timers do not overlap, so anything still here is dead.
find "$backup_dir" -maxdepth 1 -name 'vyoh-*.dump.partial' -type f -delete

cyan "→ dump ${db_name} → ${target}"
# -T keeps `docker compose exec` from allocating a TTY. Under a systemd timer
# there is no terminal to allocate, and a pty between pg_dump and this
# redirect is a documented way to end up with a mangled binary stream.
# Custom format so pg_restore can be selective.
compose exec -T postgres pg_dump -U "$db_user" -d "$db_name" --format=custom >"${target}.partial"

cyan "→ verify"
# Decode the whole archive and throw the SQL away. `--list` is the obvious
# check and the wrong one: a custom-format archive keeps its table of contents
# in the header, so --list happily accepts a file truncated to 3% of its
# length. This reads and decompresses every data block instead, which is what
# actually catches a dump killed halfway or a disk that filled up. Costs a
# couple of seconds against a 130 MB archive.
if ! compose exec -T postgres pg_restore -f /dev/null >/dev/null 2>&1 <"${target}.partial"; then
  rm -f "${target}.partial"
  red "The dump did not read back as a valid archive. Nothing was written."
  exit 1
fi
# Only now does it get the real name: a killed dump leaves a .partial that the
# retention pass ignores, instead of a half-file that displaces a good one.
mv "${target}.partial" "$target"
green "  $(du -h "$target" | cut -f1)  $(basename "$target")"

cyan "→ keep ${keep} newest"
mapfile -t stale < <(find "$backup_dir" -maxdepth 1 -name 'vyoh-*.dump' -type f |
  sort -r | tail -n "+$((keep + 1))")
for path in ${stale[@]+"${stale[@]}"}; do
  rm -f "$path"
  yellow "  drop $(basename "$path")"
done

green ""
green "Backed up ${db_name} to ${target}."
