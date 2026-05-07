#!/usr/bin/env bash
set -euo pipefail

# Idempotent local bootstrap for vyoh.gg.
# Safe to re-run: each step checks before acting.

cd "$(dirname "$0")/.."

cyan() { printf '\033[0;36m%s\033[0m\n' "$1"; }
green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$1"; }
red() { printf '\033[0;31m%s\033[0m\n' "$1" >&2; }

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    red "Missing required command: $1"
    red "$2"
    exit 1
  fi
}

require pnpm "Install pnpm 10+ — see https://pnpm.io/installation"
require docker "Install Docker — see https://docs.docker.com/get-docker/"

if ! docker info >/dev/null 2>&1; then
  red "Docker is installed but not running. Start the Docker daemon and re-run."
  exit 1
fi

cyan "→ env files"
copy_if_missing() {
  local src=$1 dst=$2
  if [[ -f $dst ]]; then
    yellow "  $dst exists — leaving as-is"
  else
    cp "$src" "$dst"
    green "  $dst created from $src"
  fi
}
copy_if_missing .env.example .env
copy_if_missing apps/api/.env.example apps/api/.env

cyan "→ install workspace deps"
pnpm install

cyan "→ start postgres"
docker compose up -d --wait postgres

cyan "→ apply prisma migrations"
pnpm --filter @vyoh/api exec prisma migrate deploy

cyan "→ seed database"
pnpm --filter @vyoh/api db:seed

green ""
green "Bootstrap complete. Run 'pnpm dev' to start the web + api."

if grep -q "RGAPI-XXXXXXXX" apps/api/.env 2>/dev/null; then
  yellow ""
  yellow "Heads up: apps/api/.env still has the placeholder RIOT_API_KEY."
  yellow "Get a 24h dev key at https://developer.riotgames.com/ and paste it in."
fi
