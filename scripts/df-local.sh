#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DEFAULT_RADIUS=200
DEFAULT_PLANET_RARITY=12
DEFAULT_TIME_FACTOR=1000
DEFAULT_TICK_INTERVAL=0.25

RESET=0
DEPLOY=0
MINE_BLOCKS=0
RUN_CLIENT=0
RUN_ALL=0
RADIUS="$DEFAULT_RADIUS"
PLANET_RARITY="$DEFAULT_PLANET_RARITY"
TIME_FACTOR="$DEFAULT_TIME_FACTOR"
TICK_INTERVAL="$DEFAULT_TICK_INTERVAL"
BLOCK_TIME=""

usage() {
  cat <<USAGE
Usage: scripts/df-local.sh [options]

Options:
  --reset            Stop/remove aztec local-network container(s) (no ~/.aztec deletion)
  --deploy           Redeploy DarkForest + NFT and write apps/client/.env.local
  --mine-blocks      Send a tx every interval to mine L2 blocks
  --run              Deploy + mine blocks + run client dev server
  --run-client       Start the client dev server (yarn client:dev)
  --radius <n>       World radius to deploy with (default: ${DEFAULT_RADIUS})
  --planet-rarity <n> Planet rarity (higher = fewer planets). Default: ${DEFAULT_PLANET_RARITY}
  --time-factor <n>  Time factor (hundredths) applied to speed/growth (default: ${DEFAULT_TIME_FACTOR})
  --tick-interval <s> Tick interval in seconds for mine-blocks (default: ${DEFAULT_TICK_INTERVAL})
  --block-time <s>  Override client block time in seconds (default: tick interval)
  -h, --help         Show this help

Examples:
  scripts/df-local.sh --reset
  scripts/df-local.sh --deploy --radius 8000 --planet-rarity 256
  scripts/df-local.sh --deploy --mine-blocks
  scripts/df-local.sh --run
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
    --mine-blocks)
      MINE_BLOCKS=1
      shift
      ;;
    --run|--all)
      RUN_ALL=1
      shift
      ;;
    --run-client)
      RUN_CLIENT=1
      shift
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
    --tick-interval)
      if [[ $# -lt 2 ]]; then
        echo "--tick-interval requires a value." >&2
        usage
        exit 1
      fi
      TICK_INTERVAL="$2"
      shift 2
      ;;
    --block-time)
      if [[ $# -lt 2 ]]; then
        echo "--block-time requires a value." >&2
        usage
        exit 1
      fi
      BLOCK_TIME="$2"
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

if [[ "$RUN_ALL" -eq 1 ]]; then
  DEPLOY=1
  MINE_BLOCKS=1
  RUN_CLIENT=1
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
if ! [[ "$TICK_INTERVAL" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  echo "Tick interval must be a positive number (got: $TICK_INTERVAL)." >&2
  exit 1
fi
if [[ -z "$BLOCK_TIME" ]]; then
  BLOCK_TIME="$TICK_INTERVAL"
fi
if ! [[ "$BLOCK_TIME" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  echo "Block time must be a positive number (got: $BLOCK_TIME)." >&2
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

start_mine_blocks() {
  local env_path="$ROOT_DIR/apps/client/.env.local"
  if [[ ! -f "$env_path" ]]; then
    echo "Missing apps/client/.env.local. Run with --deploy (or create env) first." >&2
    exit 1
  fi
  if ! grep -q '^VITE_DARKFOREST_ADDRESS=' "$env_path"; then
    echo "apps/client/.env.local missing VITE_DARKFOREST_ADDRESS." >&2
    exit 1
  fi

  if command -v pgrep >/dev/null 2>&1; then
    if pgrep -f "aztec-tick.mjs" >/dev/null 2>&1; then
      echo "aztec-tick.mjs already running; skipping mine-blocks startup."
      return 0
    fi
  fi

  local log_path="$ROOT_DIR/.aztec-tick.log"
  local pid
  pushd "$ROOT_DIR" >/dev/null
  INTERVAL="$TICK_INTERVAL" nohup node aztec-tick.mjs > "$log_path" 2>&1 &
  pid=$!
  popd >/dev/null
  echo "Mine-blocks started (pid: $pid). Logs: $log_path"
  echo "Stop with: kill $pid"
}

if [[ "$RESET" -eq 1 ]]; then
  reset_local_network
fi

echo "Building Noir contracts + client..."
(cd "$ROOT_DIR" && yarn workspace @darkforest-aztec/nft compile)
(cd "$ROOT_DIR" && yarn workspace @darkforest-aztec/contracts compile)
(cd "$ROOT_DIR" && yarn client:build)

echo "Build complete."

if [[ "$DEPLOY" -eq 1 ]]; then
  echo "Deploying DarkForest + NFT (world radius: $RADIUS, planet rarity: $PLANET_RARITY, time factor: $TIME_FACTOR, block time: $BLOCK_TIME)..."
  (cd "$ROOT_DIR" && node packages/contracts/scripts/deploy_local.js --write-env --overwrite-env --world-radius "$RADIUS" --planet-rarity "$PLANET_RARITY" --time-factor "$TIME_FACTOR" --block-time "$BLOCK_TIME")
fi

if [[ "$MINE_BLOCKS" -eq 1 ]]; then
  start_mine_blocks
fi

if [[ "$RUN_CLIENT" -eq 1 ]]; then
  echo "Starting client dev server..."
  (cd "$ROOT_DIR" && yarn client:dev)
fi
