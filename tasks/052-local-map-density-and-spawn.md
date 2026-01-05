# Ticket 052 - Local Map Density + Spawn Proximity

## Goal
Make local dev maps small and dense, with player spawns close enough for fast iteration.

## Acceptance Criteria
- A local deployment can target a small world radius (<= 1000) and yields noticeably closer planet distances.
- Planet density is high enough that typical movement between nearby planets is achievable in 1–2 moves.
- Player spawn is not forced to the rim; spawns can be near the center for local testing.
- Defaults are safe for local-only; no production behavior changes unless explicitly configured.

## Plan
1) Update the local deploy script to expose explicit knobs for `world_radius`, `planet_rarity`, and `init_radius` with sane local defaults.
2) Remove/relax the “spawn near rim” constraint in `init_player` for local dev (guarded by config so mainnet remains v0.6-like).
3) Ensure `.env.local` reflects the chosen world radius + init parameters so client and contract agree.
4) Validate locally by deploying with small radius + low rarity and confirming shorter travel distances.

## Touch Points
- `packages/contracts/scripts/deploy_local.js` (defaults/flags + .env.local output)
- `packages/contracts/src/main.nr` (`init_player` spawn ring check)
- `apps/client/src/Backend/Aztec/config.ts` (defaults used by client)

## Side Effects
- Changes spawn distribution and early balance (acceptable for local testing).
- Requires recompile/redeploy to take effect.
- If not gated, could diverge from v0.6 spawn rules on non-local deployments.

## Non-Goals
- Changing the underlying move-distance/range formula.
- Altering game balance for production networks.
