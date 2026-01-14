#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$ROOT/llm_oracle_bundle.txt}"
PROMPT="${PROMPT:-Review this repo and answer my request with concrete code references.}"
COPY="${COPY:-0}"

cmd=(npx -y @steipete/oracle --render -p "$PROMPT")
if [ "$COPY" = "1" ]; then
  cmd+=(--copy)
fi

file_patterns=(
  "apps/**"
  "packages/**"
  "docs/**"
  "scripts/**"
  "tasks/*.txt"
  "*.md"
  "*.toml"
  "*.yaml"
  "*.yml"
  "*.nr"
  "*.ts"
  "*.tsx"
  "*.js"
  "*.jsx"
  "*.mjs"
  "*.cjs"
  "*.json"
  "*.sh"
  "*.txt"
  "!**/.git/**"
  "!**/node_modules/**"
  "!**/dist/**"
  "!**/build/**"
  "!**/out/**"
  "!**/target/**"
  "!**/coverage/**"
  "!**/.next/**"
  "!**/.turbo/**"
  "!**/.cache/**"
  "!**/cache/**"
  "!**/artifacts/**"
  "!**/tmp/**"
  "!**/temp/**"
  "!**/logs/**"
  "!**/reference/**"
  "!**/apps/client-og/**"
  "!llm_bundle.txt"
  "!noir_client_bundle.txt"
  "!llm_oracle_bundle.txt"
  "!tree.txt"
  "!**/*.r1cs"
  "!**/*.zkey"
  "!**/*.wasm"
  "!**/*.jpg"
  "!**/*.jpeg"
  "!**/*.png"
  "!**/*.gif"
)

for pattern in "${file_patterns[@]}"; do
  cmd+=(--file "$pattern")
done

cd "$ROOT"
"${cmd[@]}" > "$OUT"

echo "Wrote $OUT"
