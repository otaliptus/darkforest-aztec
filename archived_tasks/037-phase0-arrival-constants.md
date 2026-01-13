# Ticket 037 - Phase 0 core loop (arrival resolution + on-chain constants)

## Goal
Make the Aztec client authoritative with on-chain arrivals and use real contract constants so gameplay gates (prospect/find) behave correctly.

## Acceptance Criteria
- Client resolves matured arrivals on-chain (private `resolve_arrival`) and refreshes state from chain; local simulation is not authoritative.
- `ContractsAPI.getConstants()` no longer hardcodes `TOKEN_MINT_END_SECONDS: 0`; if the Aztec contract lacks a mint-end field, client treats it as “no end” (max future) and documents it.
- UI behavior for prospect/find reflects true round status.
- No changes to excluded features (Twitter/emoji/hats/plugins).

## Out of Scope
- Full artifact inventory plumbing (covered by later phase).
- UX text/content edits.

## Deliverables
- Code changes implementing arrival resolver + constant loading.
- Notes on how to verify the flow manually.

## Status
- Archived (2026-01-08).
