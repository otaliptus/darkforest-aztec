# Ticket 105 - Cache Aztec connection and cleanup polling

## Goal
Avoid spawning multiple Aztec connection pollers by caching the connection returned by `getEthConnection`, and provide a clean teardown path.

## Acceptance Criteria
- `getEthConnection()` returns a single shared connection instance/promise per session.
- A failed connection attempt does not permanently poison the cache.
- Teardown clears the cached connection and stops polling.

