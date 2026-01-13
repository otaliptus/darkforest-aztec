#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DEFAULT_RADIUS=200
DEFAULT_PLANET_RARITY=12
DEFAULT_TIME_FACTOR=1000
DEFAULT_SNAPSHOT_POLL_MS=5000
DEFAULT_SNAPSHOT_MIN_INTERVAL_MS=15000

RESET=0
DEPLOY=0
MINE_FOREGROUND=0
RUN_CLIENT=0
SKIP_BUILD=0
RUN_SNAPSHOT=0
RUN_SNAPSHOT_WATCH=0
SNAPSHOT_POLL_MS="$DEFAULT_SNAPSHOT_POLL_MS"
SNAPSHOT_MIN_INTERVAL_MS="$DEFAULT_SNAPSHOT_MIN_INTERVAL_MS"
RADIUS="$DEFAULT_RADIUS"
PLANET_RARITY="$DEFAULT_PLANET_RARITY"
TIME_FACTOR="$DEFAULT_TIME_FACTOR"
MINE_FOREGROUND_DELAY=""

usage() {
  cat <<USAGE
Usage: scripts/df-local.sh [options]

Options:
  --reset            Stop/remove aztec local-network container(s) (no ~/.aztec deletion)
  --deploy           Redeploy DarkForest + NFT and write apps/client/.env.local
  --mine-foreground <s> Wait <s> seconds, then mine a block repeatedly (foreground only).
                      Uses Ticker if VITE_TICKER_ADDRESS is set; otherwise uses admin_set_planet_owner.
  --run-client       Start the client dev server (yarn client:dev)
  --snapshot         Build snapshot.json + enable DF_SNAPSHOT_URL for the client
  --snapshot-watch   Keep snapshot.json updated in the background
  --snapshot-poll <ms> Poll interval for snapshot watch (default: ${DEFAULT_SNAPSHOT_POLL_MS})
  --snapshot-min-interval <ms> Minimum ms between snapshot rebuilds (default: ${DEFAULT_SNAPSHOT_MIN_INTERVAL_MS})
  --radius <n>       World radius to deploy with (default: ${DEFAULT_RADIUS})
  --planet-rarity <n> Planet rarity (higher = fewer planets). Default: ${DEFAULT_PLANET_RARITY}
  --time-factor <n>  Time factor (hundredths) applied to speed/growth (default: ${DEFAULT_TIME_FACTOR})
  -h, --help         Show this help

Examples:
  scripts/df-local.sh --reset
  scripts/df-local.sh --deploy --radius 8000 --planet-rarity 256
  scripts/df-local.sh --deploy --snapshot
  scripts/df-local.sh --mine-foreground 2
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --reset)
      RESET=1
      shift
      ;;
    --deploy|--redeploy)
      DEPLOY=1
      shift
      ;;
    --mine-foreground)
      if [[ $# -lt 2 ]]; then
        echo "--mine-foreground requires a number of seconds." >&2
        usage
        exit 1
      fi
      MINE_FOREGROUND=1
      MINE_FOREGROUND_DELAY="$2"
      shift 2
      ;;
    --run-client)
      RUN_CLIENT=1
      shift
      ;;
    --snapshot)
      RUN_SNAPSHOT=1
      shift
      ;;
    --snapshot-watch)
      RUN_SNAPSHOT_WATCH=1
      shift
      ;;
    --snapshot-poll)
      if [[ $# -lt 2 ]]; then
        echo "--snapshot-poll requires a value." >&2
        usage
        exit 1
      fi
      SNAPSHOT_POLL_MS="$2"
      shift 2
      ;;
    --snapshot-min-interval)
      if [[ $# -lt 2 ]]; then
        echo "--snapshot-min-interval requires a value." >&2
        usage
        exit 1
      fi
      SNAPSHOT_MIN_INTERVAL_MS="$2"
      shift 2
      ;;
    --radius)
      if [[ $# -lt 2 ]]; then
        echo "--radius requires a value." >&2
        usage
        exit 1
      fi
      RADIUS="$2"
      shift 2
      ;;
    --planet-rarity)
      if [[ $# -lt 2 ]]; then
        echo "--planet-rarity requires a value." >&2
        usage
        exit 1
      fi
      PLANET_RARITY="$2"
      shift 2
      ;;
    --time-factor)
      if [[ $# -lt 2 ]]; then
        echo "--time-factor requires a value." >&2
        usage
        exit 1
      fi
      TIME_FACTOR="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown flag: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "$RUN_SNAPSHOT_WATCH" -eq 1 ]]; then
  RUN_SNAPSHOT=1
fi

if [[ "$MINE_FOREGROUND" -eq 1 ]]; then
  if [[ "$DEPLOY" -eq 1 || "$RUN_CLIENT" -eq 1 || "$RUN_SNAPSHOT" -eq 1 || "$RUN_SNAPSHOT_WATCH" -eq 1 ]]; then
    echo "--mine-foreground ignores deploy/snapshot/client flags and only mines blocks."
  fi
  DEPLOY=0
  RUN_CLIENT=0
  RUN_SNAPSHOT=0
  RUN_SNAPSHOT_WATCH=0
  SKIP_BUILD=1
fi

if ! [[ "$RADIUS" =~ ^[0-9]+$ ]] || [[ "$RADIUS" -le 0 ]]; then
  echo "Radius must be a positive integer (got: $RADIUS)." >&2
  exit 1
fi
if ! [[ "$PLANET_RARITY" =~ ^[0-9]+$ ]] || [[ "$PLANET_RARITY" -le 0 ]]; then
  echo "Planet rarity must be a positive integer (got: $PLANET_RARITY)." >&2
  exit 1
fi
if ! [[ "$TIME_FACTOR" =~ ^[0-9]+$ ]] || [[ "$TIME_FACTOR" -le 0 ]]; then
  echo "Time factor must be a positive integer (got: $TIME_FACTOR)." >&2
  exit 1
fi
if [[ "$MINE_FOREGROUND" -eq 1 ]]; then
  if ! [[ "$MINE_FOREGROUND_DELAY" =~ ^[0-9]+([.][0-9]+)?$ ]] || [[ "$MINE_FOREGROUND_DELAY" == "0" ]]; then
    echo "Mine-foreground delay must be a positive number of seconds (got: $MINE_FOREGROUND_DELAY)." >&2
    exit 1
  fi
fi
if ! [[ "$SNAPSHOT_POLL_MS" =~ ^[0-9]+([.][0-9]+)?$ ]] || [[ "$SNAPSHOT_POLL_MS" == "0" ]]; then
  echo "Snapshot poll must be a positive number (got: $SNAPSHOT_POLL_MS)." >&2
  exit 1
fi
if ! [[ "$SNAPSHOT_MIN_INTERVAL_MS" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  echo "Snapshot min interval must be >= 0 (got: $SNAPSHOT_MIN_INTERVAL_MS)." >&2
  exit 1
fi

reset_local_network() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "docker is required for --reset but was not found." >&2
    exit 1
  fi

  local containers
  containers=$(docker ps -a --format '{{.ID}} {{.Names}}' | awk '$2 ~ /^aztec-start-/ || $2 ~ /^aztec-local-/' | awk '{print $1}')
  if [[ -z "$containers" ]]; then
    echo "No aztec local-network containers found to reset."
    return 0
  fi

  echo "Resetting aztec local-network containers: $containers"
  docker rm -f $containers >/dev/null
}

start_mine_foreground() {
  if ! command -v node >/dev/null 2>&1; then
    echo "node is required for mine-foreground but was not found." >&2
    exit 1
  fi

  if ! node --input-type=module -e "import foo from 'data:application/json,{}' with { type: 'json' }; console.log(foo)" >/dev/null 2>&1; then
    local node_version
    node_version=$(node -v 2>/dev/null || true)
    echo "Node ${node_version:-unknown} does not support import attributes required by Aztec." >&2
    echo "Install Node >= 20.10 (or 22.x) and re-run." >&2
    exit 1
  fi

  local env_path="$ROOT_DIR/apps/client/.env.local"
  if [[ ! -f "$env_path" ]]; then
    echo "Missing apps/client/.env.local. Run with --deploy (or create env) first." >&2
    exit 1
  fi
  if ! grep -q '^VITE_DARKFOREST_ADDRESS=' "$env_path"; then
    echo "apps/client/.env.local missing VITE_DARKFOREST_ADDRESS." >&2
    exit 1
  fi

  local delay="$MINE_FOREGROUND_DELAY"
  echo "Mine-foreground running (interval: ${delay}s). Waiting ${delay}s before the first block."
  echo "Stop with: Ctrl+C"
  pushd "$ROOT_DIR" >/dev/null
  sleep "$delay"
  INTERVAL="$delay" node aztec-tick.mjs
  popd >/dev/null
}

read_env_value() {
  local env_path="$1"
  local key="$2"
  local line
  line=$(grep -E "^${key}=" "$env_path" | tail -n 1 || true)
  if [[ -z "$line" ]]; then
    return 1
  fi
  echo "${line#${key}=}"
}

upsert_env_value() {
  local env_path="$1"
  local key="$2"
  local value="$3"

  if [[ ! -f "$env_path" ]]; then
    echo "${key}=${value}" > "$env_path"
    return 0
  fi

  if grep -q "^${key}=" "$env_path"; then
    local tmp_path="${env_path}.tmp"
    awk -v k="$key" -v v="$value" '{ if ($0 ~ "^"k"=") { print k"="v; next } print }' "$env_path" > "$tmp_path"
    mv "$tmp_path" "$env_path"
  else
    printf "\n%s=%s\n" "$key" "$value" >> "$env_path"
  fi
}

run_snapshot() {
  local env_path="$ROOT_DIR/apps/client/.env.local"
  if [[ ! -f "$env_path" ]]; then
    echo "Missing apps/client/.env.local. Run with --deploy (or create env) first." >&2
    exit 1
  fi

  local node_url
  node_url=$(read_env_value "$env_path" "VITE_AZTEC_NODE_URL" || true)
  if [[ -z "$node_url" ]]; then
    node_url="http://localhost:8080"
  fi

  local contract_addr
  contract_addr=$(read_env_value "$env_path" "VITE_DARKFOREST_ADDRESS" || true)
  if [[ -z "$contract_addr" ]]; then
    echo "apps/client/.env.local missing VITE_DARKFOREST_ADDRESS." >&2
    exit 1
  fi

  local nft_addr
  nft_addr=$(read_env_value "$env_path" "VITE_NFT_ADDRESS" || true)

  local snapshot_path="$ROOT_DIR/apps/client/public/snapshot.json"
  local snapshot_url="/public/snapshot.json"

  echo "Building snapshot for $contract_addr..."
  local args=(--rpc "$node_url" --contract "$contract_addr" --out "$snapshot_path")
  if [[ -n "$nft_addr" ]]; then
    args+=(--nft "$nft_addr")
  fi

  (cd "$ROOT_DIR" && node packages/contracts/scripts/indexer_snapshot.js "${args[@]}")

  upsert_env_value "$env_path" "DF_SNAPSHOT_URL" "$snapshot_url"
  echo "Snapshot ready. DF_SNAPSHOT_URL=${snapshot_url}"
  echo "Refresh the client to pick up snapshot changes."
}

start_snapshot_watch() {
  local env_path="$ROOT_DIR/apps/client/.env.local"
  if [[ ! -f "$env_path" ]]; then
    echo "Missing apps/client/.env.local. Run with --deploy (or create env) first." >&2
    exit 1
  fi

  if command -v pgrep >/dev/null 2>&1; then
    if pgrep -f "indexer_snapshot.js --watch" >/dev/null 2>&1; then
      echo "Snapshot watcher already running; skipping."
      return 0
    fi
  fi

  local node_url
  node_url=$(read_env_value "$env_path" "VITE_AZTEC_NODE_URL" || true)
  if [[ -z "$node_url" ]]; then
    node_url="http://localhost:8080"
  fi

  local contract_addr
  contract_addr=$(read_env_value "$env_path" "VITE_DARKFOREST_ADDRESS" || true)
  if [[ -z "$contract_addr" ]]; then
    echo "apps/client/.env.local missing VITE_DARKFOREST_ADDRESS." >&2
    exit 1
  fi

  local nft_addr
  nft_addr=$(read_env_value "$env_path" "VITE_NFT_ADDRESS" || true)

  local snapshot_path="$ROOT_DIR/apps/client/public/snapshot.json"
  local snapshot_url="/public/snapshot.json"
  upsert_env_value "$env_path" "DF_SNAPSHOT_URL" "$snapshot_url"

  local args=(--watch --rpc "$node_url" --contract "$contract_addr" --out "$snapshot_path" --poll "$SNAPSHOT_POLL_MS" --min-interval "$SNAPSHOT_MIN_INTERVAL_MS")
  if [[ -n "$nft_addr" ]]; then
    args+=(--nft "$nft_addr")
  fi

  local log_path="$ROOT_DIR/.snapshot-watch.log"
  local pid
  pushd "$ROOT_DIR" >/dev/null
  nohup node packages/contracts/scripts/indexer_snapshot.js "${args[@]}" > "$log_path" 2>&1 &
  pid=$!
  popd >/dev/null
  echo "Snapshot watch started (pid: $pid). Logs: $log_path"
  echo "Stop with: kill $pid"
}

if [[ "$RESET" -eq 1 ]]; then
  reset_local_network
fi

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "Building Noir contracts + client..."
  (cd "$ROOT_DIR" && yarn workspace @darkforest-aztec/nft compile)
  (cd "$ROOT_DIR" && yarn workspace @darkforest-aztec/contracts compile)
  (cd "$ROOT_DIR" && yarn workspace @darkforest-aztec/ticker compile)
  (cd "$ROOT_DIR" && yarn client:build)
  echo "Build complete."
else
  echo "Skipping build/deploy steps (--mine-foreground)."
fi

if [[ "$DEPLOY" -eq 1 ]]; then
  echo "Deploying DarkForest + NFT (world radius: $RADIUS, planet rarity: $PLANET_RARITY, time factor: $TIME_FACTOR)..."
  (cd "$ROOT_DIR" && node packages/contracts/scripts/deploy_local.js --write-env --overwrite-env --world-radius "$RADIUS" --planet-rarity "$PLANET_RARITY" --time-factor "$TIME_FACTOR")
fi

if [[ "$RUN_SNAPSHOT" -eq 1 ]]; then
  run_snapshot
fi

if [[ "$RUN_SNAPSHOT_WATCH" -eq 1 ]]; then
  start_snapshot_watch
fi

if [[ "$MINE_FOREGROUND" -eq 1 ]]; then
  start_mine_foreground
fi

if [[ "$RUN_CLIENT" -eq 1 ]]; then
  echo "Starting client dev server..."
  (cd "$ROOT_DIR" && yarn client:dev)
fi
