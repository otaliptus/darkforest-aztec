# Project Map

This repo mixes active Aztec port work with vendored reference material. Use this map to avoid chasing the wrong paths.

## Active (build/run)
- `packages/contracts`: Dark Forest Aztec contract (Noir) + tests/scripts.
- `packages/nft`: Aztec-native NFT contract used for artifacts.
- `apps/client`: React client wired to Aztec.
- `packages/df-*`: Local copies of Dark Forest TypeScript packages used by the client.
- `packages/shared`: Shared TS types/constants.

## Reference-only (do not build/run)
- `reference/darkforest-v0.6`: Canonical v0.6 contracts/circuits/client.
- `reference/darkforest-local`: Runnable local game for behavior reference.
- `reference/aztec-starter`: Aztec/Noir starter repo.
- `reference/noir`: Noir language/toolchain reference.

## Notes
- Reference repos are kept for lookup and comparison only. They are not part of the build or deployment workflow.
- If a path you are using starts with `reference/`, it should not be imported into production code without an explicit port.

## Updates
- 2026-01-07: Added `docs/giga-truth-report.md` (current architecture + gaps) and `docs/action-call-graphs.md` (client → Aztec → Noir call graphs).
