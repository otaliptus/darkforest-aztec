# Ticket 046 - Arrival waiting indicator

## Goal
Show a clear "waiting on block N" signal when arrivals are not yet eligible to resolve, to reduce confusion during local testing.

## Acceptance Criteria
- When an arrival is mature in wall-clock time but the L2 block has not reached `arrivalBlock`, show a single "waiting on block N" message.
- The message includes arrival id and current block number.
- Message is not spammy (logged once per arrival until it resolves).
- No contract changes.

## Out of Scope
- Contract logic changes.
- Indexer changes.

## Deliverables
- Client logging update with waiting-on-block indicator.

## Tests / Commands
- Manual: trigger a move and confirm the waiting message appears only once until the block is reached.

## Status
- Done.
