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

### 2026-01-11 rerun (profiling refresh)
Commands:
```
# Opcodes (reuse existing /tmp/df-prof artifacts)
VERSION=$(cat ~/.aztec/default_version) && for fn in __aztec_nr_internals__init_player __aztec_nr_internals__move __aztec_nr_internals__reveal_location __aztec_nr_internals__find_artifact; do out=${fn#__aztec_nr_internals__}; docker run --rm --user $(id -u):$(id -g) -v /tmp:/tmp -v $HOME:$HOME -e HOME=$HOME --workdir="$PWD" --entrypoint=/usr/src/noir/noir-repo/target/release/noir-profiler aztecprotocol/aztec:$VERSION opcodes --artifact-path /tmp/df-prof/artifacts/${fn}.json --output /tmp/df-prof2/opcodes/${out}; done

# Gates (fails: bb missing)
VERSION=$(cat ~/.aztec/default_version) && for fn in __aztec_nr_internals__init_player __aztec_nr_internals__move __aztec_nr_internals__reveal_location __aztec_nr_internals__find_artifact; do out=${fn#__aztec_nr_internals__}; docker run --rm --user $(id -u):$(id -g) -v /tmp:/tmp -v $HOME:$HOME -e HOME=$HOME --workdir="$PWD" --entrypoint=/usr/src/noir/noir-repo/target/release/noir-profiler aztecprotocol/aztec:$VERSION gates --artifact-path /tmp/df-prof/artifacts/${fn}.json --backend-path bb --output /tmp/df-prof2/gates/${out}; done
```

Results:
- Opcodes counts match prior run (init_player 31,637; move 31,997; reveal_location 29,295; find_artifact 29,297).
- `noir-profiler gates` failed: `Error querying backend for gates: No such file or directory` (bb missing).

### 2026-01-11 gates profiling attempts
Commands:
```
# Install linux bb via bbup in Aztec container
VERSION=$(cat ~/.aztec/default_version) && docker run --rm --user $(id -u):$(id -g) \
  -v /tmp:/tmp -v $HOME:$HOME -e HOME=$HOME -e BB_PATH=/tmp/bb-linux \
  --workdir="$PWD" --entrypoint=/bin/sh aztecprotocol/aztec:$VERSION -c "/Users/talip/.bb/bbup -nv 1.0.0-beta.15"

# Try gates with bb (nightly)
VERSION=$(cat ~/.aztec/default_version) && docker run --rm --user $(id -u):$(id -g) \
  -v /tmp:/tmp -v $HOME:$HOME -e HOME=$HOME --workdir="$PWD" \
  --entrypoint=/usr/src/noir/noir-repo/target/release/noir-profiler aztecprotocol/aztec:$VERSION gates \
  --artifact-path /tmp/df-prof/artifacts/__aztec_nr_internals__move.json \
  --backend-path /tmp/bb-linux/bb --output /tmp/df-prof2/gates/move

# Install devnet bb to match Aztec version
VERSION=$(cat ~/.aztec/default_version) && docker run --rm --user $(id -u):$(id -g) \
  -v /tmp:/tmp -v $HOME:$HOME -e HOME=$HOME -e BB_PATH=/tmp/bb-linux-devnet \
  --workdir="$PWD" --entrypoint=/bin/sh aztecprotocol/aztec:$VERSION -c "/Users/talip/.bb/bbup -v 3.0.0-devnet.20251212"

# Try gates with devnet bb
VERSION=$(cat ~/.aztec/default_version) && docker run --rm --user $(id -u):$(id -g) \
  -v /tmp:/tmp -v $HOME:$HOME -e HOME=$HOME --workdir="$PWD" \
  --entrypoint=/usr/src/noir/noir-repo/target/release/noir-profiler aztecprotocol/aztec:$VERSION gates \
  --artifact-path /tmp/df-prof/artifacts/__aztec_nr_internals__move.json \
  --backend-path /tmp/bb-linux-devnet/bb --output /tmp/df-prof2/gates/move

# Decode ACIR bytecode and run bb gates directly (still fails)
python3 - <<'PY'
import base64, json, os
src='/tmp/df-prof/artifacts/__aztec_nr_internals__move.json'
out_dir='/tmp/df-prof2/bytecode'
os.makedirs(out_dir, exist_ok=True)
with open(src) as f:
    data=json.load(f)
raw=base64.b64decode(data['bytecode'])
with open(os.path.join(out_dir,'move.acir.gz'), 'wb') as f:
    f.write(raw)
PY

VERSION=$(cat ~/.aztec/default_version) && docker run --rm --user $(id -u):$(id -g) \
  -v /tmp:/tmp -v $HOME:$HOME -e HOME=$HOME --workdir="$PWD" --entrypoint=/bin/sh \
  aztecprotocol/aztec:$VERSION -c "/tmp/bb-linux-devnet/bb gates -b /tmp/df-prof2/bytecode/move.acir.gz --include_gates_per_opcode"
```

Results:
- `noir-profiler gates` with `bb` (nightly) failed: `missing field gates_per_opcode`.
- `noir-profiler gates` with devnet `bb` failed: `EOF while parsing a value`.
- Direct `bb gates` fails: `UltraCircuitBuilder ... does not support CallData/ReturnData block constraints` (Aztec app needs MegaCircuitBuilder).

## Status
- In progress (2026-01-11)
