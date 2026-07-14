#!/usr/bin/env bash
# Zero-downtime blue-green deploy. Run from infra/vps/bintracker-api/ on the VPS
# (called by .github/workflows/deploy-vps.yml after `git pull`). See kvmplan.md §8.
set -euo pipefail
cd "$(dirname "$0")"

UPSTREAM_FILE=../caddy/upstream.txt
CADDYFILE=../caddy/Caddyfile

CURRENT=$(cat "$UPSTREAM_FILE" 2>/dev/null || echo "api_blue")
if [ "$CURRENT" = "api_blue" ]; then
  IDLE="api_green"; IDLE_PORT=3002
else
  IDLE="api_blue"; IDLE_PORT=3001
fi

echo "Live: $CURRENT — deploying to idle: $IDLE"

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

# Flip Caddy to the newly-healthy color
sed -i "s/to localhost:[0-9]*/to localhost:${IDLE_PORT}/" "$CADDYFILE"
echo "$IDLE" > "$UPSTREAM_FILE"
docker exec caddy caddy reload --config /etc/caddy/Caddyfile

echo "Traffic flipped to $IDLE. Stopping $CURRENT."
docker compose stop "$CURRENT"

echo "Deploy complete. Live: $IDLE"
