#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ACTIVE=$(cat "$DIR/active_color")
INACTIVE=$([ "$ACTIVE" = "red" ] && echo "black" || echo "red")

echo "==> Deploying to $INACTIVE (currently active: $ACTIVE)"

# Start the inactive color (black requires its profile; red has none)
if [ "$INACTIVE" = "black" ]; then
    docker compose --profile black up -d black
else
    docker compose up -d red
fi

# Wait for healthy (30 × 2s = 60s timeout)
echo "==> Waiting for $INACTIVE to become healthy..."
for i in $(seq 1 30); do
    HEALTH=$(docker inspect --format='{{.State.Health.Status}}' \
        "$(docker compose ps -q "$INACTIVE")" 2>/dev/null || true)
    [ "$HEALTH" = "healthy" ] && break
    if [ "$i" -eq 30 ]; then
        echo "ERROR: $INACTIVE never became healthy" >&2
        docker compose stop "$INACTIVE"
        exit 1
    fi
    sleep 2
done
echo "==> $INACTIVE is healthy"

# Switch nginx upstream and reload (zero-downtime)
echo "upstream backend { server $INACTIVE:3000; }" > "$DIR/nginx/upstream.conf"
docker compose exec nginx nginx -s reload
echo "==> nginx reloaded — traffic now on $INACTIVE"

# Record new active color
echo "$INACTIVE" > "$DIR/active_color"

# Stop old color
docker compose stop "$ACTIVE"
echo "==> $ACTIVE stopped. Deploy complete."
