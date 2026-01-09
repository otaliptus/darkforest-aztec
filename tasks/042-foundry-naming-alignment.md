# Ticket 042 - Foundry naming alignment

## Goal
Align the Aztec port naming so planet type 2 is explicitly called Foundry (not Ruins) in contract constants, shared types, and user-facing docs/plugin UI.

## Acceptance Criteria
- Contract constants expose `PLANET_TYPE_FOUNDRY` (value 2) and core checks reference Foundry naming.
- Shared `PlanetType` exports a `FOUNDRY` alias (value 2) without breaking existing `RUINS` usage.
- User-facing docs/plugins that list planet renderers use “Foundry” instead of “Ruins”.

## Out of Scope
- Gameplay logic changes.
- Asset renames or renderer refactors.
- Rewriting all internal variable names.

## Deliverables
- Updated contract + types + docs consistent with Foundry naming.

## Status
- Archived (2026-01-08).
