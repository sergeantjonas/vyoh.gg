#!/usr/bin/env bash
set -euo pipefail

# Send the newest archive off the box: encrypted with age to the owner's public
# key, then uploaded to Backblaze B2 under a key that can write into vyoh/ and
# nothing else. Runs after backup.sh in the same unit, so a dump that failed
# stops the unit before this starts and the newest archive is the one just
# written.
#
#   scripts/offsite.sh
#
# Configuration:
#   VYOH_BACKUP_DIR          where archives are read  (default /var/backups/vyoh)
#   VYOH_B2_KEY_ID           the upload key's id
#   VYOH_B2_APPLICATION_KEY  the upload key itself
#   VYOH_AGE_RECIPIENT       age1…, the public half; the private half is never
#                            on this box
#
# B2's native API over curl rather than a sync tool: the three calls made here
# need nothing past writeFiles, where a sync tool also wants to list what is
# already there. B2 refuses an upload whose SHA-1 does not match the bytes that
# arrived, so an upload that succeeds is a complete one. Retention is the
# bucket's lifecycle rule and its lock, not anything this script does.

cyan() { printf '\033[0;36m%s\033[0m\n' "$1"; }
green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$1"; }
red() { printf '\033[0;31m%s\033[0m\n' "$1"; }

backup_dir="${VYOH_BACKUP_DIR:-/var/backups/vyoh}"
: "${VYOH_B2_KEY_ID:?}" "${VYOH_B2_APPLICATION_KEY:?}" "${VYOH_AGE_RECIPIENT:?}"

# Checked before age sees it, and never echoed: the private key pasted here by
# mistake would otherwise be printed back in age's error, into the journal and
# from there into the failure report heartbeat.sh sends off the box.
if [[ ! $VYOH_AGE_RECIPIENT =~ ^age1[0-9a-z]+$ ]]; then
  red "VYOH_AGE_RECIPIENT is not an age public key (age1…); nothing was sealed."
  exit 1
fi

# The key is made with this prefix and refused below without it, so a key
# pasted in from the wrong entry fails loudly instead of writing somewhere else.
prefix="vyoh/"

for tool in age curl jq sha1sum base64; do
  command -v "$tool" >/dev/null || {
    red "${tool} is not installed."
    exit 1
  }
done

# By name, not mtime, for the reason backup.sh gives: the stamp sorts, and the
# filesystem's timestamps are anyone's to rewrite.
archive="$(find "$backup_dir" -maxdepth 1 -name 'vyoh-*.dump' -type f | sort | tail -n 1)"
if [[ -z $archive ]]; then
  red "No archive to send in ${backup_dir}."
  exit 1
fi

name="${prefix}$(basename "$archive").age"
# B2 wants the name percent-encoded; holding it to characters that encode to
# themselves avoids encoding it at all.
if [[ ! $name =~ ^vyoh/vyoh-[0-9]{8}T[0-9]{6}Z\.dump\.age$ ]]; then
  red "Refusing to name an upload ${name}."
  exit 1
fi

# The sealed copy is as large as the archive, so it goes beside the archives
# rather than in /tmp, which on this box is memory. Timers do not overlap, so a
# sealed copy still here from an earlier run is dead.
find "$backup_dir" -maxdepth 1 -name '.offsite-*' -type f -delete
sealed="$(mktemp -p "$backup_dir" .offsite-XXXXXX)"
trap 'rm -f "$sealed"' EXIT

cyan "→ seal $(basename "$archive")"
age -r "$VYOH_AGE_RECIPIENT" -o "$sealed" "$archive"
sha1="$(sha1sum "$sealed" | cut -d' ' -f1)"

b2() { curl -sS --fail-with-body --connect-timeout 30 --max-time 600 "$@"; }
# What B2 said and nothing more: a transfer cut off partway through a good reply
# leaves a live token in the body, and the body goes to the journal.
b2_said() { jq -er 'select(.code) | "\(.status) \(.code): \(.message // "")"' <<<"$1" 2>/dev/null || echo "no answer B2 could have sent"; }

# Credentials reach curl on stdin, not as arguments, which every user on the
# box can read from the process list.
send() {
  local auth token api bucket target reply

  auth="$(printf 'Authorization: Basic %s\n' \
    "$(printf '%s:%s' "$VYOH_B2_KEY_ID" "$VYOH_B2_APPLICATION_KEY" | base64 | tr -d '\n')" |
    b2 -H @- https://api.backblazeb2.com/b2api/v4/b2_authorize_account)" ||
    {
      echo "authorize: $(b2_said "$auth")"
      return 1
    }
  jq -e . <<<"$auth" >/dev/null 2>&1 || {
    echo "authorize answered with something other than JSON"
    return 1
  }

  # Checked on every run rather than trusted from the day the key was made: a
  # key that can also read or delete voids the reason for sending this here.
  jq -e --arg prefix "$prefix" '.apiInfo.storageApi.allowed
      | .capabilities == ["writeFiles"]
        and .namePrefix == $prefix
        and (.buckets | length) == 1' <<<"$auth" >/dev/null ||
    {
      echo "the key must hold writeFiles alone, on one bucket, under ${prefix}; it holds $(jq -c .apiInfo.storageApi.allowed <<<"$auth")"
      return 2
    }

  token="$(jq -r .authorizationToken <<<"$auth")"
  api="$(jq -r .apiInfo.storageApi.apiUrl <<<"$auth")"
  bucket="$(jq -r '.apiInfo.storageApi.allowed.buckets[0].id' <<<"$auth")"

  # A fresh upload URL on every attempt: B2 answers a busy or expired one with
  # a 503 or a 401 and expects the client to ask for another.
  target="$(printf 'Authorization: %s\n' "$token" |
    b2 -H @- "${api}/b2api/v4/b2_get_upload_url?bucketId=${bucket}")" ||
    {
      echo "get upload url: $(b2_said "$target")"
      return 1
    }

  # --upload-file streams the archive; --data-binary @file would read all of
  # it into memory first.
  reply="$(printf 'Authorization: %s\nX-Bz-File-Name: %s\nContent-Type: application/octet-stream\nX-Bz-Content-Sha1: %s\n' \
    "$(jq -r .authorizationToken <<<"$target")" "$name" "$sha1" |
    b2 -H @- -X POST --upload-file "$sealed" "$(jq -r .uploadUrl <<<"$target")")" ||
    {
      echo "upload: $(b2_said "$reply")"
      return 1
    }

  local stored
  stored="$(jq -r .contentSha1 <<<"$reply" 2>/dev/null)"
  [[ $stored == "$sha1" ]] || {
    echo "upload answered with SHA-1 ${stored:-none}, not the ${sha1} that was sent"
    return 1
  }
  jq -r .fileId <<<"$reply"
}

cyan "→ upload ${name}"
for attempt in 1 2 3; do
  status=0
  out="$(send)" || status=$?
  if [[ $status -eq 0 ]]; then
    green "  $(du -h "$sealed" | cut -f1)  ${out}"
    green ""
    green "Sent $(basename "$archive") off the box as ${name}."
    exit 0
  fi
  yellow "  attempt ${attempt}: ${out}"
  # A key with the wrong reach is not going to change between attempts.
  [[ $status -eq 2 ]] && break
  [[ $attempt -lt 3 ]] && sleep $((attempt * 15))
done
red "Nothing was sent off the box."
exit 1
