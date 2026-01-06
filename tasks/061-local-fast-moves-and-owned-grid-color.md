# Ticket 061 - Local Fast Moves + Owned Grid Color

## Goal
Make local travel times much shorter for tiny maps and ensure owned planets stand out in the grid view.

## Acceptance Criteria
- Local move/travel time honors the configured time factor in a way that yields short ETAs on tiny maps.
- Client ETA calculation matches the contract travel-time math.
- Owned planets render with a forced high-contrast yellow grid square when zoomed out.

## Plan
1) Update contract travel-time math to apply the time factor explicitly.
2) Align client ETA calculation with the on-chain formula.
3) Add a fixed-size yellow square for owned planets at low zoom.

## Touch Points
- `packages/contracts/src/main.nr`
- `apps/client/src/Backend/GameLogic/GameManager.ts`
- `apps/client/src/Backend/GameLogic/GameObjects.ts`
- `packages/df-renderer/src/EngineConsts.ts`
- `packages/df-renderer/src/Entities/PlanetRenderManager.ts`

## Side Effects
- Travel-time math changes affect local gameplay pace; redeploy required to take effect.
- Owned planet visuals will be more prominent at low zoom.

## Non-Goals
- Changing core v0.6 mechanics beyond local pacing adjustments.
