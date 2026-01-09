# 096-noir-profiling-and-network-perf

## Goal
Measure Noir proving hotspots and summarize network-read bottlenecks to prioritize perf work without changing gameplay semantics.

## Acceptance criteria
- Run `nargo info` for private entrypoints: `init_player`, `move`, `reveal_location`, `find_artifact`.
- Run `noir-profiler` (opcodes or gates) for at least `move` and `init_player`.
- Record the exact commands and key outputs in this ticket.
- Summarize top hot spots and a ranked set of next-step optimizations (no code changes yet).

## Out of scope
- Contract logic changes.
- Client/UI changes.
- Indexer/snapshot changes.

## Plan
- Locate the Noir package that owns the DarkForest contract and run `nargo info`.
- Run profiler on `move` and `init_player`.
- Capture outputs and summarize hotspots + next steps.

## Planned files
- `tasks/096-noir-profiling-and-network-perf.md`

## Results
- Attempted `nargo info` locally (failed due to local nargo incompatibility with Aztec contract macros).
- `aztec compile` succeeds; used Aztec docker toolchain to run `nargo info`, but it only emitted warnings and no opcode/gate summary (likely a tooling limitation for `contract` packages).

### Commands
```
# Local nargo (fails with `self` not found / type errors)
cd packages/contracts && nargo info

# Aztec docker nargo (no summary output, only warnings)
cd packages/contracts && VERSION=$(cat ~/.aztec/default_version) \
  docker run --rm --user $(id -u):$(id -g) -v $HOME:$HOME -e HOME=$HOME \
  --workdir="$PWD" --entrypoint=/usr/src/noir/noir-repo/target/release/nargo \
  aztecprotocol/aztec:$VERSION info

# Build Aztec artifacts (succeeds)
cd packages/contracts && aztec compile

# Extract per-function artifacts for profiler
python3 - <<'PY'
import json, os
src='packages/contracts/target/darkforest_contract-DarkForest.json'
out_dir='/tmp/df-prof/artifacts'
os.makedirs(out_dir, exist_ok=True)
with open(src) as f:
    data=json.load(f)
fn_map={fn['name']:fn for fn in data['functions']}
want=[
    '__aztec_nr_internals__init_player',
    '__aztec_nr_internals__move',
    '__aztec_nr_internals__reveal_location',
    '__aztec_nr_internals__find_artifact',
]
for name in want:
    fn=fn_map.get(name)
    out={
        'noir_version': data.get('noir_version'),
        'hash': fn.get('hash'),
        'abi': fn.get('abi'),
        'bytecode': fn.get('bytecode'),
        'debug_symbols': fn.get('debug_symbols'),
        'file_map': data.get('file_map'),
        'names': [],
        'brillig_names': [],
        'expression_width': fn.get('expression_width'),
    }
    with open(os.path.join(out_dir, f"{name}.json"), 'w') as f:
        json.dump(out, f)
PY

# Noir profiler (opcodes) via Aztec docker toolchain
mkdir -p /tmp/df-prof/opcodes/{move,init_player,reveal_location,find_artifact}
VERSION=$(cat ~/.aztec/default_version) && docker run --rm --user $(id -u):$(id -g) \
  -v /tmp:/tmp -v $HOME:$HOME -e HOME=$HOME --workdir="$PWD" \
  --entrypoint=/usr/src/noir/noir-repo/target/release/noir-profiler \
  aztecprotocol/aztec:$VERSION opcodes \
  --artifact-path /tmp/df-prof/artifacts/__aztec_nr_internals__move.json \
  --output /tmp/df-prof/opcodes/move

VERSION=$(cat ~/.aztec/default_version) && docker run --rm --user $(id -u):$(id -g) \
  -v /tmp:/tmp -v $HOME:$HOME -e HOME=$HOME --workdir="$PWD" \
  --entrypoint=/usr/src/noir/noir-repo/target/release/noir-profiler \
  aztecprotocol/aztec:$VERSION opcodes \
  --artifact-path /tmp/df-prof/artifacts/__aztec_nr_internals__init_player.json \
  --output /tmp/df-prof/opcodes/init_player

VERSION=$(cat ~/.aztec/default_version) && docker run --rm --user $(id -u):$(id -g) \
  -v /tmp:/tmp -v $HOME:$HOME -e HOME=$HOME --workdir="$PWD" \
  --entrypoint=/usr/src/noir/noir-repo/target/release/noir-profiler \
  aztecprotocol/aztec:$VERSION opcodes \
  --artifact-path /tmp/df-prof/artifacts/__aztec_nr_internals__reveal_location.json \
  --output /tmp/df-prof/opcodes/reveal_location

VERSION=$(cat ~/.aztec/default_version) && docker run --rm --user $(id -u):$(id -g) \
  -v /tmp:/tmp -v $HOME:$HOME -e HOME=$HOME --workdir="$PWD" \
  --entrypoint=/usr/src/noir/noir-repo/target/release/noir-profiler \
  aztecprotocol/aztec:$VERSION opcodes \
  --artifact-path /tmp/df-prof/artifacts/__aztec_nr_internals__find_artifact.json \
  --output /tmp/df-prof/opcodes/find_artifact
```

### Opcode counts (from `noir-profiler opcodes`)
- move: 31,997 opcodes
- init_player: 31,637 opcodes
- reveal_location: 29,295 opcodes
- find_artifact: 29,297 opcodes

### Top hotspots (percent of opcodes)
move:
- multi_scale_perlin: 64.32%
- config_hash: 15.63%
- mimc_sponge_2_220: 6.83% (config hash seed)
- mimc_sponge_2_220: 8.80% (perlin flags/seed)
- mimc_sponge_2_220: 7.18% (location_id)

init_player:
- multi_scale_perlin: 65.08%
- config_hash: 15.81%
- mimc_sponge_2_220: 6.91% (config hash seed)
- mimc_sponge_2_220: 8.90% (perlin flags/seed)
- mimc_sponge_2_220: 7.49% (location_id)

reveal_location:
- multi_scale_perlin: 70.29%
- config_hash: 17.07%
- mimc_sponge_2_220: 7.46% (config hash seed)
- mimc_sponge_2_220: 9.61% (perlin flags/seed)
- mimc_sponge_2_220: 8.09% (location_id)

find_artifact:
- multi_scale_perlin: 70.29%
- config_hash: 17.07%
- mimc_sponge_2_220: 7.46% (config hash seed)
- mimc_sponge_2_220: 9.61% (perlin flags/seed)
- mimc_sponge_2_220: 8.09% (location_id)

## Status
- In progress (2026-01-09)
