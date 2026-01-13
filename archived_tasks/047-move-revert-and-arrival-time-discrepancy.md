# 047 - Move revert and arrival time discrepancy

## Summary
Investigate and fix: (1) move tx reverts when energy set to full; (2) arrival ETA mismatch between players; (3) player1 not seeing incoming until they send a successful tx. Improve logs to expose revert reasons/ETA inputs.

## Acceptance Criteria
- Move reverts at full energy are eliminated or surface an explicit reason (e.g., insufficient energy after tax/regen/cap) in client logs.
- Arrival ETA is consistent across clients for the same voyage.
- Incoming arrivals appear for a player without requiring them to submit a new tx (client sync reliability).
- Logging includes the computed arrival block/time inputs and any rejection reasons.

## Notes
- Preserve contract pattern: private validate -> public apply.
- Avoid unbounded loops in public functions.

## Status
- Archived (2026-01-08).
