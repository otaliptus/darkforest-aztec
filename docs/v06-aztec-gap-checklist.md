# Dark Forest v0.6 → Aztec Port Gap Checklist

Date: January 13, 2026

This checklist reflects the current repo state (Aztec Noir contract + client). Unchecked items indicate missing or disabled v0.6 features.

## Gameplay / Contract Parity

- [ ] Capture Zones (DFCaptureFacet)
  - Missing: no capture-zone state or functions in `packages/contracts/src/main.nr`.
  - Related client config forced off: `CAPTURE_ZONES_ENABLED: false` in `apps/client/src/Backend/GameLogic/ContractsAPI.ts`.
  - Capture-zone constants/fields (e.g., invader, invadeStartBlock, capturer) are absent from `packages/contracts/src/types.nr`.

- [ ] Planet Transfer (DFCoreFacet)
  - Missing: no `transferPlanet` function in `packages/contracts/src/main.nr`.
  - Client flag forced off: `PLANET_TRANSFER_ENABLED: false` in `apps/client/src/Backend/GameLogic/ContractsAPI.ts`.

- [ ] Hats / Cosmetics (DFCoreFacet)
  - Missing: `hatLevel` is not present in `packages/contracts/src/types.nr`.
  - No `buyHat` function in `packages/contracts/src/main.nr`.
  - Client UI exists: `apps/client/src/Frontend/Panes/HatPane.tsx`.

- [ ] Silver Withdrawal (DFCoreFacet + LibPlanet)
  - Missing: no `withdrawSilver` in `packages/contracts/src/main.nr`.
  - Client explicitly blocks: `apps/client/src/Backend/GameLogic/GameManager.ts` throws "Withdraw silver is not supported in the Aztec client.".

- [ ] Reward System (DFRewardFacet)
  - Missing: no `claimReward` function in `packages/contracts/src/main.nr`.
  - Player fields like `score`, `finalRank`, `claimedReward` are not in `packages/contracts/src/types.nr`.
  - Client reward flow exists but relies on missing contract support: `apps/client/src/Backend/GameLogic/GameManager.ts`.

- [ ] Whitelist System (DFWhitelistFacet)
  - Missing: no whitelist contract logic in `packages/contracts/src/main.nr`.
  - Client still contains legacy whitelist UI/utility paths: `apps/client/src/Frontend/Pages/GameLandingPage.tsx`, `apps/client/src/Backend/Utils/WhitelistSnarkArgsHelper.ts`.

- [ ] Admin Functions (DFAdminFacet)
  - Missing: no admin-only functions in `packages/contracts/src/main.nr` (pause, set world radius, owner transfers, etc.).

- [ ] Game Pause State
  - Missing: no global pause state in `packages/contracts/src/main.nr`.
  - Client `getIsPaused()` always returns `false` in `apps/client/src/Backend/GameLogic/ContractsAPI.ts`.
  - Note: `planet_pausers` exists for Titan ship effects (per-planet), not a global pause.

- [ ] Player Score Tracking
  - Missing: `score` is not a field on `Player` in `packages/contracts/src/types.nr`.

- [ ] Planet Created Timestamp
  - Missing: `createdAt` is not a field on `Planet` in `packages/contracts/src/types.nr` (only `last_updated`).

- [ ] Token Mint Period Enforcement
  - Missing: no on-chain mint end timestamp in `GameConfig` (`packages/contracts/src/types.nr`).
  - Client treats mint as unbounded: `TOKEN_MINT_END_SECONDS` set to `Number.MAX_SAFE_INTEGER` in `apps/client/src/Backend/GameLogic/ContractsAPI.ts`.

- [ ] Debug Facet (DFDebugFacet)
  - Missing: no debug helpers in `packages/contracts/src/main.nr`.

## Notes / Clarifications

- Artifact deposit/withdraw (spacetime rips) for NFTs exists via action 10/11 in `packages/contracts/src/main.nr`, but **silver withdrawal** is a separate v0.6 feature and is not implemented.
