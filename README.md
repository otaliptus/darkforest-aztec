# Dark Forest on Aztec

This workspace is the Aztec port target. The original Dark Forest v0.6 sources and the Aztec/Noir references live alongside it:

- `darkforest-v0.6`: Canonical v0.6 contracts, circuits, and client.
- `darkforest-local`: Runnable local Dark Forest for behavior reference.
- `aztec-starter`: Aztec/Noir starter project reference.
- `noir`: Noir language/toolchain reference.

## Workspace Layout

- `packages/contracts`: Aztec Noir contracts + tests.
- `packages/shared`: Shared TypeScript types/constants.
- `apps/client`: React web client.

## Quick Start (Local)

From repo root:

```bash
yarn install
yarn contracts:compile
yarn contracts:test:nr
```

Client:

```bash
yarn client:dev
```
