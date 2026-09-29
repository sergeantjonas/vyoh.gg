#!/usr/bin/env bash
set -euo pipefail

# Prove the off-box copy restores, starting from only what outlives the box: a
# key that can read the bucket and the owner's age identity. From the laptop,
# never the box — the identity is the one thing that must not be there.
#
#   VYOH_DEPLOY_HOST=vyoh VYOH_AGE_IDENTITY=<(…) scripts/offsite-drill.sh
#
# with VYOH_DRILL_KEY_ID and VYOH_DRILL_APPLICATION_KEY exported, from the
# password manager rather than typed on the command line, where they would stay
# in the shell's history. The drill key holds listFiles, readFiles and
# readFileRetentions on vyoh-gg-backup under vyoh/, and lives on the laptop.
#
# It fetches the newest copy B2 holds, checks it against the SHA-1 B2 recorded,
# decrypts it here, and hands it to restore.sh's drill on the box: a scratch
# database, exact row counts against the live one, and the scratch copy
# dropped. The decrypted archive crosses the laptop's uplink once, which is the
# slow part.
#
# Configuration:
#   VYOH_DEPLOY_HOST            ssh target (required), as for deploy.sh
#   VYOH_DEPLOY_PATH            checkout on the box       (default /srv/vyoh)
#   VYOH_DRILL_KEY_ID           the drill key's id
#   VYOH_DRILL_APPLICATION_KEY  the drill key itself
#   VYOH_AGE_IDENTITY           path to the age private key; a process
#                               substitution works, so it need not touch disk

cyan() { printf '\033[0;36m%s\033[0m\n' "$1"; }
green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$1"; }
red() { printf '\033[0;31m%s\033[0m\n' "$1"; }

host="${VYOH_DEPLOY_HOST:-}"
remote="${VYOH_DEPLOY_PATH:-/srv/vyoh}"
prefix="vyoh/"
: "${VYOH_DRILL_KEY_ID:?}" "${VYOH_DRILL_APPLICATION_KEY:?}" "${VYOH_AGE_IDENTITY:?}"

if [[ -z $host ]]; then
  red "VYOH_DEPLOY_HOST is not set."
  exit 1
fi
# Interpolated into the command the box runs, so held to plain path characters.
if [[ ! $remote =~ ^/[A-Za-z0-9._/-]+$ ]]; then
  red "Refusing VYOH_DEPLOY_PATH=${remote}."
  exit 1
fi
# -r rather than -f: a process substitution is a readable pipe, not a file.
if [[ ! -r $VYOH_AGE_IDENTITY ]]; then
  red "No identity at ${VYOH_AGE_IDENTITY}."
  exit 1
fi

for tool in age curl jq shasum base64 ssh; do
  command -v "$tool" >/dev/null || {
    red "${tool} is not installed."
    exit 1
  }
done

work="$(mktemp -d)"
# The decrypted archive is the whole database; it leaves this machine only for
# the box's scratch database.
trap 'rm -rf "$work"' EXIT

b2() { curl -sS --fail-with-body --connect-timeout 30 --max-time 1800 "$@"; }
b2_said() { jq -er 'select(.code) | "\(.status) \(.code): \(.message // "")"' <<<"$1" 2>/dev/null || echo "no answer B2 could have sent"; }

cyan "→ list ${prefix}"
auth="$(printf 'Authorization: Basic %s\n' \
  "$(printf '%s:%s' "$VYOH_DRILL_KEY_ID" "$VYOH_DRILL_APPLICATION_KEY" | base64 | tr -d '\n')" |
  b2 -H @- https://api.backblazeb2.com/b2api/v4/b2_authorize_account)" || {
  red "authorize: $(b2_said "$auth")"
  exit 1
}
jq -e '.apiInfo.storageApi.allowed.buckets | length == 1' <<<"$auth" >/dev/null || {
  red "The drill key must be restricted to the one bucket."
  exit 1
}
token="$(jq -r .authorizationToken <<<"$auth")"
api="$(jq -r .apiInfo.storageApi.apiUrl <<<"$auth")"
download="$(jq -r .apiInfo.storageApi.downloadUrl <<<"$auth")"
bucket_id="$(jq -r '.apiInfo.storageApi.allowed.buckets[0].id' <<<"$auth")"
bucket_name="$(jq -r '.apiInfo.storageApi.allowed.buckets[0].name' <<<"$auth")"
can_see_lock="$(jq -r '.apiInfo.storageApi.allowed.capabilities | index("readFileRetentions") != null' <<<"$auth")"

listing="$(printf 'Authorization: %s\n' "$token" |
  b2 -H @- "${api}/b2api/v4/b2_list_file_names?bucketId=${bucket_id}&prefix=${prefix}&maxFileCount=1000")" || {
  red "list: $(b2_said "$listing")"
  exit 1
}
# Retention keeps about thirty. A full page means the bucket is not pruning.
jq -e '.nextFileName == null' <<<"$listing" >/dev/null || {
  red "More than 1000 copies under ${prefix} — is the lifecycle rule set?"
  exit 1
}

copies="$(jq '[.files[] | select(.action == "upload")]' <<<"$listing")"
if [[ "$(jq length <<<"$copies")" -eq 0 ]]; then
  red "No copies under ${prefix} in ${bucket_name}."
  exit 1
fi
newest="$(jq 'max_by(.uploadTimestamp)' <<<"$copies")"
name="$(jq -r .fileName <<<"$newest")"
if [[ ! $name =~ ^vyoh/vyoh-[0-9]{8}T[0-9]{6}Z\.dump\.age$ ]]; then
  red "Unexpected name ${name}."
  exit 1
fi

now="$(date +%s)"
age_hours=$(((now - $(jq '.uploadTimestamp / 1000 | floor' <<<"$newest")) / 3600))
oldest_days=$(((now - $(jq 'min_by(.uploadTimestamp).uploadTimestamp / 1000 | floor' <<<"$copies")) / 86400))
green "  $(jq length <<<"$copies") copies, the oldest ${oldest_days} days old"
green "  newest ${name}, uploaded ${age_hours}h ago"
# The timer fires at 03:30 Brussels; a day and a bit covers a slow night.
if [[ $age_hours -gt 26 ]]; then
  yellow "  more than a day old — has the nightly upload been failing?"
fi

cyan "→ fetch and check"
printf 'Authorization: %s\n' "$token" |
  b2 -H @- -D "${work}/headers" -o "${work}/sealed" "${download}/file/${bucket_name}/${name}" || {
  # An error body is small; a transfer that died partway is not.
  red "download: $(b2_said "$(head -c 4096 "${work}/sealed" 2>/dev/null)")"
  exit 1
}
if [[ "$(shasum -a 1 "${work}/sealed" | cut -d' ' -f1)" != "$(jq -r .contentSha1 <<<"$newest")" ]]; then
  red "The download does not match the SHA-1 B2 recorded for it."
  exit 1
fi

header() { tr -d '\r' <"${work}/headers" | awk -F': ' -v h="$1" 'tolower($1) == h { print $2 }'; }
if [[ $can_see_lock != true ]]; then
  yellow "  lock: unknown, this key has no readFileRetentions"
elif [[ -n "$(header x-bz-file-retention-mode)" ]]; then
  until_s=$(($(header x-bz-file-retention-retain-until-timestamp) / 1000))
  until_day="$(date -u -r "$until_s" +%Y-%m-%dT%H:%MZ 2>/dev/null || date -u -d "@${until_s}" +%Y-%m-%dT%H:%MZ)"
  green "  lock: $(header x-bz-file-retention-mode) until ${until_day}"
else
  red "  lock: none — nothing stops the box's key from hiding this copy into deletion"
fi

cyan "→ decrypt"
age -d -i "$VYOH_AGE_IDENTITY" -o "${work}/archive.dump" "${work}/sealed"
green "  $(du -h "${work}/archive.dump" | cut -f1)  decrypted"

cyan "→ restore drill on ${host}"
# Beside the box's own archives, whose directory is deploy's, under a name
# neither backup.sh's retention nor offsite.sh's pick can match, and removed
# however the drill ends.
ssh "$host" "f=\"\$(mktemp /var/backups/vyoh/.drill-XXXXXX)\" || exit 1
trap 'rm -f \"\$f\"' EXIT
cat >\"\$f\" && ${remote}/scripts/restore.sh \"\$f\"" <"${work}/archive.dump"
