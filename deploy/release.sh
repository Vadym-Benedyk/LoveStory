#!/usr/bin/env bash
# Releases the site and the API on this server: the commit of `main` that GitHub Actions asks for (or the
# tip of main).
#
# Runs as the forced command of the deploy key in ~/.ssh/authorized_keys, so the key can do nothing else:
#   command="/opt/lovestory/deploy/release.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAA... github-actions
# The workflow (.github/workflows/deploy.yml) connects with `ssh ubuntu@<server> <sha>`; the requested
# command arrives in SSH_ORIGINAL_COMMAND and is only accepted as a 40-character commit id or `check`.
# By hand on the server: deploy/release.sh [<sha>|check]
#
# Steps: backup of the database, checkout of the commit, image builds (API, tools, Caddy with the client),
# schema push, container swap, health check of the API and the site. Any failure stops the release and the running containers stay as they were (`build` only makes new
# images; `up` replaces the API only after the schema push went through). A schema change that would lose
# data stops at `prisma db push`: decide by hand (deploy/README.md, Release).
#
# The whole body is inside main(), so bash has read all of it before `git checkout` replaces this file.
set -euo pipefail

main() {
  local repo=/opt/lovestory
  local arg="${SSH_ORIGINAL_COMMAND:-${1:-}}"
  local log=/home/ubuntu/lovestory-release.log

  # One release at a time; a second one waits up to 20 minutes, then fails.
  exec 9>/tmp/lovestory-release.lock
  flock -w 1200 9 || { echo "release: another release is still running" >&2; exit 1; }

  cd "$repo"
  git fetch --quiet origin main

  if [ "$arg" = "check" ]; then
    echo "release: ok, can reach origin/main ($(git rev-parse --short origin/main)), docker $(docker --version | cut -d' ' -f3 | tr -d ,)"
    exit 0
  fi

  local sha
  if [ -z "$arg" ]; then
    sha=$(git rev-parse origin/main)
  elif [[ "$arg" =~ ^[0-9a-f]{40}$ ]]; then
    sha=$arg
  else
    echo "release: expected a commit id or 'check', got something else" >&2
    exit 2
  fi
  # Only commits that are on main: the key cannot be used to deploy an arbitrary branch.
  git merge-base --is-ancestor "$sha" origin/main || { echo "release: $sha is not on origin/main" >&2; exit 2; }

  echo "release: $(date -u +%FT%TZ) $(git rev-parse --short HEAD) -> ${sha:0:7}" | tee -a "$log"

  # A dump before anything changes (kept with the nightly ones; uploaded too when BACKUP_S3_URI is set in
  # the crontab environment, not here).
  PATH=/usr/bin:/bin:/snap/bin "$repo/deploy/backup.sh"

  git checkout --quiet --force --detach "$sha"

  cd "$repo/deploy"
  docker compose --profile tools build --quiet
  docker compose run --rm -T tools npm run --silent prisma:push
  docker compose up -d --wait --remove-orphans

  local domain
  domain=$(grep -E '^DOMAIN=' .env | head -1 | cut -d= -f2-)
  for _ in 1 2 3 4 5 6; do
    if curl -fsS -m 10 "https://$domain/api/health" >/dev/null && curl -fsS -m 10 "https://$domain/" >/dev/null; then
      docker image prune -f >/dev/null
      echo "release: done, ${sha:0:7} is live" | tee -a "$log"
      exit 0
    fi
    sleep 5
  done
  echo "release: no answer from https://$domain/ or https://$domain/api/health" | tee -a "$log" >&2
  exit 1
}

main "$@"
# shellcheck disable=SC2317  # not reached; keeps bash from reading past main() after the checkout
exit
