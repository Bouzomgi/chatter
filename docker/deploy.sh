#!/usr/bin/env bash
set -euo pipefail

# active_color is this script's source of truth for which slot is live.
# upstream.conf is nginx's source of truth. They are kept in sync by writing
# active_color *before* nginx -s reload — so a crash mid-deploy always leaves
# upstream.conf as the authority on what nginx is actually serving.

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Bootstrap state files on first run (they are gitignored; defaults to red)
[ -f "$DIR/active_color" ] || echo "red" > "$DIR/active_color"
[ -f "$DIR/nginx/upstream.conf" ] || echo "upstream backend { server red:3000; }" > "$DIR/nginx/upstream.conf"

ACTIVE=$(cat "$DIR/active_color")
INACTIVE=$([ "$ACTIVE" = "red" ] && echo "black" || echo "red")

# Cold start: if no containers are running yet, bring up the full stack and exit.
# This handles the first-run case after a fresh clone or Pi reboot.
# State files are now bootstrapped above, so Docker won't create directories in
# place of the missing bind-mounted files.
cd "$(dirname "$DIR")"
if [ -z "$(docker compose ps -q 2>/dev/null)" ]; then
    echo "==> Cold start: bringing up stack on $ACTIVE"
    if [ "$ACTIVE" = "black" ]; then
        docker compose --profile black up -d
    else
        docker compose up -d
    fi
    echo "==> Stack is up on $ACTIVE. Run deploy.sh again to do a zero-downtime deploy."
    exit 0
fi

echo "==> Deploying to $INACTIVE (currently active: $ACTIVE)"

# Pull latest image from registry. Set SKIP_PULL=1 to use locally built images (e.g. CI).
if [ -z "${SKIP_PULL:-}" ]; then
    docker compose pull "$INACTIVE" 2>/dev/null || echo "==> No remote image found, using local build"
fi

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

# Optional pre-swap hook — run E2E or smoke tests against the inactive slot
# before it takes live traffic. Set DEPLOY_HOOK to a shell command; the
# inactive slot is reachable at its dedicated host port (red=3001, black=3002).
if [ -n "${DEPLOY_HOOK:-}" ]; then
    INACTIVE_PORT=$([ "$INACTIVE" = "red" ] && echo "3001" || echo "3002")
    echo "==> Running deploy hook against $INACTIVE (http://localhost:$INACTIVE_PORT)"
    PLAYWRIGHT_BASE_URL="http://localhost:$INACTIVE_PORT" SMOKE_BASE_URL="http://localhost:$INACTIVE_PORT" eval "$DEPLOY_HOOK" || {
        echo "ERROR: deploy hook failed — aborting, $INACTIVE not promoted" >&2
        docker compose stop "$INACTIVE"
        exit 1
    }
fi

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
