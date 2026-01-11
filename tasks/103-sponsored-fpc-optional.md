# Ticket 103 - Make SponsoredFPC artifact loading optional

## Goal
Avoid client startup failure when the SponsoredFPC artifact is missing by making sponsored-fee setup best-effort.

## Acceptance Criteria
- If the SponsoredFPC artifact cannot be loaded, the client logs a warning and proceeds without sponsored fees.
- Existing behavior remains unchanged when the artifact loads successfully.
- No changes to contract behavior; client-only change.

## Notes
- Keep changes scoped to `apps/client/src/Backend/Aztec/scripts/darkforest.ts`.
