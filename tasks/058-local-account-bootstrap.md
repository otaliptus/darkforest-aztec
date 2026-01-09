# Ticket 058 - Local Account Bootstrap + Key Print

## Goal
Allow the local deploy script to create multiple dev accounts and print their private keys for recovery/testing.

## Acceptance Criteria
- `deploy_local.js --accounts N` prints each account’s secret/salt/signing key.
- Optionally writes a JSON file with keys (dev-only).
- Accounts can transact locally (sponsored fees or pre-funded accounts).

## Plan
1) Add an `--accounts` flag and parse it in `deploy_local.js`.
2) Generate accounts via the Aztec wallet API and register them.
3) Print keys in a structured format; optionally write to disk.
4) Keep behavior opt-in and dev-only.

## Touch Points
- `packages/contracts/scripts/deploy_local.js`

## Side Effects
- Prints private keys to stdout (acceptable for local only).
- Additional accounts may increase devnet state size slightly.

## Non-Goals
- Production-grade key management.
- Funding logic beyond local/sponsored fees.

## Status
- Archived (2026-01-08).
