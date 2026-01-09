# Ticket 098 - Utility location bundle getter

## Goal
Add a Noir utility function that returns a full location bundle in one call, and wire the main client to use it (no NFT data).

## Acceptance Criteria
- Contract exposes a `get_location_bundle` utility function that returns planet + artifacts + artifact state + revealed coords + destroyed flag + space junk + arrivals + arrival details + artifact details.
- Utility function uses fixed-size arrays only (no unbounded loops in public functions).
- Client (`apps/client`) uses the utility bundle for `getPlanetById` and `getArrivalsForPlanet`.
- Contract artifacts are regenerated.
- Bytecode size delta (public/private/utility) is recorded in this ticket.

## Out of Scope
- NFT owner reads.
- Indexer/snapshot changes.
- Proving/circuit changes.

## Tests / Commands
- `yarn contracts:compile`
- `yarn client:build`

## Results
- Added `get_location_bundle` utility function and `LocationBundle` struct (no NFT reads).
- Client now uses the utility bundle for planet + arrival reads.
- Bytecode size (from `darkforest_contract-DarkForest.json`):
  - Before: public 314,666 bytes; private 1,592,802 bytes; utility 71,655 bytes.
  - After: public 435,343 bytes; private 1,592,802 bytes; utility 115,515 bytes.
  - Delta: public +120,677 bytes; utility +43,860 bytes; private unchanged.
  - New utility function `get_location_bundle`: 43,860 bytes.
- Build warnings remain (UnsubscribePage LinkContainer export, aztec bb.js sourcemaps, bundle size).

## Status
- Completed (2026-01-09)
