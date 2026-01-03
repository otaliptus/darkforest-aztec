# Ticket 020 - Performance, devnet deploy, and docs

## Goal
Meet the < 60s turn target and provide a complete devnet deployment + documentation runbook.

## Acceptance Criteria
- Measure end-to-end turn time (proof -> send -> mempool acceptance) and record results.
- Identify and implement any required optimizations to keep a single turn under 60 seconds.
- Add devnet deployment script(s) for NFT + DarkForest, including config + minter wiring.
- Document local + devnet setup and deployment steps in README or docs.
- Provide a troubleshooting section (common node/PXE issues, sponsored fees, config mismatch).

## Out of Scope
- Mainnet deployment.
- Client UX overhaul.

## Deliverables
- Performance measurement notes (date + environment + timings).
- Devnet deploy scripts + usage docs.
- Updated README/docs for setup and deploy.

## Tests / Commands
- `yarn contracts:compile`
- `yarn contracts:test:nr`
- `yarn client:build`

## Status
- Pending; start after ticket 019 flow verification.

## Notes
- Initial local proofs: init/reveal ~50–65s end-to-end (2026-01-03), close to the 60s target.
