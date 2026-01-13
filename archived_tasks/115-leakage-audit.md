# Ticket 115 - Noir leakage audit

## Goal
Review Noir contract code for public-data leaks beyond the intended location coordinate reveals, and document findings.

## Acceptance Criteria
- Inspect Noir public entrypoints and public storage writes for unintended exposure of private inputs (e.g., x/y, preimages, hidden game state).
- Provide a concise report of any suspected leaks or confirm none found.
- No code changes unless explicitly requested.

## Notes
- Focus on `packages/contracts/src/*.nr` (contract + helpers).
- Do not modify files under `reference/`.
