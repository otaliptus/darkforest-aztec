# Ticket 102 - Fix client applyUpgrade stat scaling

## Goal
Correct client-side upgrade application so energy cap/growth are scaled properly instead of speed being scaled twice.

## Acceptance Criteria
- `applyUpgrade` scales `planet.energyCap` and `planet.energyGrowth` using the upgrade multipliers.
- `applyUpgrade` scales `planet.speed` only once using `speedMultiplier`.
- The unapply path in `applyUpgrade` reverses the same fields correctly.

## Notes
- Keep changes scoped to the client-side upgrade helper.
