#!/usr/bin/env bash
set -euo pipefail

# Destructive: stops the postgres container and drops its volume.
# Re-run 'pnpm bootstrap' afterwards to rebuild from zero.

cd "$(dirname "$0")/.."

cyan() { printf '\033[0;36m%s\033[0m\n' "$1"; }
green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$1"; }

skip_prompt=false
for arg in "$@"; do
  case "$arg" in
    -y | --yes) skip_prompt=true ;;
  esac
done

yellow "This will stop the postgres container AND drop its volume."
yellow "All local match/summoner data will be lost. .env files are kept."

if [[ $skip_prompt == false ]]; then
  read -r -p "Continue? [y/N] " reply
  if [[ ! $reply =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

cyan "→ stop postgres + drop volume"
docker compose down -v

green ""
green "Reset complete. Run 'pnpm bootstrap' to rebuild."
