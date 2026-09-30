#!/usr/bin/env bash
set -uo pipefail

# Tell healthchecks.io how the unit that ran this ended, from that unit's
# ExecStopPost: a success, or a failure carrying the run's last journal lines.
#
#   ExecStopPost=-/srv/vyoh/scripts/heartbeat.sh vyoh-backup
#
# The argument is the check's slug, which is also the unit's name. The ping
# key, VYOH_HC_PING_KEY, comes from the unit's EnvironmentFile. The backup's
# lines are archive names, sizes and B2's errors, so they are safe to hand a
# third party; a unit whose output names people's data must not use this as
# it stands, since it always attaches them.
#
# What raises the alarm is a check going quiet, not this script succeeding: a
# night that never runs, a box that is down and a key that is missing all end
# with no ping, and healthchecks.io alerts once the check's grace runs out. So
# this always exits 0, and the unit's own result is never changed by it.

slug="${1:-}"

if [[ ! $slug =~ ^[a-z0-9-]+$ ]]; then
  echo "heartbeat: refusing slug '${slug}'" >&2
  exit 0
fi
if [[ -z ${VYOH_HC_PING_KEY:-} ]]; then
  echo "heartbeat: VYOH_HC_PING_KEY is not set, so ${slug} goes unreported and will alert" >&2
  exit 0
fi

path=""
body="/dev/null"
# systemd sets SERVICE_RESULT for ExecStopPost; anything but success, a
# timeout included, is a failure.
if [[ ${SERVICE_RESULT:-} != success ]]; then
  path="/fail"
  body="$(mktemp)"
  trap 'rm -f "$body"' EXIT
  echo "result=${SERVICE_RESULT:-unknown} exit=${EXIT_CODE:-?}/${EXIT_STATUS:-?}" >"$body"
  if [[ -n ${INVOCATION_ID:-} ]]; then
    # offsite.sh refuses a private age key before age can print it, and this
    # redaction is the second line: that key opens every off-box copy.
    journalctl -q --no-pager -o cat -n 30 _SYSTEMD_INVOCATION_ID="$INVOCATION_ID" 2>&1 |
      sed -e 's/\x1b\[[0-9;]*m//g' -e 's/AGE-SECRET-KEY-1[0-9A-Za-z]*/AGE-SECRET-KEY-[redacted]/g' >>"$body"
  fi
fi

# The key reaches curl in a config on stdin rather than in the URL on its
# command line, which every user on the box can read from the process list.
printf 'url = "https://hc-ping.com/%s/%s%s"\n' "$VYOH_HC_PING_KEY" "$slug" "$path" |
  curl -fsS --max-time 10 --retry 3 -o /dev/null -K - --data-binary @"$body" ||
  echo "heartbeat: could not reach healthchecks.io, so ${slug} will alert" >&2
exit 0
