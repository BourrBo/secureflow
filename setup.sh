#!/usr/bin/env bash
# SecureFlow — one-time Docker setup (macOS / Linux)
#
# Run this once after cloning the repo, from the repo root:
#     ./setup.sh
#
# It copies the .env.docker.example templates to real .env.docker files
# (only if they don't already exist — never overwrites what you have),
# then tells you which values you still need to fill in before running:
#     docker compose up --build

set -euo pipefail

bootstrap_env_file() {
  local example="$1" target="$2"
  if [ -f "$target" ]; then
    echo "  [skip] $target already exists"
    return
  fi
  if [ ! -f "$example" ]; then
    echo "  [warn] $example not found — nothing to copy"
    return
  fi
  cp "$example" "$target"
  echo "  [made] $target (from $example)"
}

echo "SecureFlow Docker setup"
echo "------------------------"

bootstrap_env_file "backend/.env.docker.example"    "backend/.env.docker"
bootstrap_env_file "secureflow/.env.docker.example" "secureflow/.env.docker"

echo ""
echo "Next: open the files below and fill in real values (get them from"
echo "whoever manages the team's Supabase project — never commit these):"
echo "  - backend/.env.docker      (SUPABASE_URL, SUPABASE_ANON_KEY, DATABASE_URL required)"
echo "  - secureflow/.env.docker   (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY required)"
echo ""
echo "Then run:  docker compose up --build"
