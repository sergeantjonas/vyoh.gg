#!/usr/bin/env bash
set -euo pipefail

# Deploy to the VPS. Runs from a local checkout: rsync the tree up, rebuild the
# images there, restart the stack, then prove it answers.
#
#   VYOH_DEPLOY_HOST=vyoh scripts/deploy.sh
#
# Images are built on the VPS rather than locally and pushed, because there is
# no registry in this setup and `docker save | ssh docker load` moves ~2 GB per
# deploy over a link that is slower than the CAX31 is at building.
#
# Configuration, all overridable:
#   VYOH_DEPLOY_HOST  ssh target (required) — a Host entry in ~/.ssh/config
#   VYOH_DEPLOY_PATH  remote checkout       (default /srv/vyoh)
#   VYOH_WEB_URL      loopback smoke target (default http://127.0.0.1:2009)
#   VYOH_API_URL      loopback smoke target (default http://127.0.0.1:2010)

cd "$(dirname "$0")/.."

cyan() { printf '\033[0;36m%s\033[0m\n' "$1"; }
green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$1"; }
red() { printf '\033[0;31m%s\033[0m\n' "$1"; }

host="${VYOH_DEPLOY_HOST:-}"
remote="${VYOH_DEPLOY_PATH:-/srv/vyoh}"
web_url="${VYOH_WEB_URL:-http://127.0.0.1:2009}"
api_url="${VYOH_API_URL:-http://127.0.0.1:2010}"

if [[ -z $host ]]; then
  red "VYOH_DEPLOY_HOST is not set."
  echo "  VYOH_DEPLOY_HOST=vyoh scripts/deploy.sh"
  exit 1
fi

commit="$(git rev-parse --short HEAD)"
if [[ -n "$(git status --porcelain)" ]]; then
  yellow "Working tree is dirty — deploying it anyway, but ${commit} will not describe what ships."
fi

cyan "→ sync ${PWD} → ${host}:${remote} (${commit})"
# --delete so a file removed locally is removed there; without it a route or a
# migration deleted in a refactor keeps living on the server.
#
# .env is excluded rather than synced: production secrets live on the VPS and
# have no local counterpart. Everything else here is either rebuilt in the
# image or has no business leaving the dev box.
rsync -az --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude 'coverage/' \
  --exclude '.pnpm-store/' \
  --exclude '.postgres-data/' \
  --exclude '.cache/' \
  --exclude '.env' \
  --exclude '**/.env' \
  ./ "${host}:${remote}/"

cyan "→ build + restart on ${host}"
# BUILD_COMMIT is passed through to the web image so the status page reports the
# SHA that shipped; inside the image there is no .git for vite.config.ts to ask.
ssh "$host" "cd ${remote} && BUILD_COMMIT=${commit} docker compose -f compose.prod.yaml up -d --build"

cyan "→ drop dangling images"
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

green ""
green "Deployed ${commit} to ${host}."
