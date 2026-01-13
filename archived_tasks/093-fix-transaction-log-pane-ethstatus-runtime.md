# Ticket 093 - Fix TransactionLogPane EthTxStatus runtime crash

## Goal
Prevent the transaction log pane from crashing due to missing runtime `EthTxStatus` exports.

## Acceptance Criteria
- Opening the Transaction Log pane does not throw `Cannot read properties of undefined (reading 'Init')`.
- Transaction state checks use runtime-safe values (string literals or local constants).
- No changes to contract logic.

## Out of Scope
- UI redesign.
- Contract changes.

## Deliverables
- Updated TransactionLogPane to avoid runtime dependency on `EthTxStatus`.

## Tests / Commands
- `yarn workspace @darkforest-aztec/client test`
- Manual: open Transaction Log pane; no console error.

## Status
- Done (2026-01-09)
