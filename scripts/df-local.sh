#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DEFAULT_RADIUS=2000

RESET=0
DEPLOY=0
FAST_BLOCKS=0
RADIUS="$DEFAULT_RADIUS"

usage() {
  cat <<USAGE
Usage: scripts/df-local.sh [options]

Options:
  --reset            Stop/remove aztec local-network container(s) (no ~/.aztec deletion)
  --deploy           Redeploy DarkForest + NFT and write apps/client/.env.local
  --fast-blocks      Start the local block tick helper for faster testing
  --radius <n>       World radius to deploy with (default: ${DEFAULT_RADIUS})
  -h, --help         Show this help

Examples:
  scripts/df-local.sh --reset
  scripts/df-local.sh --deploy --radius 8000
  scripts/df-local.sh --deploy --fast-blocks
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
    --fast-blocks)
      FAST_BLOCKS=1
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

if ! [[ "$RADIUS" =~ ^[0-9]+$ ]] || [[ "$RADIUS" -le 0 ]]; then
  echo "Radius must be a positive integer (got: $RADIUS)." >&2
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

start_fast_blocks() {
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
      echo "aztec-tick.mjs already running; skipping fast-blocks startup."
      return 0
    fi
  fi

  local log_path="$ROOT_DIR/.aztec-tick.log"
  local pid
  pushd "$ROOT_DIR" >/dev/null
  INTERVAL="0.25" BATCH="1" FORCE_TX="true" nohup node aztec-tick.mjs > "$log_path" 2>&1 &
  pid=$!
  popd >/dev/null
  echo "Fast blocks started (pid: $pid). Logs: $log_path"
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
  echo "Deploying DarkForest + NFT (world radius: $RADIUS)..."
  (cd "$ROOT_DIR" && node packages/contracts/scripts/deploy_local.js --write-env --overwrite-env --world-radius "$RADIUS")
fi

if [[ "$FAST_BLOCKS" -eq 1 ]]; then
  start_fast_blocks
fi
