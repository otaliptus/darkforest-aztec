# 085 - Fix transaction list EthTxStatus undefined

## Status
- **Status:** Archived (2026-01-09)
- **Created:** 2026-01-09
- **Owner:** codex

## Context
Transactions list panel crashes with `Cannot read properties of undefined (reading 'Init')` in
`QueuedTransactionsTable` (TransactionLogPane). This implies `EthTxStatus` is undefined at runtime
or the import is missing.

## Acceptance Criteria
- Transactions list renders without crashing.
- `EthTxStatus` references resolve at runtime (Init/Prioritized/etc.).
- No console error when opening the transactions pane.

## Tests / Commands
- `yarn workspace @darkforest-aztec/client test`

## Notes
- Likely caused by tree-shaken enums or mixed type-only import in frontend code.
