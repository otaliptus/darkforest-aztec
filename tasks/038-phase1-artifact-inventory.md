# Phase 1 — Artifact Inventory + Burned Flag + Side-Effects

## Goal
Fix artifact inventory so the client reflects on-chain artifacts correctly, including burned status and any UI side-effects that depend on it.

## Acceptance criteria
- `getPlayerArtifacts()` returns actual artifacts for the player (not `[]`).
- Client decodes and uses artifact `burned` state from Aztec data.
- Any UI/logic dependent on artifact burn status behaves correctly (no stale inventory entries, correct filtering).
- Changes are confined to client/Aztec adapter; no contract changes required.
- Minimal risk: no new unbounded loops in public contract functions.

## Notes
- Exclude Twitter/planet emoji/hats/plugins.
- If a contract field or method is missing, document the gap and choose a safe client fallback.
