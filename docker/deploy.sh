#!/usr/bin/env bash
set -euo pipefail

# active_color is this script's source of truth for which slot is live.
# upstream.conf is nginx's source of truth. They are kept in sync by writing
# active_color *before* nginx -s reload — so a crash mid-deploy always leaves
# upstream.conf as the authority on what nginx is actually serving.

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ACTIVE=$(cat "$DIR/active_color")
INACTIVE=$([ "$ACTIVE" = "red" ] && echo "black" || echo "red")

echo "==> Deploying to $INACTIVE (currently active: $ACTIVE)"

# Pull latest image from registry; no-op if image is local-only (e.g. local dev)
docker compose pull "$INACTIVE" 2>/dev/null || echo "==> No remote image found, using local build"

# Start the inactive color.
# black has a compose profile so it doesn't start on plain `docker compose up -d`;
# red has no profile because it is the default active slot.
if [ "$INACTIVE" = "black" ]; then
    docker compose --profile black up -d black
else
    docker compose up -d red
fi

# Wait for healthy (30 × 2s = 60s timeout)
echo "==> Waiting for $INACTIVE to become healthy..."
for i in $(seq 1 30); do
    CONTAINER_ID=$(docker compose ps -q "$INACTIVE" | head -1)
    HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_ID" 2>/dev/null || true)
    [ "$HEALTH" = "healthy" ] && break
    if [ "$i" -eq 30 ]; then
        echo "ERROR: $INACTIVE never became healthy" >&2
        docker compose logs --tail=50 "$INACTIVE" >&2
        docker compose stop "$INACTIVE"
        exit 1
    fi
    sleep 2
done
echo "==> $INACTIVE is healthy"

# Record new active color before reloading nginx so both files stay in sync
# even if the process is killed between the two writes.
echo "$INACTIVE" > "$DIR/active_color"

# Switch nginx upstream and reload. nginx -s reload is zero-downtime:
# in-flight requests to the old upstream finish before nginx stops routing there.
echo "upstream backend { server $INACTIVE:3000; }" > "$DIR/nginx/upstream.conf"
docker compose exec nginx nginx -s reload
echo "==> nginx reloaded — traffic now on $INACTIVE"

# Post-switch health check. If the new slot crashes immediately after taking
# traffic, roll back to the old slot (which is still running at this point).
sleep 5
CONTAINER_ID=$(docker compose ps -q "$INACTIVE" | head -1)
HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_ID" 2>/dev/null || true)
if [ "$HEALTH" != "healthy" ]; then
    echo "ERROR: $INACTIVE failed after traffic switch — rolling back to $ACTIVE" >&2
    echo "upstream backend { server $ACTIVE:3000; }" > "$DIR/nginx/upstream.conf"
    echo "$ACTIVE" > "$DIR/active_color"
    docker compose exec nginx nginx -s reload
    docker compose stop "$INACTIVE"
    exit 1
fi

# Stop the old slot. Using `stop` (not `down`) intentionally — the container
# stays in Docker's state for quick manual rollback if needed.
docker compose stop "$ACTIVE"
echo "==> $ACTIVE stopped. Deploy complete."
