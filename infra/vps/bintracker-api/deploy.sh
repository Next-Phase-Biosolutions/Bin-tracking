#!/usr/bin/env bash
# Zero-downtime blue-green deploy. Run from infra/vps/bintracker-api/ on the VPS
# (called by .github/workflows/deploy-vps.yml after `git pull`). See kvmplan.md §8.
set -euo pipefail
cd "$(dirname "$0")"

UPSTREAM_FILE=../caddy/upstream.txt
# Untracked Caddy snippet imported by ../caddy/Caddyfile — deploy.sh owns this
# file entirely. The Caddyfile itself is never modified here, so `git pull`
# can always fast-forward it without conflicts.
UPSTREAM_CADDY=../caddy/upstream.caddy

CURRENT=$(cat "$UPSTREAM_FILE" 2>/dev/null || echo "api_blue")
if [ "$CURRENT" = "api_blue" ]; then
  IDLE="api_green"; IDLE_PORT=3002
else
  IDLE="api_blue"; IDLE_PORT=3001
fi

echo "Live: $CURRENT — deploying to idle: $IDLE"

# Redis must be up before either API color or the worker starts (compose
# depends_on covers the containers it starts, but be explicit for first boot).
docker compose up -d redis

docker compose build "$IDLE"
docker compose up -d "$IDLE"

echo "Waiting for $IDLE health check..."
for i in $(seq 1 30); do
  if curl -sf "http://localhost:${IDLE_PORT}/health" > /dev/null; then
    echo "$IDLE is healthy."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "FAILED: $IDLE did not become healthy in 30s. Aborting, $CURRENT stays live."
    exit 1
  fi
  sleep 1
done

# Flip Caddy to the newly-healthy color by rewriting the untracked upstream
# snippet, then reloading. Never edits the tracked Caddyfile.
echo "to localhost:${IDLE_PORT}" > "$UPSTREAM_CADDY"
echo "$IDLE" > "$UPSTREAM_FILE"
docker exec caddy caddy reload --config /etc/caddy/Caddyfile

echo "Traffic flipped to $IDLE. Stopping $CURRENT."
docker compose stop "$CURRENT"

# Restart the worker on the image the idle-color build just produced (same
# bintracker-api:latest tag). Done after the flip so an in-flight job on the
# old worker gets its full SIGTERM grace period while traffic is already served
# by the new API color.
echo "Recreating worker on the new image."
docker compose up -d --force-recreate worker

echo "Deploy complete. Live: $IDLE"
