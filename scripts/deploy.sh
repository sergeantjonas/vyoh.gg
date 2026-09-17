#!/usr/bin/env bash
set -euo pipefail

# Deploy to the VPS: ship the ops files, pull the images CI already built,
# restart the stack, then prove it answers.
#
#   VYOH_DEPLOY_HOST=vyoh scripts/deploy.sh
#   VYOH_DEPLOY_HOST=vyoh VYOH_IMAGE_TAG=sha-1a2b3c4 scripts/deploy.sh
#
# The box never builds. Both images come from the `images` job in
# .github/workflows/ci.yml on every green push to `main`, and a deploy is a pull
# of one commit's pair — which is what keeps a `pnpm install` plus a Vite SSR
# build off a box that is also serving, and makes a rollback a tag rather than a
# rebuild under incident pressure. See docs/working-notes/ops/image-pipeline.md.
#
# Configuration, all overridable:
#   VYOH_DEPLOY_HOST  ssh target (required) — a Host entry in ~/.ssh/config
#   VYOH_DEPLOY_PATH  remote checkout       (default /srv/vyoh)
#   VYOH_IMAGE_TAG    image tag to deploy   (default sha-<short HEAD>)
#   VYOH_WEB_URL      loopback smoke target (default http://127.0.0.1:2009)
#   VYOH_API_URL      loopback smoke target (default http://127.0.0.1:2010)
#   VYOH_PUBLIC_WEB_URL  public smoke target (default https://vyoh.gg)
#   VYOH_PUBLIC_API_URL  public smoke target (default https://api.vyoh.gg)

cd "$(dirname "$0")/.."

cyan() { printf '\033[0;36m%s\033[0m\n' "$1"; }
green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$1"; }
red() { printf '\033[0;31m%s\033[0m\n' "$1"; }

host="${VYOH_DEPLOY_HOST:-}"
remote="${VYOH_DEPLOY_PATH:-/srv/vyoh}"
web_url="${VYOH_WEB_URL:-http://127.0.0.1:2009}"
api_url="${VYOH_API_URL:-http://127.0.0.1:2010}"
# Overridable so the script stays usable for a second tenant on the same box.
public_web_url="${VYOH_PUBLIC_WEB_URL:-https://vyoh.gg}"
public_api_url="${VYOH_PUBLIC_API_URL:-https://api.vyoh.gg}"
api_image="ghcr.io/sergeantjonas/vyoh-api"
web_image="ghcr.io/sergeantjonas/vyoh-web"

if [[ -z $host ]]; then
  red "VYOH_DEPLOY_HOST is not set."
  echo "  VYOH_DEPLOY_HOST=vyoh scripts/deploy.sh"
  exit 1
fi

# --short=7 rather than --short: `core.abbrev` lengthens the prefix as a repo
# grows, and the tag CI writes is exactly seven characters of the sha.
commit="$(git rev-parse --short=7 HEAD)"
tag="${VYOH_IMAGE_TAG:-sha-${commit}}"

# The tag lands inside a remote command string, so refuse anything that is not
# a docker tag rather than letting a stray space mangle the command silently.
if [[ ! $tag =~ ^[A-Za-z0-9_][A-Za-z0-9._-]*$ ]]; then
  red "VYOH_IMAGE_TAG='${tag}' is not a valid docker tag."
  exit 1
fi

# BUILD_COMMIT has to describe the image, not the checkout. Deploying an older
# tag while stamping its Sentry events and its status page with today's HEAD is
# how a build identifier starts lying at exactly the moment it is being read.
#
# Only a `sha-` tag carries a commit. Under a moving tag the web bundle's baked
# `__BUILD_COMMIT__` is some real sha while nothing here can say which, so the
# runtime value is left unset rather than set to "main" — an empty build tag
# reads as unknown, where a wrong one reads as an answer.
if [[ $tag == sha-* ]]; then
  build_commit="${tag#sha-}"
else
  build_commit=""
  yellow "${tag} is a moving tag — BUILD_COMMIT left unset; the status page and Sentry releases will not name a commit."
fi

if [[ -n "$(git status --porcelain)" ]]; then
  yellow "Working tree is dirty — uncommitted changes are not in ${tag} and will not ship."
fi

cyan "→ verify ${tag} is published"
# Before anything on the box is touched. A tag that was never built has to fail
# here, as a refusal, rather than half-way through as a `pull` error against a
# stack that has already been stopped.
missing=0
for image in "$api_image" "$web_image"; do
  if docker manifest inspect "${image}:${tag}" >/dev/null 2>&1; then
    green "  found    ${image}:${tag}"
  else
    red "  missing  ${image}:${tag}"
    missing=1
  fi
done

if [[ $missing -ne 0 ]]; then
  red ""
  red "Nothing on ${host} was touched. A tag is missing when the commit was never"
  red "pushed, its check job is red, or the images job is still running:"
  red "  gh run list --branch main --limit 3"
  exit 1
fi

cyan "→ sync ops files → ${host}:${remote}"
# Only the ops surface ships: no source, no Dockerfiles, no lockfile. The images
# carry the application now, so anything else left on the box is drift that will
# read as the deployed code to whoever looks next.
#
# -R keeps each loose file's relative path. They are copied without --delete
# because at this level --delete means "remove everything else in /srv/vyoh",
# which is where `.env` and any operator scratch live. `deploy/` is a directory
# we do own end to end, so it gets its own pass with --delete and a retired
# nginx conf cannot linger there.
ssh "$host" "mkdir -p ${remote}"
rsync -azR compose.prod.yaml scripts/backup.sh scripts/restore.sh "${host}:${remote}/"
rsync -az --delete deploy/ "${host}:${remote}/deploy/"

cyan "→ pull ${tag} and restart on ${host}"
remote_env="VYOH_IMAGE_TAG=${tag} BUILD_COMMIT=${build_commit}"
ssh "$host" "cd ${remote} && ${remote_env} docker compose -f compose.prod.yaml pull"
# --no-build so a tag that vanished between the check above and here fails
# loudly rather than silently falling back to building on the box.
#
# --wait blocks on the healthchecks the images declare. A timeout is not a
# failed deploy by itself, so it warns and falls through: the smoke below names
# which endpoint is unhappy, which is the more useful diagnostic.
if ! ssh "$host" "cd ${remote} && ${remote_env} docker compose -f compose.prod.yaml up -d --no-build --wait --wait-timeout 300"; then
  # Deliberately vague, because this catches a health timeout, a missing `:?`
  # var, an ssh failure and a crash-looping container alike. The smoke below
  # distinguishes them by naming the endpoint that does not answer.
  yellow "  up did not complete cleanly — continuing to the smoke for a better diagnostic"
fi

# Written here rather than after the smoke, and the distinction matters: the
# containers are already up by this line, so a failed smoke below must not
# leave this file naming the *previous* tag while the new one is what is
# actually serving. It answers "what is running", which is the question asked
# during an incident, not "what was last known good".
ssh "$host" "printf '%s\n' '${tag}' > ${remote}/.image-tag"

cyan "→ drop dangling images"
# A no-op for `sha-` deploys: the previous tag still names its images, so
# nothing is dangling. That is the trade — disk grows per deploy, and a
# rollback to a recent tag needs no network. See the note's § Risks carried.
ssh "$host" "docker image prune -f" >/dev/null

cyan "→ smoke"
# `docker compose up -d` returns once the containers are started, and the api's
# own healthcheck has a 40s start period, so give the stack a moment before
# calling it a failed deploy.
smoke_failed=0
for target in "${api_url}/health" "${web_url}/robots.txt" "${web_url}/"; do
  status=""
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    status="$(ssh "$host" "curl -s -o /dev/null -w '%{http_code}' --max-time 10 '${target}'" || true)"
    [[ $status == "200" ]] && break
    sleep 3
  done
  if [[ $status == "200" ]]; then
    green "  200  ${target}"
  else
    red "  ${status:-no response}  ${target}"
    smoke_failed=1
  fi
done

if [[ $smoke_failed -ne 0 ]]; then
  red ""
  red "Deploy finished but the stack is not answering. Logs:"
  red "  ssh ${host} 'cd ${remote} && docker compose -f compose.prod.yaml logs --tail 100'"
  exit 1
fi

# The loopback smoke above proves the containers came up. It says nothing about
# whether anyone can reach them: DNS, nginx, TLS and the firewall all sit above
# it. On 2026-09-17 this script reported a successful deploy while the site was
# unreachable over IPv4, because the A records pointed at the provider's gateway
# rather than the server.
#
# Run from here rather than over ssh, deliberately. A curl on the box can be
# satisfied by a hosts entry or a loopback route and proves nothing about what a
# visitor gets.
cyan "→ public smoke"
public_failed=0
for target in "$public_web_url" "$public_web_url/robots.txt" "${public_api_url}/health"; do
  status=""
  for _ in 1 2 3 4 5; do
    status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$target" || true)"
    [[ $status == "200" ]] && break
    sleep 3
  done
  if [[ $status == "200" ]]; then
    green "  200  ${target}"
  else
    red "  ${status:-no response}  ${target}"
    public_failed=1
  fi
done

if [[ $public_failed -ne 0 ]]; then
  red ""
  red "The stack is healthy on the box but unreachable from here."
  red "That points at DNS, nginx, TLS or the firewall — not at the containers:"
  red "  dig +short ${public_web_url#https://}"
  red "  ssh ${host} 'sudo nginx -t && sudo systemctl status nginx --no-pager'"
  exit 1
fi

# Warnings, never failures. Both of the states below are legitimate — error
# tracking can be deliberately off, and shipping a config change you have not
# installed yet is a normal intermediate step. They just must not be silent,
# which is the same defect the public smoke above exists to close.
cyan "→ notices"
notices=0

# Read from .env rather than the container: an empty value is the thing being
# looked for, and `printenv` cannot distinguish unset from empty across the
# compose default. Values are never printed, only names.
empty_dsns="$(ssh "$host" 'cd '"${remote}"' 2>/dev/null || exit 0
for v in SENTRY_DSN SENTRY_WEB_DSN; do
  val=$(sed -n "s/^${v}=//p" .env 2>/dev/null)
  if [ -z "$val" ]; then echo "$v"; fi
done' || true)"

if [[ -n $empty_dsns ]]; then
  notices=1
  while read -r v; do
    [[ -z $v ]] && continue
    yellow "  ${v} is empty — that tier reports nothing, and looks identical to having nothing to report"
  done <<< "$empty_dsns"
fi

# The rsync above ships deploy/ to the box; it does not install anything.
# /etc/nginx and /etc/systemd/system hold copies, so a changed vhost or unit
# sits on the box while the old one keeps running. Reading both locations needs
# no privileges, which is why this reports rather than installs — see
# docs/working-notes/ops/post-launch-ops.md § Chunk 4 for why not to automate it.
#
# Newer-than, not different-from. The installed vhosts are *permanently*
# different: certbot rewrote them in place to add the TLS blocks and the :80
# redirect, while the repo keeps them plain HTTP on purpose. A content compare
# therefore fires on every deploy forever and becomes noise. An mtime compare
# stays quiet through certbot's edits (which make the installed copy newer) and
# speaks up for the case that matters — a file edited in the repo and shipped
# but never installed. `rsync -a` preserves mtimes, which is what makes this
# work; a fresh clone resets them and earns one spurious warning, at a moment
# when "check whether the box matches" is the right instinct anyway.
drift="$(ssh "$host" 'cd '"${remote}"'/deploy 2>/dev/null || exit 0
check() {
  [ -e "$2" ] || { echo "absent    $2"; return; }
  [ "$1" -nt "$2" ] && echo "stale     $2"
}
for f in nginx/*.conf; do
  [ -e "$f" ] || continue
  b=$(basename "$f")
  case "$b" in
    *cache.conf) check "$f" "/etc/nginx/conf.d/$b" ;;
    *)           check "$f" "/etc/nginx/sites-available/$b" ;;
  esac
done
for f in systemd/*.service systemd/*.timer; do
  [ -e "$f" ] || continue
  check "$f" "/etc/systemd/system/$(basename "$f")"
done' || true)"

if [[ -n $drift ]]; then
  notices=1
  yellow "  shipped ops config is not what is installed:"
  while read -r line; do
    [[ -z $line ]] && continue
    yellow "    ${line}"
  done <<< "$drift"
  yellow "  install with: sudo cp ${remote}/deploy/nginx/<file> /etc/nginx/sites-available/ && sudo nginx -t && sudo systemctl reload nginx"
fi

[[ $notices -eq 0 ]] && green "  none"

green ""
green "Deployed ${tag} to ${host}."
